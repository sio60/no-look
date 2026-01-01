import { useEffect, useRef, useState } from "react";
import { FaceLandmarker, HandLandmarker, FilesetResolver, DrawingUtils } from "@mediapipe/tasks-vision";
import OBSWebSocket from "obs-websocket-js";
import { sendTriggerEvent } from "../lib/api";
import "./FaceDetector.css";

const REAL_SCENE = "REAL";
const FAKE_SCENE = "FAKE";

const FaceDetector = ({ onDistraction }) => {
    const videoRef = useRef(null);
    const canvasRef = useRef(null);

    // Fake video elements (프론트 미리보기/내부 로직용으로 유지 가능)
    const fakeVideoRef = useRef(null);

    // AI Models (MediaPipe)
    const [faceLandmarker, setFaceLandmarker] = useState(null);
    const [handLandmarker, setHandLandmarker] = useState(null);

    // State
    const [webcamRunning, setWebcamRunning] = useState(false);
    const [inputText, setInputText] = useState("");

    // Distraction State
    const [isDistracted, setIsDistracted] = useState(false);
    const [distractionReason, setDistractionReason] = useState("");
    const [botReaction, setBotReaction] = useState(null);

    // Recording & Blending State (fakeVideoUrl은 그냥 내부 표시/테스트용이면 유지)
    const [fakeVideoUrl, setFakeVideoUrl] = useState(null);
    const [isRecording, setIsRecording] = useState(false);
    const [blendRatio, setBlendRatio] = useState(0); // UI 표시용으로만 남겨도 됨
    const recordingChunks = useRef([]);
    const mediaRecorderRef = useRef(null);

    // OBS State
    const obsRef = useRef(null);
    const [obsConnected, setObsConnected] = useState(false);

    const OBS_URL = "ws://127.0.0.1:4455";
    const OBS_PASSWORD = "CDeP1CouhTyM5F1T";

    // AI Backend WebSocket (반응봇용 유지)
    const aiWsRef = useRef(null);
    const [aiConnected, setAiConnected] = useState(false);

    // Refs for loop control
    const requestRef = useRef(null);
    const runningRef = useRef(false);
    const lastVideoTimeRef = useRef(-1);
    const distractionStartTimeRef = useRef(null);

    const runningMode = "VIDEO";

    // ✅ OBS 연결 (StrictMode 안전)
    useEffect(() => {
        let cancelled = false;

        const obs = new OBSWebSocket();
        obsRef.current = obs;

        obs.on("ConnectionOpened", () => {
            console.log("OBS ConnectionOpened");
        });

        obs.on("ConnectionClosed", (e) => {
            console.log("OBS ConnectionClosed:", e);
            if (!cancelled) setObsConnected(false);
        });

        (async () => {
            try {
                await obs.connect(OBS_URL, OBS_PASSWORD);

                if (cancelled) {
                    await obs.disconnect().catch(() => { });
                    return;
                }

                console.log("✅ OBS Connected");
                setObsConnected(true);
            } catch (e) {
                if (!cancelled) {
                    console.error("❌ OBS Connection Failed", e);
                    setObsConnected(false);
                }
            }
        })();

        return () => {
            cancelled = true;
            obs.disconnect().catch(() => { });
            obsRef.current = null;
        };
    }, []);

    // 1. Initialize OBS & Models & AI WebSocket
    useEffect(() => {
        // connectOBS();
        connectAI();

        const createLandmarkers = async () => {
            console.log("🔄 Loading MediaPipe models...");
            const filesetResolver = await FilesetResolver.forVisionTasks(
                "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3/wasm"
            );

            const face = await FaceLandmarker.createFromOptions(filesetResolver, {
                baseOptions: {
                    modelAssetPath:
                        "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task",
                    delegate: "GPU",
                },
                outputFaceBlendshapes: true,
                outputFacialTransformationMatrixes: true,
                runningMode,
                numFaces: 1,
            });
            setFaceLandmarker(face);
            console.log("✅ FaceLandmarker loaded");

            const hand = await HandLandmarker.createFromOptions(filesetResolver, {
                baseOptions: {
                    modelAssetPath:
                        "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task",
                    delegate: "GPU",
                },
                runningMode,
                numHands: 1,
            });
            setHandLandmarker(hand);
            console.log("✅ HandLandmarker loaded");
        };

        createLandmarkers();

        return () => {
            try { obsRef.current?.disconnect(); } catch { }
            try { aiWsRef.current?.close(); } catch { }
            if (requestRef.current) cancelAnimationFrame(requestRef.current);
        };
    }, []);

    // // 2. OBS Connection
    // const connectOBS = async () => {
    //     try {
    //         obsRef.current.on("ConnectionClosed", (e) => {
    //             console.log("OBS ConnectionClosed:", e); // code/reason 나오는지 확인
    //         });

    //         obsRef.current.on("ConnectionOpened", () => {
    //             console.log("OBS ConnectionOpened");
    //         });

    //         await obsRef.current.connect("ws://localhost:4455", "CDeP1CouhTyM5FTT");
    //         console.log("✅ OBS Connected");
    //         setObsConnected(true);
    //     } catch (error) {
    //         console.error("❌ OBS Connection Failed", error);
    //         setObsConnected(false);
    //     }
    // };

    const switchOBSScene = async (sceneName) => {
        const obs = obsRef.current;
        if (!obsConnected) return;
        try {
            await obs.call("SetCurrentProgramScene", { sceneName });
            console.log(`🎬 OBS Scene: ${sceneName}`);
        } catch (e) {
            console.warn("⚠️ OBS Switch Failed:", e);
        }
    };

    // ✅ 핵심: 딴짓 상태가 바뀔 때 OBS 씬 전환만 한다
    useEffect(() => {
        if (!obsConnected) return;

        // onDistraction 콜백 필요하면 여기서 호출
        onDistraction?.(isDistracted);

        // ✅ 1) OBS 씬 전환
        switchOBSScene(isDistracted ? FAKE_SCENE : REAL_SCENE);

        // ✅ 2) 백엔드로 트리거 이벤트 전송
        sendTriggerEvent({
            distracted: isDistracted,
            reason: distractionReason || null,
            ts: Date.now() / 1000,
            // pitch/yaw/confidence를 갖고 있으면 같이 보내면 더 좋음
        }).catch(() => { });
    }, [isDistracted, obsConnected]);

    // 3. AI Backend WebSocket (반응봇)
    const connectAI = () => {
        if (aiWsRef.current && aiWsRef.current.readyState === WebSocket.OPEN) return;

        const ws = new WebSocket("ws://127.0.0.1:8000/ws/ai");
        aiWsRef.current = ws;

        ws.onopen = () => {
            console.log("✅ AI WS open");
            setAiConnected(true);
            // 서버에 ping 한 번 보내서 응답 확인하고 싶으면:
            ws.send(JSON.stringify({ type: "ping" }));
        };

        ws.onmessage = (e) => {
            try {
                const data = JSON.parse(e.data);
                // 서버 hello 받으면 연결 확정
                if (data.type === "hello") {
                    console.log("✅ AI hello:", data);
                    setAiConnected(true);
                    return;
                }
                if (data.type === "reaction") {
                    setBotReaction(data.reaction);
                    setTimeout(() => setBotReaction(null), 5000);
                }
            } catch {
                // 텍스트 pong 같은거는 무시 가능
            }
        };

        ws.onerror = (err) => {
            console.error("❌ AI WS error", err);
            setAiConnected(false);
        };

        ws.onclose = () => {
            console.log("❌ AI WS close");
            setAiConnected(false);
            // 필요하면 재연결
            setTimeout(connectAI, 1500);
        };
    };

    // (선택) startRecording은 유지 가능(프론트 내 fake 테스트용)
    const startRecording = (stream) => {
        setIsRecording(true);
        recordingChunks.current = [];

        const recorder = new MediaRecorder(stream, {
            mimeType: "video/webm;codecs=vp8",
        });

        recorder.ondataavailable = (e) => {
            if (e.data.size > 0) recordingChunks.current.push(e.data);
        };

        recorder.onstop = () => {
            const blob = new Blob(recordingChunks.current, { type: "video/webm" });
            const url = URL.createObjectURL(blob);
            setFakeVideoUrl(url);
            setIsRecording(false);
        };

        recorder.start();
        mediaRecorderRef.current = recorder;

        setTimeout(() => {
            if (mediaRecorderRef.current?.state === "recording") {
                mediaRecorderRef.current.stop();
            }
        }, 5000);
    };

    // Main Prediction Loop
    const predictWebcam = async () => {
        const video = videoRef.current;
        const canvas = canvasRef.current;
        if (!runningRef.current || !video || !canvas || !faceLandmarker || !handLandmarker) return;

        const startTimeMs = performance.now();

        if (video.videoWidth > 0 && video.videoHeight > 0 && video.currentTime !== lastVideoTimeRef.current) {
            lastVideoTimeRef.current = video.currentTime;

            const handResults = handLandmarker.detectForVideo(video, startTimeMs);
            const handsDetected = handResults.landmarks?.length > 0;

            const faceResults = faceLandmarker.detectForVideo(video, startTimeMs);

            let potentialDistraction = false;
            let currentReason = "";

            if (handsDetected && faceResults.faceLandmarks?.length > 0) {
                potentialDistraction = true;
                currentReason = "Hand Detected";
            }

            if (faceResults.facialTransformationMatrixes?.length > 0) {
                const matrix = faceResults.facialTransformationMatrixes[0].data;
                const landmarks = faceResults.faceLandmarks[0];

                const pitchRad = Math.atan2(matrix[6], matrix[10]);
                const pitchDeg = pitchRad * (180 / Math.PI);
                const yawDeg = Math.atan2(-matrix[2], matrix[0]) * (180 / Math.PI);
                const ear = calculateEAR(landmarks);

                if (Math.abs(pitchDeg) > 15) {
                    potentialDistraction = true;
                    currentReason = `Head Nodding (${Math.round(pitchDeg)}°)`;
                } else if (Math.abs(yawDeg) > 30) {
                    potentialDistraction = true;
                    currentReason = `Head Turning (${Math.round(yawDeg)}°)`;
                } else if (ear < 0.24) {
                    potentialDistraction = true;
                    currentReason = "Drowsiness";
                }
            }

            // 750ms 유지 조건
            if (potentialDistraction) {
                if (distractionStartTimeRef.current === null) {
                    distractionStartTimeRef.current = Date.now();
                } else if (Date.now() - distractionStartTimeRef.current > 750) {
                    setIsDistracted(true);
                    setDistractionReason(currentReason);
                }
            } else {
                distractionStartTimeRef.current = null;
                setIsDistracted(false);
            }

            // Draw landmarks (프론트 모니터용)
            const ctx = canvas.getContext("2d");
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            const drawingUtils = new DrawingUtils(ctx);

            if (faceResults.faceLandmarks) {
                for (const lms of faceResults.faceLandmarks) {
                    drawingUtils.drawConnectors(lms, FaceLandmarker.FACE_LANDMARKS_TESSELATION, {
                        color: "#C0C0C070",
                        lineWidth: 1,
                    });
                }
            }
            if (handResults.landmarks) {
                for (const lms of handResults.landmarks) {
                    drawingUtils.drawConnectors(lms, HandLandmarker.HAND_CONNECTIONS, {
                        color: "#FF0000",
                        lineWidth: 2,
                    });
                }
            }
        }

        if (runningRef.current) requestRef.current = requestAnimationFrame(predictWebcam);
    };

    // Camera Toggle (OBS Virtual Camera 우선)
    const enableCam = async () => {
        if (!faceLandmarker || !handLandmarker) {
            alert("Please wait for MediaPipe models to load...");
            return;
        }

        // STOP
        if (webcamRunning) {
            setWebcamRunning(false);
            runningRef.current = false;
            setIsDistracted(false);
            if (requestRef.current) cancelAnimationFrame(requestRef.current);

            const stream = videoRef.current?.srcObject;
            if (stream) {
                stream.getTracks().forEach((t) => t.stop());
                videoRef.current.srcObject = null;
            }
            return;
        }

        // START
        setWebcamRunning(true);
        runningRef.current = true;
        setIsDistracted(false);

        try {
            // ✅ 0) 권한 먼저 획득해서 device label 채우기 (중요!)
            const tmp = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
            tmp.getTracks().forEach((t) => t.stop());

            // ✅ 1) 장치 나열
            const devices = await navigator.mediaDevices.enumerateDevices();
            const videoDevices = devices.filter((d) => d.kind === "videoinput");

            // ✅ 2) OBS/Virtual 우선 선택
            const obsCam =
                videoDevices.find((d) => (d.label || "").toLowerCase().includes("obs")) ||
                videoDevices.find((d) => (d.label || "").toLowerCase().includes("virtual"));

            // ✅ 3) 없으면 일반 웹캠 fallback
            const realCam = videoDevices.find((d) => {
                const label = (d.label || "").toLowerCase();
                return !label.includes("obs") && !label.includes("virtual");
            });

            const selected = obsCam || realCam || videoDevices[0];

            if (!selected) throw new Error("No video input device found");

            console.log("🎥 Selected camera:", selected.label || selected.deviceId);

            // ✅ 4) 선택한 카메라로 스트림 시작
            const stream = await navigator.mediaDevices.getUserMedia({
                video: {
                    deviceId: selected.deviceId ? { exact: selected.deviceId } : undefined,
                    width: { ideal: 1280 },
                    height: { ideal: 720 },
                },
                audio: false,
            });

            videoRef.current.srcObject = stream;

            // loadeddata 중복 방지: once 옵션 사용
            videoRef.current.addEventListener(
                "loadeddata",
                () => {
                    predictWebcam();

                    // ⚠️ OBS 가상카메라 스트림에 fake 녹화는 의미가 없고 충돌 가능성만 올림
                    // 필요하면 아래 주석 해제
                    // if (!fakeVideoUrl) startRecording(stream);
                },
                { once: true }
            );
        } catch (err) {
            alert(`Webcam error: ${err.message}`);
            setWebcamRunning(false);
            runningRef.current = false;
        }
    };


    const sendMacro = async (app) => {
        try {
            await fetch("http://localhost:8000/control/macro", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ text: inputText, app }),
            });
        } catch (err) {
            console.error(err);
        }
    };

    return (
        <div className="face-detector">
            <div style={{ position: "relative", width: "640px", height: "480px" }}>
                <video
                    ref={videoRef}
                    style={{ width: "100%", height: "100%", transform: "scaleX(-1)" }}
                    autoPlay
                    playsInline
                />
                <canvas
                    ref={canvasRef}
                    width="640"
                    height="480"
                    style={{ position: "absolute", left: 0, top: 0, transform: "scaleX(-1)" }}
                />

                {fakeVideoUrl && (
                    <video
                        ref={fakeVideoRef}
                        src={fakeVideoUrl}
                        autoPlay
                        loop
                        muted
                        style={{ display: "none" }}
                    />
                )}

                {isDistracted && (
                    <div style={{
                        position: "absolute", top: "10px", right: "10px",
                        backgroundColor: "rgba(255, 0, 0, 0.7)", color: "white",
                        padding: "5px 10px", borderRadius: "5px", fontWeight: "bold"
                    }}>
                        🚨 DISTRACTED: {distractionReason}
                        <br />
                        <small>Blend(UI): {Math.round(blendRatio * 100)}%</small>
                    </div>
                )}

                {isRecording && (
                    <div style={{
                        position: "absolute", top: "10px", left: "10px",
                        backgroundColor: "rgba(255, 165, 0, 0.8)", color: "white",
                        padding: "5px 10px", borderRadius: "5px", fontWeight: "bold"
                    }}>
                        🔴 Recording fake video...
                    </div>
                )}

                {botReaction && (
                    <div style={{
                        position: "absolute", bottom: "10px", left: "10px",
                        backgroundColor: "rgba(0, 123, 255, 0.9)", color: "white",
                        padding: "8px 12px", borderRadius: "5px", maxWidth: "300px"
                    }}>
                        🤖 {botReaction}
                    </div>
                )}
            </div>

            <div className="controls">
                <button onClick={enableCam}>
                    {webcamRunning ? "Stop Camera" : "Start Camera"}
                </button>

                <div style={{ marginLeft: "10px", display: "inline-block", fontSize: "0.9em" }}>
                    OBS: {obsConnected ? "✅" : "❌"} | AI: {aiConnected ? "✅" : "❌"}
                    {fakeVideoUrl && " | Fake(Local): ✅"}
                </div>

                <div className="macro-control" style={{ marginTop: "10px" }}>
                    <input
                        type="text"
                        value={inputText}
                        onChange={(e) => setInputText(e.target.value)}
                        placeholder="Message to type..."
                    />
                    <button onClick={() => sendMacro("zoom")}>Send to Zoom</button>
                    <button onClick={() => sendMacro("discord")}>Send to Discord</button>
                </div>
            </div>
        </div>
    );
};

export default FaceDetector;
