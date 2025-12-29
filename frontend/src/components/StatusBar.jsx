import { useEffect, useState } from 'react';
import { getCurrentTime } from '../lib/time';

/**
 * StatusBar component - displays connection status, mode, confidence, and time
 */
export default function StatusBar({ connectionState, mode, confidence }) {
    const [currentTime, setCurrentTime] = useState(getCurrentTime());

    useEffect(() => {
        const interval = setInterval(() => {
            setCurrentTime(getCurrentTime());
        }, 1000);
        return () => clearInterval(interval);
    }, []);

    const getStatusColor = (state) => {
        switch (state) {
            case 'CONNECTED': return 'var(--status-connected)';
            case 'CONNECTING': return 'var(--status-connecting)';
            default: return 'var(--status-disconnected)';
        }
    };

    const getModeColor = (m) => {
        switch (m) {
            case 'REAL': return 'var(--mode-real)';
            case 'FAKE': return 'var(--mode-fake)';
            case 'XFADING': return 'var(--mode-xfading)';
            default: return 'var(--text-secondary)';
        }
    };

    return (
        <div className="status-bar">
            <div className="status-item">
                <span className="status-label">연결:</span>
                <span
                    className="status-value"
                    style={{ color: getStatusColor(connectionState) }}
                >
                    <span
                        className="status-dot"
                        style={{ backgroundColor: getStatusColor(connectionState) }}
                    />
                    {connectionState}
                </span>
            </div>

            <div className="status-item">
                <span className="status-label">모드:</span>
                <span
                    className="status-value mode-badge"
                    style={{
                        backgroundColor: getModeColor(mode),
                        color: '#fff'
                    }}
                >
                    {mode}
                </span>
            </div>

            <div className="status-item">
                <span className="status-label">Confidence:</span>
                <span className="status-value confidence-value">
                    {confidence !== null ? confidence.toFixed(2) : '--'}
                </span>
            </div>

            <div className="status-item">
                <span className="status-label">시간:</span>
                <span className="status-value time-value">{currentTime}</span>
            </div>
        </div>
    );
}
