import { useRef, useEffect, useState, useCallback } from 'react';

export default function VideoPreview({ mode, ratio, addToast }) {
    const realVideoRef = useRef(null);
    const fakeCanvasRef = useRef(null);
    const streamRef = useRef(null);
    const animationRef = useRef(null);

    const [hasPermission, setHasPermission] = useState(null);
    const [error, setError] = useState(null);

    const isTransitioning = ratio > 0 && ratio < 1;

    const startWebcam = useCallback(async () => {
        try {
            // 1️⃣ 장치 나열
            const devices = await navigator.mediaDevices.enumerateDevices();
            const obsCam = devices.find(
                d =>
                    d.kind === "videoinput" &&
                    d.label.toLowerCase().includes("obs")
            );

            if (!obsCam) {
                throw new Error("OBS Virtual Camera not found");
            }

            // 2️⃣ OBS Virtual Camera만 사용
            const stream = await navigator.mediaDevices.getUserMedia({
                video: {
                    deviceId: { exact: obsCam.deviceId },
                    width: { ideal: 1280 },
                    height: { ideal: 720 },
                },
                audio: false,
            });

            streamRef.current = stream;
            realVideoRef.current.srcObject = stream;

            setHasPermission(true);
            setError(null);
        } catch (err) {
            console.error("OBS Camera error:", err);
            setHasPermission(false);
            setError("OBS Virtual Camera 연결 실패");
            addToast?.("OBS 가상 카메라를 켜주세요", "error");
        }
    }, [addToast]);


    const stopWebcam = useCallback(() => {
        if (streamRef.current) {
            streamRef.current.getTracks().forEach((track) => track.stop());
            streamRef.current = null;
        }
        if (animationRef.current) {
            cancelAnimationFrame(animationRef.current);
            animationRef.current = null;
        }
    }, []);

    const applyFakeFilter = useCallback(() => {
        const video = realVideoRef.current;
        const canvas = fakeCanvasRef.current;
        if (!video || !canvas || !video.videoWidth) return;

        const ctx = canvas.getContext('2d');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;

        const drawFrame = () => {
            if (!video.paused && !video.ended) {
                ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

                const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                const data = imageData.data;

                for (let i = 0; i < data.length; i += 4) {
                    const avg = (data[i] + data[i + 1] + data[i + 2]) / 3;
                    const adjusted = avg * 1.1 + 10;
                    data[i] = adjusted;
                    data[i + 1] = adjusted;
                    data[i + 2] = adjusted;
                }
                ctx.putImageData(imageData, 0, 0);

                ctx.fillStyle = 'rgba(255, 100, 100, 0.3)';
                ctx.font = 'bold 24px Arial';
                ctx.fillText('FAKE', 10, 30);
            }

            animationRef.current = requestAnimationFrame(drawFrame);
        };

        drawFrame();
    }, []);

    useEffect(() => {
        startWebcam();
        return stopWebcam;
    }, [startWebcam, stopWebcam]);

    useEffect(() => {
        const video = realVideoRef.current;
        if (!video) return;

        const handlePlay = () => applyFakeFilter();
        video.addEventListener('play', handlePlay);
        return () => video.removeEventListener('play', handlePlay);
    }, [applyFakeFilter]);

    const getPreviewClass = (previewType) => {
        const baseClass = 'preview-box';
        const activeClass = mode === previewType ? 'active' : '';
        const transitionClass = isTransitioning ? 'transitioning' : '';
        return `${baseClass} ${activeClass} ${transitionClass}`;
    };

    return (
        <div className="panel video-preview-panel">
            <h2 className="panel-title">Video Preview</h2>

            {error && (
                <div className="video-error">
                    {error}
                    <button className="btn btn-small" onClick={startWebcam}>다시 시도</button>
                </div>
            )}

            <div className="preview-container">
                <div className={getPreviewClass('REAL')}>
                    <div className="preview-label">REAL</div>
                    <video ref={realVideoRef} autoPlay muted playsInline className="preview-video" />
                    {!hasPermission && hasPermission !== null && (
                        <div className="preview-placeholder">카메라 권한 필요</div>
                    )}
                </div>

                <div className={getPreviewClass('FAKE')}>
                    <div className="preview-label">FAKE</div>
                    <canvas ref={fakeCanvasRef} className="preview-canvas" />
                    {!hasPermission && hasPermission !== null && (
                        <div className="preview-placeholder">카메라 권한 필요</div>
                    )}
                </div>
            </div>

            <div className="preview-mode-indicator">
                <span className={`mode-dot ${mode === 'REAL' ? 'active' : ''}`}>●</span>
                <span className="mode-text">
                    현재 모드: <strong>{mode}</strong> ({Math.round(ratio * 100)}%)
                    {isTransitioning && ' (전환 중...)'}
                </span>
                <span className={`mode-dot ${mode === 'FAKE' ? 'active' : ''}`}>●</span>
            </div>
        </div>
    );
}
