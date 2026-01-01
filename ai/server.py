# engine_server.py
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import asyncio
import time
import json

app = FastAPI()

# ✅ 개발 중엔 일단 전부 허용 (나중에 origin 제한)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
    "http://localhost:5173",
    "http://127.0.0.1:5173",
],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# -----------------------------
# 상태 (최소)
# -----------------------------
STATE = {
    "mode": "REAL",            # REAL | FAKE | XFADING
    "ratio": 0.0,              # 0~1
    "lockedFake": False,
    "pauseFake": False,
    "forceReal": False,
    "reasons": [],
    "warmingUp": False,
    "warmupTotalSec": 120,
    "warmupRemainingSec": 0,
    "transition": "blackout",
    "reaction": None,
    "notice": None,
}

def now_ts():
    return time.time()

# -----------------------------
# WS: /ws/state (브로드캐스트)
# -----------------------------
class WSManager:
    def __init__(self):
        self.clients: set[WebSocket] = set()

    async def connect(self, ws: WebSocket):
        await ws.accept()
        self.clients.add(ws)
        await self.send(ws, STATE)

    def disconnect(self, ws: WebSocket):
        self.clients.discard(ws)

    async def send(self, ws: WebSocket, data: dict):
        await ws.send_json(data)

    async def broadcast(self, data: dict):
        dead = []
        for c in list(self.clients):
            try:
                await c.send_json(data)
            except Exception:
                dead.append(c)
        for c in dead:
            self.disconnect(c)

ws_manager = WSManager()

async def push_state():
    await ws_manager.broadcast(STATE)

@app.websocket("/ws/state")
async def ws_state(ws: WebSocket):
    await ws_manager.connect(ws)
    try:
        while True:
            msg = await ws.receive_text()
            # ping 처리(프론트 wsClient가 ping 보냄)
            if msg == "ping":
                await ws.send_text("pong")
    except WebSocketDisconnect:
        ws_manager.disconnect(ws)

# -----------------------------
# REST: /state
# -----------------------------
@app.get("/state")
async def get_state():
    return STATE

# -----------------------------
# Control APIs
# -----------------------------
class BoolPayload(BaseModel):
    value: bool

class StrPayload(BaseModel):
    value: str

@app.post("/control/pause_fake")
async def pause_fake(p: BoolPayload):
    STATE["pauseFake"] = p.value
    await push_state()
    return {"ok": True, "pauseFake": STATE["pauseFake"]}

@app.post("/control/force_real")
async def force_real(p: BoolPayload):
    STATE["forceReal"] = p.value
    # forceReal이면 REAL로 강제한다고 가정(필요시 너 엔진 로직에 연결)
    if p.value:
        STATE["mode"] = "REAL"
        STATE["ratio"] = 0.0
    await push_state()
    return {"ok": True, "forceReal": STATE["forceReal"]}

@app.post("/control/reset_lock")
async def reset_lock():
    STATE["lockedFake"] = False
    STATE["reasons"] = []
    STATE["notice"] = "락 초기화 완료"
    await push_state()
    # notice는 한번만 쓰는게 보통이라 바로 비움(원하면 유지)
    STATE["notice"] = None
    return {"ok": True}

@app.post("/control/transition")
async def set_transition(p: StrPayload):
    STATE["transition"] = p.value
    await push_state()
    return {"ok": True, "transition": STATE["transition"]}

# -----------------------------
# Trigger API (FaceDetector → Engine)
# -----------------------------
class TriggerPayload(BaseModel):
    distracted: bool
    reason: str | None = None
    ts: float | None = None


@app.post("/trigger")
async def trigger_event(p: TriggerPayload):
    """
    FaceDetector에서 딴짓 감지 시 호출됨
    """
    if p.distracted:
        STATE["mode"] = "FAKE"
        STATE["lockedFake"] = True
        STATE["reasons"] = [p.reason] if p.reason else []
        STATE["notice"] = "딴짓 감지됨"
    else:
        STATE["mode"] = "REAL"
        STATE["lockedFake"] = False
        STATE["reasons"] = []
        STATE["notice"] = "집중 상태 복귀"

    await push_state()

    # notice는 일회성
    STATE["notice"] = None

    return {
        "ok": True,
        "mode": STATE["mode"],
        "reason": p.reason,
        "ts": p.ts,
    }
    
