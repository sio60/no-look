// src/components/WarmupOverlay.jsx
export default function WarmupOverlay({ totalSec = 120, remainingSec = 0 }) {
    const progress = totalSec > 0 ? (totalSec - remainingSec) / totalSec : 0;

    const mmss = (sec) => {
        const s = Math.max(0, Number(sec || 0));
        const m = String(Math.floor(s / 60)).padStart(2, '0');
        const r = String(Math.floor(s % 60)).padStart(2, '0');
        return `${m}:${r}`;
    };

    return (
        <div className="warmup-overlay">
            <div className="warmup-card">
                <div className="warmup-title">녹화 중입니다</div>
                <div className="warmup-desc">{totalSec}초 동안 가만히 있어주세요</div>
                <div className="warmup-timer">{mmss(remainingSec)}</div>
                <div className="warmup-bar">
                    <div
                        className="warmup-bar-fill"
                        style={{ width: `${Math.min(100, Math.max(0, progress * 100))}%` }}
                    />
                </div>
                <div className="warmup-sub">녹화가 끝나면 자동으로 추적을 시작해요.</div>
            </div>
        </div>
    );
}
