package com.nolook.backend.matcher;

import org.bytedeco.opencv.opencv_core.*;
import org.springframework.stereotype.Component;

import static org.bytedeco.opencv.global.opencv_core.*;
import static org.bytedeco.opencv.global.opencv_imgproc.*;

@Component
public class LightingMatcher {

    private double avgDiff = 0;
    private static final double SMOOTHING_FACTOR = 0.2; // 0.2 means 20% current, 80% history

    /**
     * 실제 영상을 분석하여 가짜 영상의 광원을 동기화합니다.
     */
    public void match(Mat real, Mat fake) {
        if (real.empty() || fake.empty())
            return;

        Mat realLab = new Mat();
        Mat fakeLab = new Mat();

        // BGR -> Lab 변환
        cvtColor(real, realLab, COLOR_BGR2Lab);
        cvtColor(fake, fakeLab, COLOR_BGR2Lab);

        MatVector realChannels = new MatVector();
        MatVector fakeChannels = new MatVector();
        split(realLab, realChannels);
        split(fakeLab, fakeChannels);

        // L 채널(밝기) 분석
        Scalar realMean = mean(realChannels.get(0));
        Scalar fakeMean = mean(fakeChannels.get(0));

        double realL = realMean.get(0);

        // [Accuracy Monitoring] 환경 적합성 경고 (저조도/과노출)
        if (realL < 30) {
            System.err.println("[WARNING] Accuracy Alert: Low Light Environment detected (" + realL
                    + "). Lighting match may be unreliable.");
        } else if (realL > 220) {
            System.err.println("[WARNING] Accuracy Alert: Overexposed Environment detected (" + realL
                    + "). Lighting match may be unreliable.");
        }

        double currentDiff = realL - fakeMean.get(0);

        // [Accuracy] EMA Filter를 통한 급격한 밝기 변화(Flickering) 방지
        avgDiff = (SMOOTHING_FACTOR * currentDiff) + (1.0 - SMOOTHING_FACTOR) * avgDiff;

        // 밝기 차이 적용
        fakeChannels.get(0).convertTo(fakeChannels.get(0), -1, 1.0, avgDiff);

        // 병합 및 복원
        merge(fakeChannels, fakeLab);
        cvtColor(fakeLab, fake, COLOR_Lab2BGR);

        // 리소스 정리
        realLab.release();
        fakeLab.release();
        realChannels.close();
        fakeChannels.close();
    }
}
