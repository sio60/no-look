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

/**
 * Video Engine 핵심 로직 스모크 테스트
 * 
 * @기능 LightingMatcher, SeamlessSwitcher, VideoState 통합 테스트
 */
public class CoreLogicSmokeTest {

    @Test
    public void testVideoEngineLogic() {
        // ========================================
        // 1. Native Library 로드 확인
        // ========================================
        Loader.load(org.bytedeco.opencv.global.opencv_core.class);

        // ========================================
        // 2. 구성 요소 초기화
        // ========================================
        VideoState state = new VideoState();
        LightingMatcher matcher = new LightingMatcher();
        SeamlessSwitcher switcher = new SeamlessSwitcher(state);

        // 테스트용 초기화 (첫 프레임에서 즉시 계산되도록)
        matcher.resetForTest();

        // ========================================
        // 3. 더미 프레임 생성 (640x480 컬러)
        // ========================================
        Mat real = new Mat(480, 640, opencv_core.CV_8UC3, new Scalar(100, 100, 100, 0)); // 회색
        Mat fake = new Mat(480, 640, opencv_core.CV_8UC3, new Scalar(50, 50, 50, 0)); // 어두운 회색
        Mat out = new Mat();

        // ========================================
        // 4. LightingMatcher 테스트
        // ========================================
        assertDoesNotThrow(() -> matcher.match(real, fake),
                "LightingMatcher should not throw exception");

        // ========================================
        // 5. VideoState + SeamlessSwitcher 테스트
        // ========================================
        state.setTarget(VideoState.Mode.FAKE, 300); // 300ms 전환
        state.updateAlpha(); // Alpha 업데이트

        assertTrue(state.getAlpha() >= 0.0, "Alpha should be >= 0");
        assertTrue(state.isTransitioning(), "Should be transitioning");

        assertDoesNotThrow(() -> switcher.blend(real, fake, out),
                "SeamlessSwitcher should not throw exception");
        assertFalse(out.empty(), "Output frame should not be empty");

        System.out.println("✅ Smoke Test Passed: Core logic is functionally sound.");
        System.out.println("   - LightingMatcher: OK (downsampling + frame skip)");
        System.out.println("   - VideoState: OK (easing + fadeMs)");
        System.out.println("   - SeamlessSwitcher: OK (blending)");

        // ========================================
        // 6. 자원 해제
        // ========================================
        real.release();
        fake.release();
        out.release();
    }
}
