import { useState, useEffect, useRef, useCallback } from 'react';

/**
 * SttPanel component - Web Speech API based speech-to-text
 */
export default function SttPanel({ onTranscriptUpdate, addToast }) {
    const [isListening, setIsListening] = useState(false);
    const [transcript, setTranscript] = useState('');
    const [interimTranscript, setInterimTranscript] = useState('');
    const [isSupported, setIsSupported] = useState(true);
    const [error, setError] = useState(null);
    const recognitionRef = useRef(null);

    useEffect(() => {
        // Check for Web Speech API support
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

        if (!SpeechRecognition) {
            setIsSupported(false);
            setError('브라우저가 음성 인식을 지원하지 않습니다. Chrome을 사용해주세요.');
            return;
        }

        const recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = 'ko-KR';

        recognition.onresult = (event) => {
            let interim = '';
            let final = '';

            for (let i = 0; i < event.results.length; i++) {
                const result = event.results[i];
                if (result.isFinal) {
                    final += result[0].transcript + ' ';
                } else {
                    interim += result[0].transcript;
                }
            }

            if (final) {
                setTranscript(prev => {
                    const newTranscript = prev + final;
                    if (onTranscriptUpdate) {
                        onTranscriptUpdate(newTranscript);
                    }
                    return newTranscript;
                });
            }
            setInterimTranscript(interim);
        };

        recognition.onerror = (event) => {
            console.error('Speech recognition error:', event.error);

            if (event.error === 'not-allowed') {
                setError('마이크 권한이 거부되었습니다. 브라우저 설정에서 허용해주세요.');
                addToast?.('마이크 권한이 필요합니다', 'error');
            } else if (event.error === 'no-speech') {
                // Ignore no-speech error, just restart
            } else {
                setError(`음성 인식 오류: ${event.error}`);
                addToast?.(`음성 인식 오류: ${event.error}`, 'error');
            }

            setIsListening(false);
        };

        recognition.onend = () => {
            if (isListening) {
                // Restart if we're supposed to be listening
                try {
                    recognition.start();
                } catch (e) {
                    console.error('Failed to restart recognition:', e);
                }
            }
        };

        recognitionRef.current = recognition;

        return () => {
            recognition.abort();
        };
    }, [isListening, onTranscriptUpdate, addToast]);

    const startListening = useCallback(() => {
        if (!isSupported || !recognitionRef.current) return;

        setError(null);
        setIsListening(true);

        try {
            recognitionRef.current.start();
            addToast?.('음성 인식 시작', 'success');
        } catch (e) {
            console.error('Failed to start recognition:', e);
            setError('음성 인식을 시작할 수 없습니다.');
        }
    }, [isSupported, addToast]);

    const stopListening = useCallback(() => {
        setIsListening(false);
        setInterimTranscript('');

        if (recognitionRef.current) {
            recognitionRef.current.stop();
        }
        addToast?.('음성 인식 중지', 'success');
    }, [addToast]);

    const copyTranscript = useCallback(() => {
        if (!transcript) return;

        navigator.clipboard.writeText(transcript)
            .then(() => addToast?.('클립보드에 복사됨', 'success'))
            .catch(() => addToast?.('복사 실패', 'error'));
    }, [transcript, addToast]);

    const clearTranscript = useCallback(() => {
        setTranscript('');
        setInterimTranscript('');
        if (onTranscriptUpdate) {
            onTranscriptUpdate('');
        }
    }, [onTranscriptUpdate]);

    return (
        <div className="panel stt-panel">
            <h2 className="panel-title">STT (음성 인식)</h2>

            {/* Error/Warning Display */}
            {error && (
                <div className="stt-error">
                    {error}
                </div>
            )}

            {/* Controls */}
            <div className="stt-controls">
                {isListening ? (
                    <button className="btn btn-danger" onClick={stopListening}>
                        <span className="pulse-dot"></span>
                        STT 중지
                    </button>
                ) : (
                    <button
                        className="btn btn-primary"
                        onClick={startListening}
                        disabled={!isSupported}
                    >
                        🎤 STT 시작
                    </button>
                )}
                <button
                    className="btn btn-small"
                    onClick={copyTranscript}
                    disabled={!transcript}
                >
                    📋 Copy
                </button>
                <button
                    className="btn btn-small"
                    onClick={clearTranscript}
                    disabled={!transcript && !interimTranscript}
                >
                    🗑️ Clear
                </button>
            </div>

            {/* Transcript Display */}
            <div className="stt-transcript">
                {!transcript && !interimTranscript && (
                    <span className="stt-placeholder">
                        {isListening ? '말씀해 주세요...' : '시작 버튼을 눌러주세요'}
                    </span>
                )}
                <span className="stt-final">{transcript}</span>
                {interimTranscript && (
                    <span className="stt-interim">{interimTranscript}</span>
                )}
            </div>

            {/* Status */}
            <div className="stt-status">
                <span className={`status-indicator ${isListening ? 'active' : ''}`}>
                    {isListening ? '🔴 인식 중' : '⚪ 대기 중'}
                </span>
                <span className="char-count">
                    {transcript.length} 글자
                </span>
            </div>
        </div>
    );
}
