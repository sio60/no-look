package com.nolook.backend.socket;

import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import com.nolook.backend.core.VideoState;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import jakarta.annotation.PostConstruct;
import jakarta.annotation.PreDestroy;

import java.io.*;
import java.net.ServerSocket;
import java.net.Socket;
import java.nio.charset.StandardCharsets;

/**
 * Python과 TCP 소켓 통신을 담당하는 핸들러입니다.
 * 
 * @패키지출처 java.net.ServerSocket
 * @기능 Python으로부터 트리거 수신 (gaze_off 등)
 * @포트 5050 (application.properties에서 설정)
 */
@Component
public class PythonSocketHandler {

    @Value("${python.socket.port:5050}")
    private int port;

    private final VideoState videoState;

    private ServerSocket serverSocket;
    private Socket clientSocket;
    private volatile boolean running = true;

    public PythonSocketHandler(VideoState videoState) {
        this.videoState = videoState;
    }

    /**
     * 서버 소켓을 시작하고 Python 연결을 대기합니다.
     */
    @PostConstruct
    public void init() {
        Thread serverThread = new Thread(this::startServer, "PythonSocketServer");
        serverThread.setDaemon(true);
        serverThread.start();
    }

    /**
     * TCP 서버를 시작합니다.
     */
    private void startServer() {
        try {
            serverSocket = new ServerSocket(port);
            System.out.println("[Python Socket] ✅ Server started on port " + port);
            System.out.println("[Python Socket] Waiting for Python client...");

            while (running) {
                try {
                    // Python 클라이언트 연결 대기
                    clientSocket = serverSocket.accept();
                    System.out.println("[Python Socket] ✅ Python client connected: " +
                            clientSocket.getInetAddress());

                    // 클라이언트 처리 (별도 스레드)
                    handleClient(clientSocket);

                } catch (IOException e) {
                    if (running) {
                        System.err.println("[Python Socket] Error accepting connection: " + e.getMessage());
                    }
                }
            }
        } catch (IOException e) {
            System.err.println("[Python Socket] Failed to start server: " + e.getMessage());
        }
    }

    /**
     * Python 클라이언트로부터 메시지를 수신하고 처리합니다.
     * 
     * @메시지형식
     *        {"type": "trigger", "event": "gaze_off"} → FAKE 모드 전환
     *        {"type": "trigger", "event": "gaze_on"} → REAL 모드 전환
     *        {"type": "switch", "target": "FAKE", "fade_ms": 300}
     */
    private void handleClient(Socket socket) {
        try (BufferedReader reader = new BufferedReader(
                new InputStreamReader(socket.getInputStream(), StandardCharsets.UTF_8));
                PrintWriter writer = new PrintWriter(
                        new OutputStreamWriter(socket.getOutputStream(), StandardCharsets.UTF_8), true)) {

            String line;
            while ((line = reader.readLine()) != null && running) {
                System.out.println("[Python Socket] Received: " + line);

                try {
                    JsonObject json = JsonParser.parseString(line).getAsJsonObject();
                    String response = processMessage(json);
                    writer.println(response);

                } catch (Exception e) {
                    System.err.println("[Python Socket] Error parsing message: " + e.getMessage());
                    writer.println("{\"status\":\"error\",\"message\":\"" + e.getMessage() + "\"}");
                }
            }

        } catch (IOException e) {
            System.out.println("[Python Socket] Client disconnected: " + e.getMessage());
        }
    }

    /**
     * 수신된 메시지를 처리하고 응답을 반환합니다.
     */
    private String processMessage(JsonObject json) {
        String type = json.has("type") ? json.get("type").getAsString() : "";

        switch (type) {
            case "trigger":
                return handleTrigger(json);

            case "switch":
                return handleSwitch(json);

            case "status":
                return getStatus();

            default:
                return "{\"status\":\"error\",\"message\":\"Unknown type: " + type + "\"}";
        }
    }

    /**
     * 트리거 이벤트 처리 (gaze_off, gaze_on)
     */
    private String handleTrigger(JsonObject json) {
        String event = json.has("event") ? json.get("event").getAsString() : "";

        switch (event) {
            case "gaze_off":
                // 시선 이탈 → FAKE 모드로 전환
                videoState.setTarget(VideoState.Mode.FAKE);
                System.out.println("[Python Socket] 🎭 Gaze OFF detected → Switching to FAKE");
                return "{\"status\":\"success\",\"mode\":\"FAKE\"}";

            case "gaze_on":
                // 시선 복귀 → REAL 모드로 전환
                videoState.setTarget(VideoState.Mode.REAL);
                System.out.println("[Python Socket] 👁️ Gaze ON detected → Switching to REAL");
                return "{\"status\":\"success\",\"mode\":\"REAL\"}";

            default:
                return "{\"status\":\"error\",\"message\":\"Unknown event: " + event + "\"}";
        }
    }

    /**
     * 수동 스위치 명령 처리
     */
    private String handleSwitch(JsonObject json) {
        String target = json.has("target") ? json.get("target").getAsString() : "REAL";
        double fadeMs = json.has("fade_ms") ? json.get("fade_ms").getAsDouble() : 300;

        VideoState.Mode mode = "FAKE".equalsIgnoreCase(target)
                ? VideoState.Mode.FAKE
                : VideoState.Mode.REAL;

        videoState.setTarget(mode, fadeMs);
        System.out.println("[Python Socket] Switch to " + mode + " (fade: " + fadeMs + "ms)");

        return "{\"status\":\"success\",\"mode\":\"" + target + "\",\"fade_ms\":" + fadeMs + "}";
    }

    /**
     * 현재 상태 반환
     */
    private String getStatus() {
        JsonObject status = new JsonObject();
        status.addProperty("mode", videoState.getCurrentMode().get().toString());
        status.addProperty("alpha", videoState.getAlpha());
        status.addProperty("transitioning", videoState.isTransitioning());
        return status.toString();
    }

    /**
     * Python 클라이언트에 메시지 전송 (필요시)
     */
    public void sendToPython(String message) {
        if (clientSocket != null && clientSocket.isConnected()) {
            try {
                PrintWriter writer = new PrintWriter(
                        new OutputStreamWriter(clientSocket.getOutputStream(), StandardCharsets.UTF_8), true);
                writer.println(message);
            } catch (IOException e) {
                System.err.println("[Python Socket] Failed to send: " + e.getMessage());
            }
        }
    }

    /**
     * 서버 종료
     */
    @PreDestroy
    public void shutdown() {
        running = false;
        try {
            if (clientSocket != null)
                clientSocket.close();
            if (serverSocket != null)
                serverSocket.close();
            System.out.println("[Python Socket] Server stopped");
        } catch (IOException e) {
            // ignore
        }
    }
}
