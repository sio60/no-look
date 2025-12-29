package com.nolook.backend.switcher;

import com.nolook.backend.core.VideoState;
import org.bytedeco.opencv.opencv_core.*;
import org.springframework.stereotype.Component;

import static org.bytedeco.opencv.global.opencv_core.addWeighted;

@Component
public class SeamlessSwitcher {

    private final VideoState videoState;

    public SeamlessSwitcher(VideoState videoState) {
        this.videoState = videoState;
    }

    /**
     * 두 프레임을 현재 알파 값에 따라 블렌딩합니다.
     */
    public void blend(Mat real, Mat fake, Mat output) {
        if (real.empty() || fake.empty())
            return;

        // 알파 업데이트 및 가져오기
        videoState.updateAlpha();
        double alpha = videoState.getAlpha();

        // blended = real * (1-alpha) + fake * alpha
        addWeighted(real, 1.0 - alpha, fake, alpha, 0.0, output);
    }
}
