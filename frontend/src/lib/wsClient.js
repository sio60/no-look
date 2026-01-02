// src/lib/wsClient.js

const getWsUrl = () => {
    // DEV: FastAPI(8000)로 직접 연결 (Vite proxy 필요 없음)
    if (import.meta.env.DEV) return 'ws://127.0.0.1:8000/ws/state';

    // PROD: same-origin
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${protocol}//${window.location.host}/ws/state`;
};

const WS_URL = getWsUrl();

export const ConnectionState = {
    CONNECTED: 'CONNECTED',
    CONNECTING: 'CONNECTING',
    DISCONNECTED: 'DISCONNECTED',
};

class WSClient {
    constructor() {
        this.ws = null;
        this.state = ConnectionState.DISCONNECTED;
        this.onStateChange = null;
        this.onMessage = null;
        this.pingTimer = null;
    }

    connect() {
        if (this.ws && (
            this.ws.readyState === WebSocket.OPEN ||
            this.ws.readyState === WebSocket.CONNECTING
        )) return;

        this.setState(ConnectionState.CONNECTING);

        const ws = new WebSocket(WS_URL);
        this.ws = ws;

        ws.onopen = () => {
            if (this.ws !== ws) return;

            this.setState(ConnectionState.CONNECTED);

            this.pingTimer = setInterval(() => {
                if (this.ws && this.ws.readyState === WebSocket.OPEN) {
                    this.ws.send('ping');
                }
            }, 8000);
        };

        ws.onmessage = (event) => {
            if (this.ws !== ws) return;
            try {
                const data = JSON.parse(event.data);
                this.onMessage?.(data);
            } catch (e) {
                console.error('WS parse failed:', e);
            }
        };

        ws.onclose = () => {
            if (this.ws !== ws) return;
            this.cleanup();
            this.setState(ConnectionState.DISCONNECTED);
        };

        ws.onerror = () => {
            if (this.ws !== ws) return;
            this.cleanup();
            this.setState(ConnectionState.DISCONNECTED);
        };
    }

    cleanup() {
        if (this.pingTimer) {
            clearInterval(this.pingTimer);
            this.pingTimer = null;
        }
        if (this.ws) {
            this.ws.onopen = null;
            this.ws.onclose = null;
            this.ws.onerror = null;
            this.ws.onmessage = null;
        }
        this.ws = null;
    }

    disconnect() {
        const ws = this.ws;
        this.cleanup();
        try { ws?.close(1000, 'client disconnect'); } catch { }
        this.setState(ConnectionState.DISCONNECTED);
    }

    setState(state) {
        this.state = state;
        this.onStateChange?.(state);
    }

    getState() {
        return this.state;
    }
}

export const wsClient = new WSClient();
