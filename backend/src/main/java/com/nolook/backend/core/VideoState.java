package com.nolook.backend.core;

import lombok.Getter;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.util.concurrent.atomic.AtomicReference;

/**
 * 비디오 전환 상태와 알파 블렌딩 값을 관리하는 클래스입니다.
 * 
 * @기능 REAL ↔ FAKE 모드 전환, Easing 기반 부드러운 알파 전환
 * @성능 AtomicReference로 스레드 안전성 보장
 */
@Component
@Getter
public class VideoState {

    /**
     * 비디오 모드 enum
     * - REAL: 실제 카메라 영상
     * - FAKE: 가짜(딥페이크) 영상
     * - XFADING: 전환 중 (UI 표시용)
     */
    public enum Mode {
        REAL, FAKE, XFADING
    }

    // ========================================
    // 알파 값 관리 (스레드 안전)
    // ========================================

    /**
     * 현재 알파 값 (0.0 ~ 1.0)
     * - 0.0 = 100% REAL
     * - 1.0 = 100% FAKE
     * 
     * @패키지출처 java.util.concurrent.atomic.AtomicReference
     * @성능 Lock-free 스레드 안전성
     */
    private final AtomicReference<Double> currentAlpha = new AtomicReference<>(0.0);

    /** 목표 알파 값 */
    private final AtomicReference<Double> targetAlpha = new AtomicReference<>(0.0);

    /** 현재 모드 */
    private final AtomicReference<Mode> currentMode = new AtomicReference<>(Mode.REAL);

    // ========================================
    // 전환 설정
    // ========================================

    /**
     * 기본 전환 시간 (ms)
     * 
     * @설정 application.properties의 video.transition.default-ms
     */
    @Value("${video.transition.default-ms:300}")
    private double defaultTransitionMs = 300.0;

    /** 현재 전환에 사용되는 지속 시간 (ms) */
    private volatile double transitionDurationMs = 300.0;

    /** 전환 시작 시각 (System.currentTimeMillis) */
    private volatile long transitionStartTime = 0;

    /** 전환 시작 시점의 알파 값 */
    private volatile double startAlpha = 0.0;

    // ========================================
    // 공개 API
    // ========================================

    /**
     * 모드 전환을 시작합니다. (기본 전환 시간 사용)
     * 
     * @param mode 목표 모드 (REAL 또는 FAKE)
     */
    public void setTarget(Mode mode) {
        setTarget(mode, defaultTransitionMs);
    }

    /**
     * 모드 전환을 시작합니다. (사용자 지정 전환 시간)
     * 
     * @param mode   목표 모드 (REAL 또는 FAKE)
     * @param fadeMs 전환 지속 시간 (밀리초)
     */
    public void setTarget(Mode mode, double fadeMs) {
        if (fadeMs > 0) {
            this.transitionDurationMs = fadeMs;
        }

        this.transitionStartTime = System.currentTimeMillis();
        this.startAlpha = currentAlpha.get();

        // 목표 알파 설정
        if (mode == Mode.FAKE) {
            targetAlpha.set(1.0);
        } else {
            targetAlpha.set(0.0);
        }

        currentMode.set(mode);

        System.out.println("[VideoState] Transition started: " + mode +
                " (duration: " + fadeMs + "ms)");
    }

    /**
     * 매 프레임마다 호출하여 알파 값을 업데이트합니다.
     * EaseInOutQuad 이징 함수를 적용하여 부드러운 전환을 제공합니다.
     * 
     * @기능 시간 기반 알파 보간 (프레임 독립적)
     */
    public void updateAlpha() {
        double target = targetAlpha.get();
        double current = currentAlpha.get();

        // 이미 목표에 도달한 경우
        if (Math.abs(current - target) < 0.001) {
            currentAlpha.set(target);
            return;
        }

        // 경과 시간 계산
        long elapsed = System.currentTimeMillis() - transitionStartTime;
        double progress = Math.min(1.0, elapsed / transitionDurationMs);

        /**
         * EaseInOutQuad 이징 함수
         * - 시작과 끝에서 천천히, 중간에서 빠르게
         * - 자연스러운 가속/감속 효과
         * 
         * @공식
         *     progress < 0.5: 2 * progress^2
         *     progress >= 0.5: 1 - (-2*progress + 2)^2 / 2
         */
        double eased = easeInOutQuad(progress);

        // 시작 알파에서 목표 알파로 보간
        double newAlpha = startAlpha + (target - startAlpha) * eased;
        currentAlpha.set(newAlpha);
    }

    /**
     * EaseInOutQuad 이징 함수
     * 
     * @param t 진행률 (0.0 ~ 1.0)
     * @return 이징 적용된 값 (0.0 ~ 1.0)
     * @참고 https://easings.net/#easeInOutQuad
     */
    private double easeInOutQuad(double t) {
        if (t < 0.5) {
            // 가속 구간: 2t^2
            return 2 * t * t;
        } else {
            // 감속 구간: 1 - (-2t + 2)^2 / 2
            return 1 - Math.pow(-2 * t + 2, 2) / 2;
        }
    }

    /**
     * 현재 알파 값을 반환합니다.
     * 
     * @return 알파 값 (0.0 = REAL, 1.0 = FAKE)
     */
    public double getAlpha() {
        return currentAlpha.get();
    }

    /**
     * 전환이 진행 중인지 확인합니다.
     * 
     * @return true = 전환 중
     */
    public boolean isTransitioning() {
        return Math.abs(currentAlpha.get() - targetAlpha.get()) > 0.001;
    }
}
