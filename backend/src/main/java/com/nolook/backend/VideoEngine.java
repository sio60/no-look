package com.nolook.backend;

import com.nolook.backend.matcher.LightingMatcher;

import com.nolook.backend.switcher.SeamlessSwitcher;
import com.nolook.backend.web.StreamingController;
import org.bytedeco.javacpp.BytePointer;
import org.bytedeco.javacpp.Loader;
import org.bytedeco.opencv.opencv_core.Mat;
import org.bytedeco.opencv.opencv_videoio.VideoCapture;
import org.bytedeco.opencv.global.opencv_highgui;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;

import jakarta.annotation.PostConstruct;

import static org.bytedeco.opencv.global.opencv_imgcodecs.imencode;
import static org.bytedeco.opencv.global.opencv_imgproc.resize;
import static org.bytedeco.opencv.global.opencv_videoio.CAP_PROP_POS_FRAMES;
import static org.bytedeco.opencv.global.opencv_videoio.CAP_DSHOW;

/**
 * 비디오 처리 엔진 - 실제 카메라와 가짜 영상을 블렌딩합니다.
 * 
 * @기능 프레임 캡처, 조명 매칭, 알파 블렌딩
 * @성능 별도 스레드에서 30fps 처리
 * @조건 video.engine.enabled=true 일 때만 활성화 (테스트 시 비활성화)
 */
@Service
@ConditionalOnProperty(name = "video.engine.enabled", havingValue = "true", matchIfMissing = true)
public class VideoEngine {

    private final LightingMatcher matcher;
    private final SeamlessSwitcher switcher;
    private final StreamingController streamingController;

    private VideoCapture realCam;
    private VideoCapture fakeVideo;

    // [Speed] GC 오버헤드를 줄이기 위한 Mat 객체 재사용
    private final Mat realFrame = new Mat();
    private final Mat fakeFrame = new Mat();
    private final Mat outputFrame = new Mat();

    public VideoEngine(LightingMatcher matcher, SeamlessSwitcher switcher, StreamingController streamingController) {
        this.matcher = matcher;
        this.switcher = switcher;
        this.streamingController = streamingController;
    }

    @PostConstruct
    public void init() {
        Loader.load(org.bytedeco.opencv.global.opencv_core.class);

        realCam = new VideoCapture(0, CAP_DSHOW);
        // 가짜 영상 경로 - ai/assets 폴더의 fake_sample.mp4 사용
        fakeVideo = new VideoCapture("../ai/assets/fake_sample.mp4");

        if (!realCam.isOpened()) {
            System.err.println("Warning: Camera not found.");
        }

        // 별도 스레드에서 무한 루프 실행
        Thread engineThread = new Thread(this::process);
        engineThread.setPriority(Thread.MAX_PRIORITY); // [Speed] 연산 우선순위 상향
        engineThread.start();
    }

    private void process() {
        while (true) {
            long startTime = System.currentTimeMillis();

            // 1) Real 읽기 + 유효성 체크
            boolean okReal = (realCam != null && realCam.isOpened() && realCam.read(realFrame));
            if (!okReal || realFrame.empty() || realFrame.cols() <= 0 || realFrame.rows() <= 0) {
                // 카메라가 잠깐 비는 경우가 있음 → 다음 루프로
                continue;
            }

            // 2) Fake 읽기 + 루프 처리 + 유효성 체크
            boolean okFake = (fakeVideo != null && fakeVideo.isOpened() && fakeVideo.read(fakeFrame));
            if (!okFake || fakeFrame.empty()) {
                fakeVideo.set(CAP_PROP_POS_FRAMES, 0);
                okFake = fakeVideo.read(fakeFrame);
                if (!okFake || fakeFrame.empty()) {
                    // fake 소스가 아직 준비 안 됨 → 다음 루프
                    continue;
                }
            }

            // 3) resize 전에 target size 확정 (0 방지)
            int w = realFrame.cols();
            int h = realFrame.rows();
            if (w <= 0 || h <= 0)
                continue;

            resize(fakeFrame, fakeFrame, new org.bytedeco.opencv.opencv_core.Size(w, h));

            matcher.match(realFrame, fakeFrame);
            switcher.blend(realFrame, fakeFrame, outputFrame);

            if (!outputFrame.empty()) {
                opencv_highgui.imshow("No-Look Video Engine", outputFrame);

                // Broadcast to StreamingController
                BytePointer buf = new BytePointer();
                imencode(".jpg", outputFrame, buf);
                byte[] jpegData = buf.getStringBytes();
                streamingController.pushFrame(jpegData);
                buf.deallocate();
            }

            long elapsedTime = System.currentTimeMillis() - startTime;
            if (elapsedTime > 33) {
                System.err.println(
                        "[WARNING] Rapidity Alert: Engine Latency (" + elapsedTime + "ms) exceeds 33ms threshold!");
            }

            int waitTime = (int) Math.max(1, 33 - elapsedTime);
            if (opencv_highgui.waitKey(waitTime) >= 0)
                break;
        }
    }

}
