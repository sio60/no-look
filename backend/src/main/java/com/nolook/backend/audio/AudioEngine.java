package com.nolook.backend.audio;

import org.springframework.stereotype.Service;
import jakarta.annotation.PostConstruct;
import javax.sound.sampled.*;
import java.io.OutputStream;
import java.net.ServerSocket;
import java.net.Socket;

@Service
public class AudioEngine {

    private static final int PORT = 5001;
    private static final int SAMPLE_RATE = 16000;
    private static final int CHANNELS = 1;
    private static final int SAMPLE_SIZE_IN_BITS = 16;
    private static final int BUFFER_SIZE = 1024 * 4;

    private boolean running = true;

    @PostConstruct
    public void init() {
        Thread audioThread = new Thread(this::streamAudio, "AudioStreamThread");
        audioThread.setDaemon(true);
        audioThread.start();
    }

    private void streamAudio() {
        try (ServerSocket serverSocket = new ServerSocket(PORT)) {
            System.out.println("[Audio Engine] 🎧 Audio Server started on port " + PORT + ". Waiting for client...");

            while (running) {
                try (Socket client = serverSocket.accept()) {
                    System.out.println("[Audio Engine] ✅ Audio Client connected: " + client.getInetAddress());

                    captureAndStream(client.getOutputStream());
                } catch (Exception e) {
                    System.err.println("[Audio Engine] Client error: " + e.getMessage());
                }
            }
        } catch (Exception e) {
            System.err.println("[Audio Engine] Server error: " + e.getMessage());
        }
    }

    private void captureAndStream(OutputStream out) {
        AudioFormat format = new AudioFormat(SAMPLE_RATE, SAMPLE_SIZE_IN_BITS, CHANNELS, true, false);
        DataLine.Info info = new DataLine.Info(TargetDataLine.class, format);

        if (!AudioSystem.isLineSupported(info)) {
            System.err.println("[Audio Engine] Microphone line not supported.");
            return;
        }

        try (TargetDataLine line = (TargetDataLine) AudioSystem.getLine(info)) {
            line.open(format);
            line.start();

            byte[] buffer = new byte[BUFFER_SIZE];
            System.out.println("[Audio Engine] 🎤 Streaming audio...");

            while (running) {
                int bytesRead = line.read(buffer, 0, buffer.length);
                if (bytesRead > 0) {
                    out.write(buffer, 0, bytesRead);
                    out.flush();
                }
            }
        } catch (Exception e) {
            System.err.println("[Audio Engine] Streaming interrupted: " + e.getMessage());
        }
    }
}
