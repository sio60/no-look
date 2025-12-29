package com.nolook.backend.core;

import lombok.Getter;
import org.springframework.stereotype.Component;

import java.util.concurrent.atomic.AtomicReference;

@Component
@Getter
public class VideoState {

    public enum Mode {
        REAL, FAKE, XFADING
    }

    private final AtomicReference<Double> currentAlpha = new AtomicReference<>(0.0);
    private final AtomicReference<Double> targetAlpha = new AtomicReference<>(0.0);
    private final AtomicReference<Mode> currentMode = new AtomicReference<>(Mode.REAL);

    private static final double STEP = 1.0 / 15.0; // 0.5s transition at 30fps

    /**
     * Updates alpha value towards the target.
     * Called in the video processing loop.
     */
    public void updateAlpha() {
        double current = currentAlpha.get();
        double target = targetAlpha.get();

        if (Math.abs(current - target) < 0.01) {
            currentAlpha.set(target);
            return;
        }

        if (current < target) {
            currentAlpha.set(Math.min(target, current + STEP));
        } else {
            currentAlpha.set(Math.max(target, current - STEP));
        }
    }

    public void setTarget(Mode mode) {
        if (mode == Mode.FAKE) {
            targetAlpha.set(1.0);
        } else {
            targetAlpha.set(0.0);
        }
        currentMode.set(mode);
    }

    public double getAlpha() {
        return currentAlpha.get();
    }
}
