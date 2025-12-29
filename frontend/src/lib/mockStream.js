/**
 * Mock event stream generator for testing without backend
 */

import { getTimestamp } from './time';

class MockStream {
    constructor() {
        this.intervalId = null;
        this.onEvent = null;
        this.isRunning = false;
    }

    start() {
        if (this.isRunning) return;
        this.isRunning = true;
        this.scheduleNextEvent();
    }

    stop() {
        this.isRunning = false;
        if (this.intervalId) {
            clearTimeout(this.intervalId);
            this.intervalId = null;
        }
    }

    scheduleNextEvent() {
        if (!this.isRunning) return;

        // Random interval between 300ms and 900ms
        const delay = Math.random() * 600 + 300;

        this.intervalId = setTimeout(() => {
            this.emitEvent();
            this.scheduleNextEvent();
        }, delay);
    }

    emitEvent() {
        if (!this.onEvent) return;

        const event = this.generateAiEvent();
        this.onEvent(event);
    }

    generateAiEvent() {
        return {
            type: 'ai_event',
            ts: getTimestamp(),
            gaze_off: Math.random() < 0.25, // 25% chance
            yaw: this.randomFloat(-20, 20),
            pitch: this.randomFloat(-20, 20),
            confidence: this.randomFloat(0.4, 1.0)
        };
    }

    randomFloat(min, max) {
        return Math.round((Math.random() * (max - min) + min) * 100) / 100;
    }
}

// Singleton instance
export const mockStream = new MockStream();

/**
 * Generate a single mock AI event
 * @returns {Object} Mock event object
 */
export function generateMockEvent() {
    return new MockStream().generateAiEvent();
}

/**
 * Generate mock video status
 * @param {string} mode - REAL, FAKE, or XFADING
 * @param {number} fadeMs - Fade duration in ms
 * @returns {Object} Video status object
 */
export function generateVideoStatus(mode, fadeMs = 500) {
    return {
        type: 'video_status',
        mode,
        fade_ms: fadeMs
    };
}
