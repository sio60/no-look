package com.nolook.backend.controller;

import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import com.nolook.backend.core.VideoState;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.lang.NonNull;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.TextWebSocketHandler;

/**
 * 프론트엔드로부터 WebSocket 메시지를 수신하여 비디오 전환을 제어합니다.
 * 
 * @패키지출처 org.springframework.web.socket.handler.TextWebSocketHandler
 * @기능 switch 명령 수신, VideoState 모드 변경
 * @엔드포인트 ws://localhost:8080/ws
 */
@Component
public class TriggerController extends TextWebSocketHandler {

    /**
     * VideoState 의존성 주입
     * 
     * @기능 REAL/FAKE 모드 전환 및 알파 관리
     */
    private final VideoState videoState;

    /**
     * 기본 전환 시간 (ms)
     * 
     * @설정 application.properties → video.transition.default-ms
     */
    @Value("${video.transition.default-ms:300}")
    private double defaultFadeMs;

    public TriggerController(VideoState videoState) {
        this.videoState = videoState;
    }

    /**
     * WebSocket 텍스트 메시지 수신 핸들러
     * 
     * @패키지출처 org.springframework.web.socket.handler.TextWebSocketHandler.handleTextMessage
     * @param session 클라이언트 WebSocket 세션
     * @param message 수신된 메시지 (JSON 형식)
     * 
     * @메시지형식
     *        {
     *        "type": "switch",
     *        "target": "FAKE" | "REAL",
     *        "fade_ms": 300 // 선택적, 기본값: application.properties 설정
     *        }
     */
    @Override
    @SuppressWarnings("null")
    protected void handleTextMessage(@NonNull WebSocketSession session, @NonNull TextMessage message) {
        try {
            String payload = message.getPayload();

            /**
             * JsonParser - JSON 문자열 파싱
             * 
             * @패키지출처 com.google.gson.JsonParser
             */
            JsonObject json = JsonParser.parseString(payload).getAsJsonObject();

            // ========================================
            // switch 명령 처리
            // ========================================
            if (json.has("type") && "switch".equals(json.get("type").getAsString())) {

                // target 추출 (FAKE 또는 REAL)
                String target = json.get("target").getAsString();
                VideoState.Mode mode = "FAKE".equalsIgnoreCase(target)
                        ? VideoState.Mode.FAKE
                        : VideoState.Mode.REAL;

                // fade_ms 추출 (선택적 파라미터)
                double fadeMs = defaultFadeMs;
                if (json.has("fade_ms")) {
                    fadeMs = json.get("fade_ms").getAsDouble();
                }

                System.out.println("[WS] Switch command: " + mode + " (fade: " + fadeMs + "ms)");

                // VideoState에 전환 명령 전달
                videoState.setTarget(mode, fadeMs);

                // 성공 응답 전송
                JsonObject response = new JsonObject();
                response.addProperty("status", "success");
                response.addProperty("mode", target);
                response.addProperty("fade_ms", fadeMs);

                session.sendMessage(new TextMessage(response.toString()));
            }

            // ========================================
            // status 명령 처리 (상태 조회)
            // ========================================
            else if (json.has("type") && "status".equals(json.get("type").getAsString())) {
                JsonObject response = new JsonObject();
                response.addProperty("mode", videoState.getCurrentMode().get().toString());
                response.addProperty("alpha", videoState.getAlpha());
                response.addProperty("transitioning", videoState.isTransitioning());

                session.sendMessage(new TextMessage(response.toString()));
            }

        } catch (Exception e) {
            System.err.println("[WS] Error processing message: " + e.getMessage());
            e.printStackTrace();
        }
    }

    /**
     * WebSocket 연결 수립 시 호출
     * 
     * @패키지출처 org.springframework.web.socket.handler.TextWebSocketHandler.afterConnectionEstablished
     */
    @Override
    public void afterConnectionEstablished(@NonNull WebSocketSession session) throws Exception {
        System.out.println("[WS] Client connected: " + session.getId());
    }

    /**
     * WebSocket 연결 종료 시 호출
     * 
     * @패키지출처 org.springframework.web.socket.handler.TextWebSocketHandler.afterConnectionClosed
     */
    @Override
    public void afterConnectionClosed(@NonNull WebSocketSession session,
            @NonNull CloseStatus status) throws Exception {
        System.out.println("[WS] Client disconnected: " + session.getId() + " (" + status + ")");
    }
}
