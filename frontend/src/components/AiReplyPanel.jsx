import { useState } from 'react';
import { requestAiReply, requestMacroType } from '../lib/api';

/**
 * AiReplyPanel component - AI reply generation with mock support
 */
export default function AiReplyPanel({ transcript, mockMode, addToast }) {
    const [tone, setTone] = useState('polite');
    const [candidates, setCandidates] = useState([]);
    const [isLoading, setIsLoading] = useState(false);

    const handleGenerateReply = async () => {
        const inputText = transcript?.slice(-500) || '';

        if (!inputText.trim()) {
            addToast?.('transcript가 비어있습니다', 'error');
            return;
        }

        setIsLoading(true);
        setCandidates([]);

        try {
            const response = await requestAiReply(inputText, tone, mockMode);
            setCandidates(response.candidates || []);
            addToast?.('답변 생성 완료', 'success');
        } catch (error) {
            console.error('Failed to generate reply:', error);
            addToast?.('답변 생성 실패', 'error');
        } finally {
            setIsLoading(false);
        }
    };

    const copyToClipboard = (text) => {
        navigator.clipboard.writeText(text)
            .then(() => addToast?.('클립보드에 복사됨', 'success'))
            .catch(() => addToast?.('복사 실패', 'error'));
    };

    const handleAutoType = async (text) => {
        addToast?.('채팅 입력 요청 중...', 'success');

        const result = await requestMacroType(text, mockMode);

        if (result.success) {
            addToast?.(result.message, 'success');
        } else {
            addToast?.(result.message, 'error');
        }
    };

    return (
        <div className="panel ai-reply-panel">
            <h2 className="panel-title">AI Reply</h2>

            {/* Transcript Preview */}
            <div className="ai-transcript-preview">
                <label>입력 텍스트 (최근 500자):</label>
                <div className="transcript-preview-text">
                    {transcript?.slice(-500) || '(transcript 없음)'}
                </div>
            </div>

            {/* Tone Selection */}
            <div className="ai-tone-select">
                <label>답변 톤:</label>
                <div className="tone-buttons">
                    {[
                        { value: 'short', label: '짧게' },
                        { value: 'polite', label: '정중하게' },
                        { value: 'casual', label: '캐주얼' }
                    ].map(({ value, label }) => (
                        <button
                            key={value}
                            className={`btn btn-small ${tone === value ? 'btn-active' : ''}`}
                            onClick={() => setTone(value)}
                        >
                            {label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Generate Button */}
            <button
                className="btn btn-primary btn-full"
                onClick={handleGenerateReply}
                disabled={isLoading}
            >
                {isLoading ? '생성 중...' : '🤖 답변 생성'}
            </button>

            {/* Candidates List */}
            <div className="ai-candidates">
                {candidates.length === 0 && !isLoading && (
                    <div className="candidates-empty">
                        답변을 생성하려면 버튼을 클릭하세요
                    </div>
                )}

                {isLoading && (
                    <div className="candidates-loading">
                        <div className="spinner"></div>
                        답변 생성 중...
                    </div>
                )}

                {candidates.map((candidate, index) => (
                    <div key={index} className="candidate-item">
                        <span className="candidate-number">{index + 1}</span>
                        <p className="candidate-text">{candidate}</p>
                        <div className="candidate-actions">
                            <button
                                className="btn btn-icon"
                                onClick={() => copyToClipboard(candidate)}
                                title="복사"
                            >
                                📋
                            </button>
                            <button
                                className="btn btn-icon"
                                onClick={() => handleAutoType(candidate)}
                                title="채팅 자동 입력"
                            >
                                ⌨️
                            </button>
                        </div>
                    </div>
                ))}
            </div>

            {/* Mock Mode Indicator */}
            {mockMode && (
                <div className="mock-indicator">
                    ⚠️ Mock Mode - 실제 API 호출 없음
                </div>
            )}
        </div>
    );
}
