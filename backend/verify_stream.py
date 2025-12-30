import cv2
import socket
import threading
import numpy as np

# Configuration
VIDEO_URL = "http://localhost:8080/stream/video.mjpeg"
AUDIO_HOST = "127.0.0.1"
AUDIO_PORT = 5001
AUDIO_SAMPLE_RATE = 16000

def video_client():
    print(f"[Video] Connecting to {VIDEO_URL}...")
    cap = cv2.VideoCapture(VIDEO_URL)
    
    if not cap.isOpened():
        print("[Video] Failed to open stream.")
        return

    print("[Video] Stream opened! Press 'q' to quit.")
    
    while True:
        ret, frame = cap.read()
        if not ret:
            print("[Video] Stream ended or error.")
            break
            
        cv2.imshow("Python Client - Video Stream", frame)
        if cv2.waitKey(1) & 0xFF == ord('q'):
            break

    cap.release()
    cv2.destroyAllWindows()

def audio_client():
    print(f"[Audio] Connecting to {AUDIO_HOST}:{AUDIO_PORT}...")
    try:
        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        sock.connect((AUDIO_HOST, AUDIO_PORT))
        print("[Audio] Connected! Receiving raw PCM data...")
        
        total_bytes = 0
        while True:
            data = sock.recv(4096)
            if not data:
                break
            total_bytes += len(data)
            # Just print progress every ~100KB to avoid spam
            if total_bytes % (1024 * 100) < 4096:
                print(f"[Audio] Received {total_bytes / 1024:.1f} KB")
                
    except Exception as e:
        print(f"[Audio] Error: {e}")
    finally:
        sock.close()

if __name__ == "__main__":
    t_video = threading.Thread(target=video_client)
    t_audio = threading.Thread(target=audio_client)
    
    t_video.start()
    t_audio.start()
    
    t_video.join()
    t_audio.join()
