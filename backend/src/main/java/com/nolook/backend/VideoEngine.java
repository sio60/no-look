package com.nolook.backend;

import com.nolook.backend.matcher.LightingMatcher;
import com.nolook.backend.switcher.SeamlessSwitcher;
import org.bytedeco.javacpp.Loader;
import org.bytedeco.opencv.opencv_core.Mat;
import org.bytedeco.opencv.opencv_videoio.VideoCapture;
import org.bytedeco.opencv.global.opencv_highgui;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;

import jakarta.annotation.PostConstruct;

import static org.bytedeco.opencv.global.opencv_imgproc.resize;
import static org.bytedeco.opencv.global.opencv_videoio.CAP_PROP_POS_FRAMES;

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

    private VideoCapture realCam;
    private VideoCapture fakeVideo;

    // [Speed] GC 오버헤드를 줄이기 위한 Mat 객체 재사용
    private final Mat realFrame = new Mat();
    private final Mat fakeFrame = new Mat();
    private final Mat outputFrame = new Mat();

    public VideoEngine(LightingMatcher matcher, SeamlessSwitcher switcher) {
        this.matcher = matcher;
        this.switcher = switcher;
    }

    @PostConstruct
    public void init() {
        Loader.load(org.bytedeco.opencv.global.opencv_core.class);

        realCam = new VideoCapture(0);
        // 가짜 영상 경로 확인 필요
        fakeVideo = new VideoCapture("src/main/resources/fake_loop.mp4");

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

            if (!realCam.read(realFrame))
                continue;

            if (!fakeVideo.read(fakeFrame)) {
                fakeVideo.set(CAP_PROP_POS_FRAMES, 0);
                fakeVideo.read(fakeFrame);
            }

            // 해상도 조절 (fakeFrame을 realFrame 크기에 맞춤)
            resize(fakeFrame, fakeFrame, realFrame.size());

            // 1. [Accuracy] Lighting Matcher 적용 (EMA 필터 내장됨)
            matcher.match(realFrame, fakeFrame);

            // 2. [Rapidity] Seamless Switcher 적용 (0.5s Alpha Blending)
            switcher.blend(realFrame, fakeFrame, outputFrame);

            // 3. 결과 출력
            if (!outputFrame.empty()) {
                opencv_highgui.imshow("No-Look Video Engine", outputFrame);
            }

            // [Rapidity Monitoring] 연산 지연 발생 시 경고 로그 (30fps 기준 33ms 초과 시)
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
