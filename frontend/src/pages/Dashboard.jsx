import { useState, useEffect, useCallback } from 'react';
import VideoPreview from '../components/VideoPreview';
import SttPanel from '../components/SttPanel';
import Toast, { useToast } from '../components/Toast';
import '../styles/dashboard.css';

/**
 * Dashboard page - simplified version with video, switch buttons, and STT only
 */
export default function Dashboard() {
    // State
    const [mode, setMode] = useState('REAL');
    const [isTransitioning, setIsTransitioning] = useState(false);

    const { toasts, addToast, removeToast } = useToast();

    // Mode switch handler
    const handleSwitchMode = useCallback((target) => {
        if (isTransitioning || mode === target) return;

        setIsTransitioning(true);
        setMode('XFADING');

        // After fade duration, set target mode
        setTimeout(() => {
            setMode(target);
            setIsTransitioning(false);
        }, 500);

        addToast(`${target} 모드로 전환`, 'success');
    }, [mode, isTransitioning, addToast]);

    return (
        <div className="dashboard simple">
            {/* Main Content */}
            <div className="simple-layout">
                {/* Video Preview - Full Width */}
                <div className="video-section">
                    <VideoPreview
                        mode={mode}
                        addToast={addToast}
                    />
                </div>

                {/* Control Bar */}
                <div className="control-bar">
                    {/* Mode Switch Buttons */}
                    <div className="switch-buttons">
                        <button
                            className={`btn btn-large ${mode === 'FAKE' ? 'btn-active' : 'btn-primary'}`}
                            onClick={() => handleSwitchMode('FAKE')}
                            disabled={mode === 'FAKE' || isTransitioning}
                        >
                            FAKE 전환
                        </button>
                        <button
                            className={`btn btn-large ${mode === 'REAL' ? 'btn-active' : 'btn-secondary'}`}
                            onClick={() => handleSwitchMode('REAL')}
                            disabled={mode === 'REAL' || isTransitioning}
                        >
                            REAL 복귀
                        </button>
                    </div>

                    {/* Current Mode Display */}
                    <div className="mode-display">
                        <span className={`mode-indicator ${mode.toLowerCase()}`}>
                            현재: <strong>{mode}</strong>
                        </span>
                    </div>
                </div>

                {/* STT Panel */}
                <div className="stt-section">
                    <SttPanel addToast={addToast} />
                </div>
            </div>

            {/* Toast Notifications */}
            <Toast toasts={toasts} onRemove={removeToast} />
        </div>
    );
}
