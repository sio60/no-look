package com.nolook.backend.matcher;

import org.bytedeco.opencv.opencv_core.*;
import org.springframework.stereotype.Component;

import static org.bytedeco.opencv.global.opencv_core.*;
import static org.bytedeco.opencv.global.opencv_imgproc.*;

/**
 * 실제 영상과 가짜 영상의 조명(밝기)을 동기화하는 클래스입니다.
 * 
 * @기능 실제 카메라의 밝기를 분석하여 가짜 영상에 적용
 * @성능 다운샘플링(1/4) + 3프레임 스킵으로 연산 비용 94% 절감
 */
@Component
public class LightingMatcher {

    // ========================================
    // EMA(Exponential Moving Average) 필터 설정
    // ========================================

    /**
     * EMA 스무딩 계수 (0.0 ~ 1.0)
     * - 0.2 = 현재 값 20%, 이전 히스토리 80% 반영
     * - 값이 작을수록 밝기 변화가 부드럽고, 클수록 반응이 빠름
     * 
     * @패키지출처 직접 구현 (수학적 EMA 공식)
     */
    private static final double SMOOTHING_FACTOR = 0.2;

    /** EMA 필터링된 평균 밝기 차이값 */
    private double avgDiff = 0;

    // ========================================
    // 성능 최적화: 프레임 스킵 설정
    // ========================================

    /**
     * 밝기 계산 간격 (N 프레임마다 계산)
     * - 3 = 30fps 기준 약 100ms마다 계산
     * 
     * @성능 연산 빈도 67% 감소
     */
    private static final int CALC_INTERVAL = 3;

    /** 프레임 카운터 */
    private int frameCounter = 0;

    // ========================================
    // 성능 최적화: Mat 객체 재사용 (GC 방지)
    // ========================================

    /**
     * 다운샘플링된 실제 영상 (1/4 해상도)
     * 
     * @패키지출처 org.bytedeco.opencv.opencv_core.Mat
     * @성능 Lab 변환 비용 94% 절감 (1/16 픽셀)
     */
    private final Mat downsampledReal = new Mat();

    /** 다운샘플링된 가짜 영상 (1/4 해상도) */
    private final Mat downsampledFake = new Mat();

    /** Lab 색공간으로 변환된 실제 영상 */
    private final Mat realLab = new Mat();

    /** Lab 색공간으로 변환된 가짜 영상 */
    private final Mat fakeLab = new Mat();

    /** L, a, b 채널 분리용 벡터 (실제 영상) */
    private final MatVector realChannels = new MatVector();

    /** L, a, b 채널 분리용 벡터 (가짜 영상) */
    private final MatVector fakeChannels = new MatVector();

    // ========================================
    // 밝기 조정용 Mat 객체 (가짜 영상에 적용)
    // ========================================

    /** 가짜 영상의 Lab 변환용 */
    private final Mat fakeLabFull = new Mat();

    /** 가짜 영상의 채널 분리용 */
    private final MatVector fakeChannelsFull = new MatVector();

    /**
     * 실제 영상의 밝기를 분석하여 가짜 영상에 적용합니다.
     * 
     * @패키지출처 org.bytedeco.opencv.global.opencv_imgproc.cvtColor
     * @기능 BGR → Lab 변환 후 L 채널(밝기) 동기화
     * @param real 실제 카메라 프레임 (BGR, 원본 해상도)
     * @param fake 가짜 영상 프레임 (BGR, 원본 해상도) - **in-place 수정됨**
     */
    public void match(Mat real, Mat fake) {
        if (real.empty() || fake.empty()) {
            return;
        }

        frameCounter++;

        // ========================================
        // N 프레임마다만 밝기 차이 계산 (성능 최적화)
        // ========================================
        if (frameCounter % CALC_INTERVAL == 0) {
            calculateBrightnessDiff(real, fake);
        }

        // ========================================
        // 매 프레임 밝기 조정 적용
        // ========================================
        applyBrightnessAdjustment(fake);
    }

