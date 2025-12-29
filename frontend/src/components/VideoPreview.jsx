import { useRef, useEffect, useState, useCallback } from 'react';


export default function VideoPreview({ mode, addToast }) {
    const realVideoRef = useRef(null);
    const fakeCanvasRef = useRef(null);
    const streamRef = useRef(null);
    const animationRef = useRef(null);

    const [hasPermission, setHasPermission] = useState(null);
    const [error, setError] = useState(null);
    const [isTransitioning, setIsTransitioning] = useState(false);

    // Start webcam
    const startWebcam = useCallback(async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { width: 320, height: 240 },
            });

            streamRef.current = stream;

            if (realVideoRef.current) {
                realVideoRef.current.srcObject = stream;
            }

            setHasPermission(true);
            setError(null);

        } catch (err) {
            console.error('Webcam error:', err);
            setHasPermission(false);

            if (err.name === 'NotAllowedError') {
                setError('카메라 권한이 거부되었습니다');
                addToast?.('카메라 권한이 필요합니다', 'error');
            } else if (err.name === 'NotFoundError') {
                setError('카메라를 찾을 수 없습니다');
                addToast?.('카메라가 연결되어 있지 않습니다', 'error');
            } else {
                setError(`카메라 오류: ${err.message}`);
                addToast?.('카메라 연결 실패', 'error');
            }
        }
    }, [addToast]);

    // Stop webcam
    const stopWebcam = useCallback(() => {
        if (streamRef.current) {
            streamRef.current.getTracks().forEach((track) => track.stop());
            streamRef.current = null;
        }
        if (animationRef.current) {
            cancelAnimationFrame(animationRef.current);
            animationRef.current = null;
        }
    }, []);

    // Apply grayscale filter to canvas
    const applyFakeFilter = useCallback(() => {
        const video = realVideoRef.current;
        const canvas = fakeCanvasRef.current;

        if (!video || !canvas || !video.videoWidth) return;

        const ctx = canvas.getContext('2d');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;

        const drawFrame = () => {
            if (!video.paused && !video.ended) {
                ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

                const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                const data = imageData.data;

                for (let i = 0; i < data.length; i += 4) {
                    const avg = (data[i] + data[i + 1] + data[i + 2]) / 3;
                    const adjusted = avg * 1.1 + 10;
                    data[i] = adjusted;
                    data[i + 1] = adjusted;
                    data[i + 2] = adjusted;
                }

                ctx.putImageData(imageData, 0, 0);

                ctx.fillStyle = 'rgba(255, 100, 100, 0.3)';
                ctx.font = 'bold 24px Arial';
                ctx.fillText('FAKE', 10, 30);
            }

            animationRef.current = requestAnimationFrame(drawFrame);
        };

        drawFrame();
    }, []);

    // Initialize webcam on mount
    useEffect(() => {
        startWebcam();
        return stopWebcam;
    }, [startWebcam, stopWebcam]);

    // Start canvas rendering when video is ready
    useEffect(() => {
        const video = realVideoRef.current;

        const handlePlay = () => {
            applyFakeFilter();
        };

        if (video) {
            video.addEventListener('play', handlePlay);
            return () => video.removeEventListener('play', handlePlay);
        }
    }, [applyFakeFilter]);

    // Handle mode transitions
    useEffect(() => {
        if (mode === 'XFADING') {
            setIsTransitioning(true);
            setTimeout(() => setIsTransitioning(false), 500);
        }
    }, [mode]);

    const getPreviewClass = (previewType) => {
        const baseClass = 'preview-box';
        const activeClass = mode === previewType ? 'active' : '';
        const transitionClass = isTransitioning ? 'transitioning' : '';
        return `${baseClass} ${activeClass} ${transitionClass}`;
    };

    return (
        <div className="panel video-preview-panel">
            <h2 className="panel-title">Video Preview</h2>

            {error && (
                <div className="video-error">
                    {error}
                    <button className="btn btn-small" onClick={startWebcam}>
                        다시 시도
                    </button>
                </div>
            )}

            <div className="preview-container">
                <div className={getPreviewClass('REAL')}>
                    <div className="preview-label">REAL</div>
                    <video
                        ref={realVideoRef}
                        autoPlay
                        muted
                        playsInline
                        className="preview-video"
                    />
                    {!hasPermission && hasPermission !== null && (
                        <div className="preview-placeholder">카메라 권한 필요</div>
                    )}
                </div>

                <div className={getPreviewClass('FAKE')}>
                    <div className="preview-label">FAKE</div>
                    <canvas ref={fakeCanvasRef} className="preview-canvas" />
                    {!hasPermission && hasPermission !== null && (
                        <div className="preview-placeholder">카메라 권한 필요</div>
                    )}
                </div>
            </div>

            <div className="preview-mode-indicator">
                <span className={`mode-dot ${mode === 'REAL' ? 'active' : ''}`}>●</span>
                <span className="mode-text">
          현재 모드: <strong>{mode}</strong>
                    {isTransitioning && ' (전환 중...)'}
        </span>
                <span className={`mode-dot ${mode === 'FAKE' ? 'active' : ''}`}>●</span>
            </div>
        </div>
    );
}
