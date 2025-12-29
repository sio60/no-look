package com.nolook.backend.controller;

import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import com.nolook.backend.core.VideoState;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.TextWebSocketHandler;

@Component
public class TriggerController extends TextWebSocketHandler {

    private final VideoState videoState;

    public TriggerController(VideoState videoState) {
        this.videoState = videoState;
    }

    @Override
    protected void handleTextMessage(WebSocketSession session, TextMessage message) {
        try {
            String payload = message.getPayload();
            JsonObject json = JsonParser.parseString(payload).getAsJsonObject();

            if (json.has("type") && "switch".equals(json.get("type").getAsString())) {
                String target = json.get("target").getAsString();
                VideoState.Mode mode = "FAKE".equalsIgnoreCase(target) ? VideoState.Mode.FAKE : VideoState.Mode.REAL;

                System.out.println("[WS] Switching to: " + mode);
                videoState.setTarget(mode);

                // Response
                session.sendMessage(new TextMessage("{\"status\":\"success\",\"mode\":\"" + target + "\"}"));
            }
        } catch (Exception e) {
            System.err.println("[WS] Error: " + e.getMessage());
        }
    }
}