    /**
     * 다운샘플링된 이미지로 밝기 차이를 계산합니다.
     * 
     * @패키지출처 org.bytedeco.opencv.global.opencv_imgproc.resize
     * @기능 1/4 해상도로 축소 후 Lab 공간에서 밝기(L) 차이 계산
     * @성능 원본 대비 연산량 94% 감소
     */
    private void calculateBrightnessDiff(Mat real, Mat fake) {
        // 다운샘플링 (1/4 해상도)
        Size smallSize = new Size(real.cols() / 4, real.rows() / 4);

        /**
         * resize() - 이미지 크기 조절
         * 
         * @패키지출처 org.bytedeco.opencv.global.opencv_imgproc.resize
         * @param src  원본 이미지
         * @param dst  결과 이미지 (재사용)
         * @param size 목표 크기
         */
        resize(real, downsampledReal, smallSize);
        resize(fake, downsampledFake, smallSize);

        /**
         * cvtColor() - 색공간 변환
         * 
         * @패키지출처 org.bytedeco.opencv.global.opencv_imgproc.cvtColor
         * @param COLOR_BGR2Lab BGR → Lab 변환 상수
         *                      - L: 밝기 (0~255)
         *                      - a: 녹색-빨강 축
         *                      - b: 파랑-노랑 축
         */
        cvtColor(downsampledReal, realLab, COLOR_BGR2Lab);
        cvtColor(downsampledFake, fakeLab, COLOR_BGR2Lab);

        /**
         * split() - 다채널 이미지를 개별 채널로 분리
         * 
         * @패키지출처 org.bytedeco.opencv.global.opencv_core.split
         * @param channels[0] = L 채널 (밝기)
         * @param channels[1] = a 채널
         * @param channels[2] = b 채널
         */
        split(realLab, realChannels);
        split(fakeLab, fakeChannels);

        /**
         * mean() - 이미지의 평균값 계산
         * 
         * @패키지출처 org.bytedeco.opencv.global.opencv_core.mean
         * @return Scalar 객체, get(0)으로 첫 번째 채널(L) 평균 추출
         */
        Scalar realMean = mean(realChannels.get(0));
        Scalar fakeMean = mean(fakeChannels.get(0));

        double realL = realMean.get(0);
        double fakeL = fakeMean.get(0);

        // ========================================
        // 환경 적합성 경고 (저조도/과노출)
        // ========================================
        if (realL < 30) {
            System.err.println("[WARNING] Accuracy Alert: Low Light (" + String.format("%.1f", realL) + ")");
        } else if (realL > 220) {
            System.err.println("[WARNING] Accuracy Alert: Overexposed (" + String.format("%.1f", realL) + ")");
        }

        double currentDiff = realL - fakeL;

        /**
         * EMA 필터 적용 - 급격한 밝기 변화(Flickering) 방지
         * 
         * @공식 avgDiff = α * currentDiff + (1 - α) * avgDiff
         * @성능 프레임 간 밝기 전환이 부드러워짐
         */
        avgDiff = (SMOOTHING_FACTOR * currentDiff) + (1.0 - SMOOTHING_FACTOR) * avgDiff;
    }

    /**
     * 계산된 밝기 차이를 가짜 영상에 적용합니다.
     * 
     * @패키지출처 org.bytedeco.opencv.global.opencv_core.merge
     * @기능 L 채널에 avgDiff를 더하여 밝기 동기화
     * @param fake 가짜 영상 (in-place 수정)
     */
    private void applyBrightnessAdjustment(Mat fake) {
        // BGR → Lab 변환
        cvtColor(fake, fakeLabFull, COLOR_BGR2Lab);
        split(fakeLabFull, fakeChannelsFull);

        /**
         * convertTo() - 픽셀값 변환 (밝기 조절)
         * 
         * @패키지출처 org.bytedeco.opencv.opencv_core.Mat.convertTo
         * @param dst   결과 Mat (동일 객체 = in-place)
         * @param rtype -1 = 원본 타입 유지
         * @param alpha 1.0 = 곱셈 계수 (대비)
         * @param beta  avgDiff = 덧셈 계수 (밝기)
         */
        fakeChannelsFull.get(0).convertTo(fakeChannelsFull.get(0), -1, 1.0, avgDiff);

        /**
         * merge() - 개별 채널을 다채널 이미지로 병합
         * 
         * @패키지출처 org.bytedeco.opencv.global.opencv_core.merge
         */
        merge(fakeChannelsFull, fakeLabFull);

        /**
         * cvtColor() - Lab → BGR 역변환
         * 
         * @param fake 결과가 원본 fake에 직접 저장됨
         */
        cvtColor(fakeLabFull, fake, COLOR_Lab2BGR);
    }

    /**
     * 테스트용: 첫 프레임에서도 즉시 계산하도록 카운터 리셋
     */
    public void resetForTest() {
        frameCounter = CALC_INTERVAL - 1;
        avgDiff = 0;
    }
}
