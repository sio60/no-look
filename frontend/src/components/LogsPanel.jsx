import { useState, useRef, useEffect } from 'react';
import { formatTime } from '../lib/time';

/**
 * LogsPanel component - real-time event logs with filtering and export
 */
export default function LogsPanel({ events, onClear }) {
    const [autoScroll, setAutoScroll] = useState(true);
    const [filterGazeOff, setFilterGazeOff] = useState(false);
    const listRef = useRef(null);

    // Auto-scroll to top when new events arrive
    useEffect(() => {
        if (autoScroll && listRef.current) {
            listRef.current.scrollTop = 0;
        }
    }, [events, autoScroll]);

    // Filter events if needed
    const displayEvents = filterGazeOff
        ? events.filter(e => e.gaze_off)
        : events;

    // Export to JSON
    const handleExport = () => {
        const dataStr = JSON.stringify(events, null, 2);
        const blob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `events_${Date.now()}.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    };

    return (
        <div className="panel logs-panel">
            <h2 className="panel-title">Logs & Events</h2>

            {/* Controls */}
            <div className="logs-controls">
                <button className="btn btn-small" onClick={onClear}>
                    Clear
                </button>
                <button className="btn btn-small" onClick={handleExport}>
                    Export JSON
                </button>
                <label className="checkbox-label">
                    <input
                        type="checkbox"
                        checked={autoScroll}
                        onChange={(e) => setAutoScroll(e.target.checked)}
                    />
                    Auto-scroll
                </label>
                <label className="checkbox-label">
                    <input
                        type="checkbox"
                        checked={filterGazeOff}
                        onChange={(e) => setFilterGazeOff(e.target.checked)}
                    />
                    Gaze Off만
                </label>
            </div>

            {/* Event List */}
            <div className="logs-list" ref={listRef}>
                {displayEvents.length === 0 ? (
                    <div className="logs-empty">이벤트 없음</div>
                ) : (
                    displayEvents.map((event, index) => (
                        <div
                            key={`${event.ts}-${index}`}
                            className={`log-item ${event.gaze_off ? 'gaze-off' : ''}`}
                        >
                            <span className="log-time">{formatTime(event.ts)}</span>
                            <span className={`log-gaze ${event.gaze_off ? 'off' : 'on'}`}>
                                {event.gaze_off ? '⚠ OFF' : '✓ ON'}
                            </span>
                            <span className="log-angles">
                                Y: {event.yaw?.toFixed(1)}° / P: {event.pitch?.toFixed(1)}°
                            </span>
                            <span className="log-confidence">
                                {(event.confidence * 100).toFixed(0)}%
                            </span>
                        </div>
                    ))
                )}
            </div>

            {/* Stats Footer */}
            <div className="logs-footer">
                <span>총 {events.length}개 이벤트</span>
                {filterGazeOff && (
                    <span> | 필터링: {displayEvents.length}개</span>
                )}
            </div>
        </div>
    );
}
