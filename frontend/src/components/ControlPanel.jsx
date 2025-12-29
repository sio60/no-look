import { useMemo } from 'react';

/**
 * ControlPanel component - mode switches, threshold slider, mock toggle, event summary
 */
export default function ControlPanel({
    mode,
    mockMode,
    threshold,
    events,
    onSwitchMode,
    onToggleMock,
    onThresholdChange
}) {
    // Calculate event summary
    const eventSummary = useMemo(() => {
        const now = Date.now() / 1000;
        const oneMinuteAgo = now - 60;

        const recentEvents = events.filter(e => e.ts >= oneMinuteAgo);
        const gazeOffCount = recentEvents.filter(e => e.gaze_off).length;
        const totalCount = recentEvents.length;
        const gazeOffRatio = totalCount > 0 ? (gazeOffCount / totalCount * 100).toFixed(1) : 0;

        const avgConfidence = totalCount > 0
            ? (recentEvents.reduce((sum, e) => sum + e.confidence, 0) / totalCount).toFixed(2)
            : '--';

        return {
            gazeOffRatio,
            eventCount: totalCount,
            avgConfidence
        };
    }, [events]);

    return (
        <div className="panel control-panel">
            <h2 className="panel-title">Control Panel</h2>

            {/* Mode Switch Buttons */}
            <div className="control-section">
                <h3 className="section-title">모드 전환</h3>
                <div className="button-group">
                    <button
                        className={`btn ${mode === 'FAKE' ? 'btn-active' : 'btn-primary'}`}
                        onClick={() => onSwitchMode('FAKE', 500)}
                        disabled={mode === 'FAKE' || mode === 'XFADING'}
                    >
                        FAKE 전환
                    </button>
                    <button
                        className={`btn ${mode === 'REAL' ? 'btn-active' : 'btn-secondary'}`}
                        onClick={() => onSwitchMode('REAL', 500)}
                        disabled={mode === 'REAL' || mode === 'XFADING'}
                    >
                        REAL 복귀
                    </button>
                </div>
            </div>

            {/* Confidence Threshold Slider */}
            <div className="control-section">
                <h3 className="section-title">
                    Confidence Threshold: <span className="threshold-value">{threshold.toFixed(2)}</span>
                </h3>
                <input
                    type="range"
                    className="slider"
                    min="0"
                    max="1"
                    step="0.01"
                    value={threshold}
                    onChange={(e) => onThresholdChange(parseFloat(e.target.value))}
                />
                <div className="slider-labels">
                    <span>0.0</span>
                    <span>1.0</span>
                </div>
            </div>

            {/* Mock Mode Toggle */}
            <div className="control-section">
                <h3 className="section-title">Mock Mode</h3>
                <label className="toggle-label">
                    <div className={`toggle ${mockMode ? 'toggle-on' : ''}`}>
                        <input
                            type="checkbox"
                            checked={mockMode}
                            onChange={(e) => onToggleMock(e.target.checked)}
                        />
                        <span className="toggle-slider"></span>
                    </div>
                    <span className="toggle-text">{mockMode ? 'ON' : 'OFF'}</span>
                </label>
            </div>

            {/* Event Summary */}
            <div className="control-section event-summary">
                <h3 className="section-title">최근 이벤트 요약 (1분)</h3>
                <div className="summary-grid">
                    <div className="summary-item">
                        <span className="summary-label">Gaze Off 비율</span>
                        <span className="summary-value">{eventSummary.gazeOffRatio}%</span>
                    </div>
                    <div className="summary-item">
                        <span className="summary-label">이벤트 수</span>
                        <span className="summary-value">{eventSummary.eventCount}</span>
                    </div>
                    <div className="summary-item">
                        <span className="summary-label">평균 Confidence</span>
                        <span className="summary-value">{eventSummary.avgConfidence}</span>
                    </div>
                </div>
            </div>
        </div>
    );
}
