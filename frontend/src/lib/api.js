// src/lib/api.js
const API_BASE_URL = import.meta.env.VITE_API_BASE || "http://127.0.0.1:8000";

async function safeJson(res) {
    const data = await res.json().catch(() => ({}));
    // 서버가 ok를 안 내려주는 경우도 있어서 기본값 보정
    if (data && typeof data === "object" && !("ok" in data)) {
        data.ok = res.ok;
    }
    return data;
}

/* =========================
 * Engine State / Control
 * ========================= */
export async function fetchEngineState() {
    const res = await fetch(`${API_BASE_URL}/state`);
    return safeJson(res);
}

export async function setPauseFake(value) {
    const res = await fetch(`${API_BASE_URL}/control/pause_fake`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ value }),
    });
    return safeJson(res);
}

export async function setForceReal(value) {
    const res = await fetch(`${API_BASE_URL}/control/force_real`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ value }),
    });
    return safeJson(res);
}

export async function resetLock() {
    const res = await fetch(`${API_BASE_URL}/control/reset_lock`, {
        method: "POST",
    });
    return safeJson(res);
}

export async function setTransitionEffect(effectName) {
    const res = await fetch(`${API_BASE_URL}/control/transition`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ value: effectName }),
    });
    return safeJson(res);
}

/* =========================
 * Trigger / Macro / AI
 * ========================= */
export async function sendTriggerEvent(payload) {
    const res = await fetch(`${API_BASE_URL}/trigger`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
    });
    return safeJson(res);
}

export async function requestMacroType(text, app = "zoom") {
    const res = await fetch(`${API_BASE_URL}/control/macro`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, app }),
    });
    return safeJson(res);
}

// 기존 너 코드 유지 가능하게 자리만 남김
export async function requestAiReply(transcript, tone = "polite", useMock = true) {
    // ✅ 여기 기존 코드 그대로 붙여넣으면 됨
    // return ...
    return { ok: true, reply: "" };
}
