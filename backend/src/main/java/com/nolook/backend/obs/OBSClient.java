package com.nolook.backend.obs;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import jakarta.annotation.PostConstruct;
import jakarta.annotation.PreDestroy;

import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.Base64;

import org.java_websocket.client.WebSocketClient;
import org.java_websocket.handshake.ServerHandshake;

import com.google.gson.JsonObject;
import com.google.gson.JsonParser;

/**
 * OBS Studio와 WebSocket 통신을 담당하는 클라이언트입니다.
 * 
 * @패키지출처 org.java_websocket.client.WebSocketClient
 * @기능 OBS 연결, SHA256 인증, 씬 전환
 * @설정 .env 파일에서 OBS 연결 정보 로드
 * @프로토콜 obs-websocket 5.0
 */
@Component
public class OBSClient {

    // ========================================
    // 설정값 (application.properties → .env)
    // ========================================

    @Value("${obs.websocket.host:localhost}")
    private String host;

    @Value("${obs.websocket.port:4455}")
    private int port;

    @Value("${obs.websocket.password:}")
    private String password;

    @Value("${obs.source.name:VideoEngine}")
    private String sourceName;

    // ========================================
    // WebSocket 클라이언트 및 상태
    // ========================================

    private WebSocketClient client;
    private boolean connected = false;
    private boolean authenticated = false;

    /** OBS Hello 메시지에서 받은 salt */
    private String authSalt;

    /** OBS Hello 메시지에서 받은 challenge */
    private String authChallenge;

    /**
     * 애플리케이션 시작 시 OBS 연결 시도
     */
    @PostConstruct
    public void init() {
        connect();
    }

    /**
     * OBS WebSocket 서버에 연결합니다.
     */
    public void connect() {
        try {
            String wsUrl = "ws://" + host + ":" + port;
            System.out.println("[OBS] Connecting to: " + wsUrl);

            client = new WebSocketClient(new URI(wsUrl)) {

                @Override
                public void onOpen(ServerHandshake handshake) {
                    System.out.println("[OBS] ✅ WebSocket Connected!");
                    connected = true;
                }

                @Override
                public void onMessage(String message) {
                    handleMessage(message);
                }

                @Override
                public void onClose(int code, String reason, boolean remote) {
                    System.out.println("[OBS] ❌ Connection closed: " + reason);
                    connected = false;
                    authenticated = false;
                }

                @Override
                public void onError(Exception ex) {
                    System.err.println("[OBS] Error: " + ex.getMessage());
                }
            };

            client.connect();

        } catch (Exception e) {
            System.err.println("[OBS] Failed to connect: " + e.getMessage());
        }
    }

    /**
     * OBS로부터 수신한 메시지를 처리합니다.
     * 
     * @패키지출처 com.google.gson.JsonParser
     * @param message JSON 형식의 OBS 메시지
     */
    private void handleMessage(String message) {
        try {
            JsonObject json = JsonParser.parseString(message).getAsJsonObject();

            // op 필드로 메시지 타입 구분 (obs-websocket 5.0 프로토콜)
            int op = json.has("op") ? json.get("op").getAsInt() : -1;

            switch (op) {
                case 0: // Hello - 서버 인사
                    handleHello(json);
                    break;

                case 2: // Identified - 인증 성공
                    System.out.println("[OBS] ✅ Authenticated successfully!");
                    authenticated = true;
                    break;

                case 5: // Event
                    // 이벤트 처리 (필요시)
                    break;

                case 7: // RequestResponse
                    handleRequestResponse(json);
                    break;
            }
        } catch (Exception e) {
            System.err.println("[OBS] Failed to parse message: " + e.getMessage());
            e.printStackTrace();
        }
    }

    /**
     * OBS Hello 메시지를 처리하고 인증 정보를 추출합니다.
     * 
     * @param json Hello 메시지 JSON
     */
    private void handleHello(JsonObject json) {
        System.out.println("[OBS] Received Hello, authenticating...");

        if (json.has("d")) {
            JsonObject d = json.getAsJsonObject("d");

            // 인증이 필요한 경우 salt와 challenge 추출
            if (d.has("authentication")) {
                JsonObject auth = d.getAsJsonObject("authentication");
                authSalt = auth.get("salt").getAsString();
                authChallenge = auth.get("challenge").getAsString();
                System.out.println("[OBS] Authentication required (salt + challenge received)");
            }
        }

        sendIdentify();
    }

