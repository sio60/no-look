package com.nolook.backend.web;

import org.springframework.http.MediaType;
import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.ResponseBody;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.util.concurrent.BlockingQueue;
import java.util.concurrent.LinkedBlockingQueue;
import java.util.concurrent.TimeUnit;

@Controller
public class StreamingController {

    private final BlockingQueue<byte[]> frameQueue = new LinkedBlockingQueue<>(1);

    /**
     * VideoEngine에서 새로운 프레임이 준비되면 호출됩니다.
     */
    public void pushFrame(byte[] jpegData) {
        // 큐가 가득 찼으면 비우고(오래된 프레임 버림) 새 프레임 넣기 (Latest Only)
        frameQueue.offer(jpegData);
    }

    @GetMapping("/stream/video.mjpeg")
    @ResponseBody
    public void streamVideo(HttpServletResponse response) throws IOException {
        response.setContentType("multipart/x-mixed-replace; boundary=--frame");

        try {
            while (true) {
                // VideoEngine으로부터 프레임 대기 (최대 1초)
                byte[] jpegData = frameQueue.poll(1, TimeUnit.SECONDS);

                if (jpegData != null) {
                    response.getOutputStream().write(("--frame\r\n").getBytes());
                    response.getOutputStream().write(("Content-Type: image/jpeg\r\n").getBytes());
                    response.getOutputStream().write(("Content-Length: " + jpegData.length + "\r\n\r\n").getBytes());
                    response.getOutputStream().write(jpegData);
                    response.getOutputStream().write(("\r\n").getBytes());
                    response.getOutputStream().flush();
                }
            }
        } catch (Exception e) {
            System.out.println("Video Stream Client Disconnected");
        }
    }
}
