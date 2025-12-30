package com.nolook.backend.config;

import com.nolook.backend.controller.TriggerController;
import org.springframework.context.annotation.Configuration;
import org.springframework.lang.NonNull;
import org.springframework.web.socket.config.annotation.EnableWebSocket;
import org.springframework.web.socket.config.annotation.WebSocketConfigurer;
import org.springframework.web.socket.config.annotation.WebSocketHandlerRegistry;

@Configuration
@EnableWebSocket
public class WebSocketConfig implements WebSocketConfigurer {

    @NonNull
    private final TriggerController triggerController;

    public WebSocketConfig(@NonNull TriggerController triggerController) {
        this.triggerController = triggerController;
    }

    @Override
    public void registerWebSocketHandlers(@NonNull WebSocketHandlerRegistry registry) {
        // Frontend connects to ws://127.0.0.1:8080/ws
        registry.addHandler(triggerController, "/ws").setAllowedOrigins("*");
    }
}
