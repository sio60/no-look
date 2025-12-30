#!/usr/bin/env python3
"""
No-Look Python → Backend 트리거 테스트 클라이언트

사용법:
    python test_trigger.py

기능:
    - Java Backend (port 5050)에 TCP 연결
    - gaze_off / gaze_on 트리거 전송
    - 실시간 상태 모니터링
"""

import socket
import json
import time
import sys

# Backend 서버 설정
HOST = '127.0.0.1'
PORT = 5050

def send_message(sock, message):
    """메시지 전송 및 응답 수신"""
    try:
        sock.send((json.dumps(message) + '\n').encode('utf-8'))
        response = sock.recv(1024).decode('utf-8')
        return json.loads(response)
    except Exception as e:
        print(f"[ERROR] {e}")
        return None

def main():
    print("=" * 50)
    print("No-Look Python Trigger Test Client")
    print("=" * 50)
    print(f"Connecting to Backend at {HOST}:{PORT}...")
    
    try:
        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        sock.connect((HOST, PORT))
        print("[OK] Connected to Backend!")
        print()
        print("Commands:")
        print("  1 or 'off'  - Send gaze_off (switch to FAKE)")
        print("  2 or 'on'   - Send gaze_on (switch to REAL)")
        print("  3 or 's'    - Get status")
        print("  4 or 'auto' - Auto toggle every 3 seconds")
        print("  q or 'quit' - Exit")
        print()
        
        while True:
            cmd = input("> ").strip().lower()
            
            if cmd in ['1', 'off']:
                msg = {"type": "trigger", "event": "gaze_off"}
                print(f"[SEND] {msg}")
                resp = send_message(sock, msg)
                print(f"[RECV] {resp}")
                
            elif cmd in ['2', 'on']:
                msg = {"type": "trigger", "event": "gaze_on"}
                print(f"[SEND] {msg}")
                resp = send_message(sock, msg)
                print(f"[RECV] {resp}")
                
            elif cmd in ['3', 's', 'status']:
                msg = {"type": "status"}
                print(f"[SEND] {msg}")
                resp = send_message(sock, msg)
                print(f"[RECV] {resp}")
                
            elif cmd in ['4', 'auto']:
                print("Auto toggle mode (Ctrl+C to stop)...")
                try:
                    is_fake = False
                    while True:
                        event = "gaze_off" if not is_fake else "gaze_on"
                        msg = {"type": "trigger", "event": event}
                        print(f"[SEND] {msg}")
                        resp = send_message(sock, msg)
                        print(f"[RECV] {resp}")
                        is_fake = not is_fake
                        time.sleep(3)
                except KeyboardInterrupt:
                    print("\nAuto mode stopped.")
                    
            elif cmd in ['q', 'quit', 'exit']:
                print("Goodbye!")
                break
                
            else:
                print("Unknown command. Try: 1, 2, 3, 4, or q")
                
    except ConnectionRefusedError:
        print(f"[ERROR] Could not connect to {HOST}:{PORT}")
        print("Make sure the Java Backend is running!")
        sys.exit(1)
    except KeyboardInterrupt:
        print("\nExiting...")
    finally:
        sock.close()

if __name__ == "__main__":
    main()
