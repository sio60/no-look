package com.nolook.backend;

import com.nolook.backend.matcher.LightingMatcher;
import com.nolook.backend.switcher.SeamlessSwitcher;
import com.nolook.backend.core.VideoState;
import org.bytedeco.opencv.opencv_core.Mat;
import org.bytedeco.opencv.opencv_core.Scalar;
import org.bytedeco.opencv.global.opencv_core;
import org.bytedeco.javacpp.Loader;
import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;

public class CoreLogicSmokeTest {

    @Test
    public void testVideoEngineLogic() {
        // 1. Native Library 로드 확인
        Loader.load(org.bytedeco.opencv.global.opencv_core.class);

        // 2. 구성 요소 전개
        VideoState state = new VideoState();
        LightingMatcher matcher = new LightingMatcher();
        SeamlessSwitcher switcher = new SeamlessSwitcher(state);

        // 3. 더미 데이터 생성 (640x480 컬러 프레임)
        Mat real = new Mat(480, 640, opencv_core.CV_8UC3, new Scalar(100, 100, 100, 0)); // 회색
        Mat fake = new Mat(480, 640, opencv_core.CV_8UC3, new Scalar(50, 50, 50, 0)); // 어두운 회색
        Mat out = new Mat();

        // 4. 모듈 작동 확인
        // - Matcher: 예외 없이 실행되는지
        assertDoesNotThrow(() -> matcher.match(real, fake));

        // - Switcher: 블렌딩 결과 확인
        state.setTarget(VideoState.Mode.FAKE);
        state.updateAlpha(); // Alpha should increase

        assertDoesNotThrow(() -> switcher.blend(real, fake, out));
        assertFalse(out.empty(), "Output frame should not be empty");

        System.out.println("Smoke Test Passed: Core logic is functionally sound.");

        // 자원 해제
        real.release();
        fake.release();
        out.release();
    }
}
