import cv2
import time
import os
import sys

# Import local modules
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
from detector import DistractionDetector
from generator import StreamGenerator
from bridge import VirtualCam
from bot import MeetingBot
import os

def main():
    WEBCAM_ID = 0
    # ✅ (추천) __file__ 기준 절대경로로 바꿔두면 안전
    import os
    BASE_DIR = os.path.dirname(os.path.abspath(__file__))
    FAKE_VIDEO = os.path.join(BASE_DIR, "assets", "fake_sample.mp4")

    detector = DistractionDetector()
    generator = StreamGenerator(FAKE_VIDEO)

    cap = cv2.VideoCapture(WEBCAM_ID)
    if not cap.isOpened():
        raise RuntimeError(f"Webcam open failed: {WEBCAM_ID}")

    width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))

    bridge = VirtualCam(width, height)

    mode = "REAL"
    trans_start = time.time()
    TRANSITION_TIME = 0.5

    # ✅ 한번 FAKE로 가면 계속 유지하는 락
    locked_fake = False

    while True:
        ret, real_frame = cap.read()
        if not ret:
            break

        # 1) Detect (딴짓 감지)
        is_distracted, reasons = detector.is_distracted(real_frame)

        # 2) ✅ 락 걸기: 한번이라도 감지되면 영구 FAKE
        if is_distracted:
            locked_fake = True

        # 3) Decide target mode (락이 걸리면 무조건 FAKE)
        target_mode = "FAKE" if locked_fake else "REAL"

        # 4) Mode switching (target이 바뀔 때만 전환 시작)
        if target_mode != mode:
            mode = target_mode
            trans_start = time.time()

        # 5) Blend ratio 계산
        elapsed = time.time() - trans_start
        progress = min(elapsed / TRANSITION_TIME, 1.0)
        final_ratio = progress if mode == "FAKE" else (1.0 - progress)

        # 6) Generate/Blend
        fake_frame = generator.get_fake_frame()
        if fake_frame is None:
            fake_frame = real_frame.copy()
        else:
            # ✅ 해상도 다르면 맞추기
            fake_frame = cv2.resize(fake_frame, (real_frame.shape[1], real_frame.shape[0]))

        output_frame = generator.blend_frames(real_frame, fake_frame, final_ratio)

        # 7) Output
        bridge.send(output_frame)

        # Debug overlay
        debug_img = output_frame.copy()
        color = (0, 0, 255) if locked_fake else (0, 255, 0)
        status_text = f"Mode: {mode} ({int(final_ratio*100)}%) | Locked: {locked_fake}"
        cv2.putText(debug_img, status_text, (10, 30),
                    cv2.FONT_HERSHEY_SIMPLEX, 1, color, 2)

        if reasons:
            cv2.putText(debug_img, str(reasons), (10, 60),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 0, 255), 1)

        cv2.imshow("No-Look Preview", debug_img)

        if cv2.waitKey(1) & 0xFF == ord('q'):
            break

    cap.release()
    cv2.destroyAllWindows()

if __name__ == "__main__":
    main()
