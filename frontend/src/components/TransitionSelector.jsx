// src/components/TransitionSelector.jsx
import { useState } from "react";

export default function TransitionSelector({ addToast, onApply }) {
    const [effect, setEffect] = useState("blackout");

    const apply = async () => {
        try {
            if (!onApply) {
                addToast?.("onApply가 연결되지 않았습니다", "error");
                return;
            }
            await onApply(effect);
        } catch (e) {
            console.error(e);
            addToast?.("전환 효과 적용 실패", "error");
        }
    };

    return (
        <div className="panel transition-panel">
            <h2 className="panel-title">Transition</h2>

            <div className="transition-selector-card">
                <div className="selector-title">전환 효과 설정</div>
                <div className="selector-row">
                    <select
                        className="selector-input"
                        value={effect}
                        onChange={(e) => setEffect(e.target.value)}
                    >
                        <option value="blackout">Blackout (암전→페이드인)</option>
                        <option value="falling">Falling (떨어짐)</option>
                    </select>

                    <button className="btn btn-primary btn-apply" onClick={apply}>
                        적용
                    </button>
                </div>
            </div>
        </div>
    );
}