    /**
     * OBS에 인증 요청을 보냅니다 (Identify).
     * 
     * @프로토콜 obs-websocket 5.0 Identify (op=1)
     */
    private void sendIdentify() {
        JsonObject identify = new JsonObject();
        identify.addProperty("op", 1); // Identify

        JsonObject d = new JsonObject();
        d.addProperty("rpcVersion", 1);

        // 인증이 필요한 경우 authentication 문자열 생성
        if (authSalt != null && authChallenge != null && password != null && !password.isEmpty()) {
            String authResponse = generateAuthResponse(password, authSalt, authChallenge);
            d.addProperty("authentication", authResponse);
            System.out.println("[OBS] Sending authenticated Identify request");
        } else {
            System.out.println("[OBS] Sending unauthenticated Identify request");
        }

        identify.add("d", d);

        if (client != null && client.isOpen()) {
            client.send(identify.toString());
        }
    }

    /**
     * OBS 인증 응답 문자열을 생성합니다.
     * 
     * @패키지출처 java.security.MessageDigest (SHA-256)
     * @패키지출처 java.util.Base64
     * 
     * @공식
     *     1. base64_secret = Base64(SHA256(password + salt))
     *     2. auth_response = Base64(SHA256(base64_secret + challenge))
     * 
     * @param password  사용자 패스워드
     * @param salt      OBS에서 받은 salt
     * @param challenge OBS에서 받은 challenge
     * @return 인증 응답 문자열
     */
    private String generateAuthResponse(String password, String salt, String challenge) {
        try {
            MessageDigest sha256 = MessageDigest.getInstance("SHA-256");

            // Step 1: base64_secret = Base64(SHA256(password + salt))
            String passwordSalt = password + salt;
            byte[] hash1 = sha256.digest(passwordSalt.getBytes(StandardCharsets.UTF_8));
            String base64Secret = Base64.getEncoder().encodeToString(hash1);

            // Step 2: auth_response = Base64(SHA256(base64_secret + challenge))
            String secretChallenge = base64Secret + challenge;
            sha256.reset();
            byte[] hash2 = sha256.digest(secretChallenge.getBytes(StandardCharsets.UTF_8));
            String authResponse = Base64.getEncoder().encodeToString(hash2);

            return authResponse;

        } catch (Exception e) {
            System.err.println("[OBS] Failed to generate auth response: " + e.getMessage());
            return null;
        }
    }

    /**
     * OBS 요청 응답을 처리합니다.
     */
    private void handleRequestResponse(JsonObject json) {
        if (json.has("d")) {
            JsonObject d = json.getAsJsonObject("d");
            if (d.has("requestStatus")) {
                JsonObject status = d.getAsJsonObject("requestStatus");
                boolean success = status.get("result").getAsBoolean();
                String requestType = d.has("requestType") ? d.get("requestType").getAsString() : "Unknown";

                if (success) {
                    System.out.println("[OBS] ✅ Request '" + requestType + "' successful");
                } else {
                    String comment = status.has("comment") ? status.get("comment").getAsString() : "No details";
                    System.err.println("[OBS] ❌ Request '" + requestType + "' failed: " + comment);
                }
            }
        }
    }

    /**
     * OBS 연결 상태를 반환합니다.
     */
    public boolean isConnected() {
        return connected && authenticated;
    }

    /**
     * OBS에 씬 전환 요청을 보냅니다.
     * 
     * @param sceneName 전환할 씬 이름
     */
    public void setCurrentScene(String sceneName) {
        if (!isConnected()) {
            System.err.println("[OBS] Not connected!");
            return;
        }

        JsonObject request = new JsonObject();
        request.addProperty("op", 6); // Request

        JsonObject d = new JsonObject();
        d.addProperty("requestType", "SetCurrentProgramScene");
        d.addProperty("requestId", "scene-" + System.currentTimeMillis());

        JsonObject requestData = new JsonObject();
        requestData.addProperty("sceneName", sceneName);
        d.add("requestData", requestData);

        request.add("d", d);

        client.send(request.toString());
        System.out.println("[OBS] Requested scene change to: " + sceneName);
    }

    /**
     * 애플리케이션 종료 시 연결 해제
     */
    @PreDestroy
    public void disconnect() {
        if (client != null) {
            client.close();
            System.out.println("[OBS] Disconnected");
        }
    }

    /**
     * 연결 상태 정보 문자열 반환
     */
    public String getStatus() {
        if (authenticated) {
            return "Connected & Authenticated to " + host + ":" + port;
        } else if (connected) {
            return "Connected (not authenticated) to " + host + ":" + port;
        } else {
            return "Disconnected";
        }
    }
}