# -----------------------------
# WS: /ws/ai (AI 채널)
# -----------------------------
class AIWSManager:
    def __init__(self):
        self.clients: set[WebSocket] = set()

    async def connect(self, ws: WebSocket):
        await ws.accept()
        self.clients.add(ws)
        # 연결 즉시 hello + 현재 상태(선택)
        await ws.send_json({
            "type": "hello",
            "ok": True,
            "server": "engine_server",
            "state": STATE,
        })

    def disconnect(self, ws: WebSocket):
        self.clients.discard(ws)

    async def send(self, ws: WebSocket, data: dict):
        await ws.send_json(data)

    async def broadcast(self, data: dict):
        dead = []
        for c in list(self.clients):
            try:
                await c.send_json(data)
            except Exception:
                dead.append(c)
        for c in dead:
            self.disconnect(c)

ai_ws_manager = AIWSManager()

def _set_reaction(text: str):
    """
    프론트가 STT/상황을 보내면
    대시보드에 토스트로 뜨게 reaction을 STATE에 넣고 ws/state로 push
    """
    STATE["reaction"] = text

async def _push_reaction_once(text: str):
    _set_reaction(text)
    await push_state()
    # reaction은 1회성으로 쓰고 지우는게 UX 좋음
    STATE["reaction"] = None

@app.websocket("/ws/ai")
async def ws_ai(ws: WebSocket):
    await ai_ws_manager.connect(ws)

    try:
        while True:
            text = await ws.receive_text()   # ✅ 프론트는 항상 text로 보냄
            if text == "ping":
                await ws.send_text("pong")
                continue

            # ✅ JSON 문자열이면 파싱 시도
            data = None
            try:
                data = json.loads(text)
            except Exception:
                # JSON이 아니면 그냥 echo ack
                await ai_ws_manager.send(ws, {"type": "ack", "ok": True, "echo": text})
                continue

            mtype = data.get("type")

            # ✅ FaceDetector가 보내는 딴짓 reaction 요청
            if mtype == "reaction_request":
                reaction = "집중이 필요해 보여요 👀"
                await ai_ws_manager.send(ws, {
                    "type": "reaction",
                    "ok": True,
                    "reaction": reaction,
                })
                await _push_reaction_once(reaction)
                continue

            # ✅ ping (json)
            if mtype == "ping":
                await ai_ws_manager.send(ws, {"type": "pong"})
                continue

            # ✅ STT transcript
            if mtype in ("transcript", "stt", "utterance"):
                t = (data.get("text") or "").strip()
                if t:
                    reaction = f"말씀 요약: {t[:60]}" if len(t) <= 60 else f"말씀 요약: {t[:60]}..."
                    await ai_ws_manager.send(ws, {"type": "reaction", "ok": True, "reaction": reaction})
                    await _push_reaction_once(reaction)
                else:
                    await ai_ws_manager.send(ws, {"type": "reaction", "ok": False, "error": "empty_text"})
                continue

            # ✅ event
            if mtype == "event":
                name = data.get("name") or "unknown"
                reasons = data.get("reasons") or []
                STATE["reasons"] = reasons if isinstance(reasons, list) else [str(reasons)]
                STATE["notice"] = f"이벤트 수신: {name}"
                await push_state()
                STATE["notice"] = None
                await ai_ws_manager.send(ws, {"type": "event_ack", "ok": True, "name": name})
                continue

            # ✅ default ack
            await ai_ws_manager.send(ws, {"type": "ack", "ok": True, "received": data})

    except WebSocketDisconnect:
        pass
    finally:
        ai_ws_manager.disconnect(ws)