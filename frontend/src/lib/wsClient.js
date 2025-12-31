const WS_URL = 'ws://127.0.0.1:8000/ws/state';

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
        if (this.ws && this.ws.readyState === WebSocket.OPEN) return;

        this.setState(ConnectionState.CONNECTING);

        this.ws = new WebSocket(WS_URL);

        this.ws.onopen = () => {
            this.setState(ConnectionState.CONNECTED);

            // 서버 ws_state가 receive_text()로 대기하므로 keep-alive ping
            this.pingTimer = setInterval(() => {
                if (this.ws && this.ws.readyState === WebSocket.OPEN) {
                    this.ws.send('ping');
                }
            }, 8000);
        };

        this.ws.onclose = () => {
            this.cleanup();
            this.setState(ConnectionState.DISCONNECTED);
        };

        this.ws.onerror = () => {
            this.cleanup();
            this.setState(ConnectionState.DISCONNECTED);
        };

        this.ws.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                // data = { mode, ratio, lockedFake, pauseFake, forceReal, reasons, reaction, timestamp }
                this.onMessage?.(data);
            } catch (e) {
                console.error('WS parse failed:', e);
            }
        };
    }

    cleanup() {
        if (this.pingTimer) {
            clearInterval(this.pingTimer);
            this.pingTimer = null;
        }
        this.ws = null;
    }

    disconnect() {
        this.cleanup();
        if (this.ws) this.ws.close();
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
