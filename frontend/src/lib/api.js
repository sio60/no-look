// web/src/lib/api.js

// Production: served from same origin via FastAPI
// Development: proxied via vite.config.js
const API_BASE_URL = '/api';

// -----------------------------
// Small helpers
// -----------------------------
async function safeJson(res) {
    const text = await res.text().catch(() => '');
    try {
        return text ? JSON.parse(text) : {};
    } catch {
        return { ok: false, message: `Invalid JSON response (${res.status})`, raw: text };
    }
}

async function postJson(url, body) {
    const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body ?? {}),
    });
    const data = await safeJson(res);
    // 백엔드가 ok 필드를 안 주는 경우 대비
    if (typeof data.ok === 'undefined') data.ok = res.ok;
    if (!res.ok && !data.message) data.message = `HTTP ${res.status}`;
    return data;
}

function pickToneLabel(tone) {
    if (tone === 'short') return '짧게';
    if (tone === 'casual') return '캐주얼';
    return '정중하게';
}

function buildMockCandidates(transcript, tone) {
    const t = (transcript || '').trim();
    const short = t.slice(-120);

    const base = {
        short: [
            '네, 확인했습니다.',
            '좋아요. 그렇게 진행하겠습니다.',
            '잠시만요, 바로 확인할게요.',
            '네. 다음 단계로 넘어가면 될까요?',
        ],
        polite: [
            '네, 말씀 주신 내용 확인했습니다. 해당 방향으로 진행하겠습니다.',
            '좋은 의견 감사합니다. 정리해서 공유드리겠습니다.',
            '확인 후 반영해서 다시 말씀드릴게요.',
            '네, 지금 상황 기준으로는 그렇게 진행하는 게 가장 깔끔합니다.',
        ],
        casual: [
            '오케이! 그럼 그렇게 가자.',
            '좋아, 일단 그 방향으로 ㄱㄱ',
            'ㅇㅋ 확인했어. 바로 처리할게.',
            '잠깐만! 이것만 체크하고 말해줄게.',
        ],
    };

    const toneSet = base[tone] || base.polite;

    // 입력 텍스트가 있으면 마지막 문맥을 살짝 섞어줌
    const contextHint =
        short.length > 0
            ? ` (방금 말: "${short.replace(/\s+/g, ' ').slice(0, 60)}...")`
            : '';

    // 후보 3~5개
    const candidates = [
        toneSet[0] + contextHint,
        toneSet[1],
        toneSet[2],
        toneSet[3],
    ].filter(Boolean);

    return candidates;
}

function buildMockMacroResult(text) {
    const t = (text || '').trim();
    if (!t) return { success: false, message: '입력할 텍스트가 비어있습니다.' };
    // 실제 매크로는 못 치지만, UI 테스트용 성공 응답
    return {
        success: true,
        message: `Mock: 채팅 입력 요청 완료 (${Math.min(t.length, 80)}자)`,
    };
}

// -----------------------------
// Engine controls
// -----------------------------
export async function setPauseFake(value) {
    return postJson(`${API_BASE_URL}/control/pause_fake`, { value });
}

export async function setForceReal(value) {
    return postJson(`${API_BASE_URL}/control/force_real`, { value });
}

export async function resetLock() {
    return postJson(`${API_BASE_URL}/control/reset_lock`, {});
}

export async function fetchEngineState() {
    const res = await fetch(`${API_BASE_URL}/state`);
    const data = await safeJson(res);
    if (typeof data.ok === 'undefined') data.ok = res.ok;
    return data;
}

export async function setTransitionEffect(effectName) {
    return postJson(`${API_BASE_URL}/control/transition`, { value: effectName });
}

// -----------------------------
// AI Reply (mock/real)
// -----------------------------
/**
 * @param {string} transcript - input text (recent)
 * @param {'short'|'polite'|'casual'} tone
 * @param {boolean} useMock
 * @returns {Promise<{candidates: string[]}>}
 */
export async function requestAiReply(transcript, tone = 'polite', useMock = true) {
    const input = (transcript || '').trim();
    if (!input) return { candidates: [] };

    if (useMock) {
        return { candidates: buildMockCandidates(input, tone) };
    }

    // ✅ Real backend call (you can implement these endpoints in FastAPI)
    // Expected: { candidates: [...] }
    // If backend returns {ok:false,message}, handle gracefully.
    const data = await postJson(`${API_BASE_URL}/ai/reply`, {
        transcript: input,
        tone,
    });

    if (!data.ok) {
        // fallback to mock-like candidates so UI doesn't feel dead
        return {
            candidates: [
                `[서버 오류] ${data.message || 'AI reply failed'} — 일단 임시 답변입니다.`,
                ...buildMockCandidates(input, tone).slice(0, 3),
            ],
        };
    }

    if (Array.isArray(data.candidates)) return { candidates: data.candidates };

    // 백엔드가 candidates 대신 다른 키로 주는 경우 방어
    if (Array.isArray(data.data?.candidates)) return { candidates: data.data.candidates };

    return { candidates: buildMockCandidates(input, tone) };
}

// -----------------------------
// Macro typing (mock/real)
// -----------------------------
/**
 * @param {string} text
 * @param {boolean} useMock
 * @returns {Promise<{success: boolean, message: string}>}
 */
export async function requestMacroType(text, useMock = true) {
    const t = (text || '').trim();
    if (!t) return { success: false, message: '입력할 텍스트가 비어있습니다.' };

    if (useMock) {
        return buildMockMacroResult(t);
    }

    // ✅ Real backend call
    // Expected: { success: true/false, message: "..." }
    const data = await postJson(`${API_BASE_URL}/macro/type`, { text: t });

    // 서버 응답 규격 방어
    if (typeof data.success === 'boolean') {
        return { success: data.success, message: data.message || (data.success ? '입력 완료' : '입력 실패') };
    }
    if (!data.ok) {
        return { success: false, message: data.message || 'macro type failed' };
    }

    // ok인데 success가 없다면 ok 기반으로
    return { success: !!data.ok, message: data.message || (data.ok ? '입력 완료' : '입력 실패') };
}
