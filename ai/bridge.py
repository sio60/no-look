import pyvirtualcam
import cv2

class VirtualCam:
    def __init__(self, width, height, fps=30):
        self.width = width
        self.height = height
        self.cam = None
        try:
            self.cam = pyvirtualcam.Camera(width=width, height=height, fps=fps)
            print(f"Virtual Camera initialized: {self.cam.device}")
        except Exception as e:
            print(f"Virtual Cam Init Error: {e}")

    def send(self, frame):
        if self.cam is None:
            return
            
        if frame.shape[1] != self.width or frame.shape[0] != self.height:
            frame = cv2.resize(frame, (self.width, self.height))
            
        # Convert BGR (OpenCV) to RGB (pyvirtualcam)
        frame_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        self.cam.send(frame_rgb)
        self.cam.sleep_until_next_frame()
