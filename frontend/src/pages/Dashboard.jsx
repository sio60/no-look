import { useEffect, useState, useCallback } from 'react';
import VideoPreview from '../components/VideoPreview';
import SttPanel from '../components/SttPanel';
import Toast, { useToast } from '../components/Toast';
import '../styles/dashboard.css';

import { wsClient } from '../lib/wsClient';
import { setPauseFake, setForceReal, resetLock, fetchEngineState } from '../lib/api';

export default function Dashboard() {
    const { toasts, addToast, removeToast } = useToast();

    const [mode, setMode] = useState('REAL');
    const [ratio, setRatio] = useState(0);
    const [lockedFake, setLockedFake] = useState(false);
    const [pauseFake, setPauseFakeState] = useState(false);
    const [forceReal, setForceRealState] = useState(false);
    const [reasons, setReasons] = useState([]);

    // WS connect
    useEffect(() => {
        // 초기 상태 한번 가져오기(WS 오기 전)
        fetchEngineState()
            .then((s) => {
                setMode(s.mode ?? 'REAL');
                setRatio(s.ratio ?? 0);
                setLockedFake(!!s.lockedFake);
                setPauseFakeState(!!s.pauseFake);
                setForceRealState(!!s.forceReal);
                setReasons(s.reasons ?? []);
            })
            .catch(() => {});

        wsClient.onMessage = (s) => {
            if (!s) return;

            setMode(s.mode ?? 'REAL');
            setRatio(s.ratio ?? 0);
            setLockedFake(!!s.lockedFake);
            setPauseFakeState(!!s.pauseFake);
            setForceRealState(!!s.forceReal);
            setReasons(s.reasons ?? []);

            // 락 처음 걸릴 때 reaction 오면 토스트
            if (s.reaction) addToast(`🤖 ${s.reaction}`, 'success');
        };

        wsClient.connect();

        return () => {
            wsClient.disconnect();
            wsClient.onMessage = null;
        };
    }, [addToast]);

    // Controls
    const togglePauseFake = useCallback(async () => {
        const next = !pauseFake;
        const res = await setPauseFake(next);
        if (res.ok) addToast(`PauseFake: ${next ? 'ON' : 'OFF'}`, 'success');
    }, [pauseFake, addToast]);

    const toggleForceReal = useCallback(async () => {
        const next = !forceReal;
        const res = await setForceReal(next);
        if (res.ok) addToast(`ForceREAL: ${next ? 'ON' : 'OFF'}`, 'success');
    }, [forceReal, addToast]);

    const handleResetLock = useCallback(async () => {
        const res = await resetLock();
        if (res.ok) addToast('락 초기화 완료', 'success');
    }, [addToast]);

    return (
        <div className="dashboard simple">
            <div className="simple-layout">
                <div className="video-section">
                    <VideoPreview
                        mode={mode}
                        ratio={ratio}
                        addToast={addToast}
                    />
                </div>

                <div className="control-bar">
                    <div className="switch-buttons">
                        <button className="btn btn-large btn-primary" onClick={togglePauseFake}>
                            {pauseFake ? 'FAKE 재생 재개' : 'FAKE 재생 일시정지'}
                        </button>

                        <button className="btn btn-large btn-secondary" onClick={toggleForceReal}>
                            {forceReal ? 'Force REAL 해제(자동복귀)' : 'Force REAL(강제복귀)'}
                        </button>

                        <button className="btn btn-large" onClick={handleResetLock}>
                            락 초기화
                        </button>
                    </div>

                    <div className="mode-display">
            <span className={`mode-indicator ${mode.toLowerCase()}`}>
              현재: <strong>{mode}</strong> ({Math.round(ratio * 100)}%)
            </span>
                        <span style={{ marginLeft: 12 }}>
              Locked: <strong>{String(lockedFake)}</strong>
            </span>
                        {!!reasons?.length && (
                            <span style={{ marginLeft: 12 }}>
                Reasons: <strong>{reasons.join(', ')}</strong>
              </span>
                        )}
                    </div>
                </div>

                <div className="stt-section">
                    <SttPanel addToast={addToast} />
                </div>
            </div>

            <Toast toasts={toasts} onRemove={removeToast} />
        </div>
    );
}
