// src/lib/ws/wsClient.js
const API_BASE = import.meta.env.VITE_API_BASE || 'http://127.0.0.1:8000';
const WS_URL = API_BASE.replace('http', 'ws') + '/ws/state';

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
                if (this.ws?.readyState === WebSocket.OPEN) this.ws.send('ping');
            }, 8000);
        };

        ws.onmessage = (event) => {
            if (this.ws !== ws) return;
            try { this.onMessage?.(JSON.parse(event.data)); } catch { }
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
        if (this.pingTimer) clearInterval(this.pingTimer);
        this.pingTimer = null;

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
}

export const wsClient = new WSClient();
