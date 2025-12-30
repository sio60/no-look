import cv2
import mediapipe as mp
import numpy as np

class DistractionDetector:
    def __init__(self):
        # Initialize MediaPipe Face Mesh (for Head Pose & Eyes)
        self.mp_face_mesh = mp.solutions.face_mesh
        self.face_mesh = self.mp_face_mesh.FaceMesh(
            min_detection_confidence=0.5,
            min_tracking_confidence=0.5,
            refine_landmarks=True
        )
        # Initialize MediaPipe Hands (for "Phone" detection)
        self.mp_hands = mp.solutions.hands
        self.hands = self.mp_hands.Hands(
            min_detection_confidence=0.5,
            min_tracking_confidence=0.5
        )
        
        self.PITCH_THRESHOLD = 25 # Degrees looking down

    def check_head_pose(self, face_landmarks, img_w, img_h):
        """Estimate head pose (pitch, yaw) in degrees. Returns (pitch, yaw)."""

        # 2D image points from mediapipe
        idx_list = [1, 152, 33, 263, 61, 291]
        image_points = []
        for idx in idx_list:
            lm = face_landmarks.landmark[idx]
            x2d, y2d = float(lm.x * img_w), float(lm.y * img_h)
            image_points.append((x2d, y2d))
        image_points = np.array(image_points, dtype=np.float64)

        # ✅ 3D model points (fixed face model, relative units)
        model_points = np.array([
            (0.0, 0.0, 0.0),  # Nose tip
            (0.0, -330.0, -65.0),  # Chin
            (-225.0, 170.0, -135.0),  # Left eye corner
            (225.0, 170.0, -135.0),  # Right eye corner
            (-150.0, -150.0, -125.0),  # Left mouth corner
            (150.0, -150.0, -125.0),  # Right mouth corner
        ], dtype=np.float64)

        focal_length = img_w
        cam_matrix = np.array([
            [focal_length, 0, img_w / 2],  # ✅ cx
            [0, focal_length, img_h / 2],  # ✅ cy
            [0, 0, 1]
        ], dtype=np.float64)

        dist_matrix = np.zeros((4, 1), dtype=np.float64)

        success, rot_vec, trans_vec = cv2.solvePnP(
            model_points, image_points, cam_matrix, dist_matrix, flags=cv2.SOLVEPNP_ITERATIVE
        )
        if not success:
            return 0.0, 0.0

        # ✅ rot_vec -> rmat
        rmat, _ = cv2.Rodrigues(rot_vec)

        # ✅ RQDecomp3x3 returns 6 items; angles is first
        angles = cv2.RQDecomp3x3(rmat)[0]  # (pitch, yaw, roll) in degrees in many builds
        pitch, yaw, _ = angles

        return float(pitch), float(yaw)

    def is_distracted(self, frame):
        """
        Main analysis function.
        Returns: is_distracted (bool), debug_info (dict)
        """
        img_h, img_w, _ = frame.shape
        rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        
        is_distracted = False
        reasons = []
        
        # 1. Hands Detection
        hand_results = self.hands.process(rgb_frame)
        if hand_results.multi_hand_landmarks:
            is_distracted = True
            reasons.append("HANDS_DETECTED")
            
        # 2. Face/Head Detection
        face_results = self.face_mesh.process(rgb_frame)
        pitch = 0
        if face_results.multi_face_landmarks:
            for face_landmarks in face_results.multi_face_landmarks:
                pitch, yaw = self.check_head_pose(face_landmarks, img_w, img_h)
                
                # Check looking down
                # Note: Adjust threshold based on debug feedback. Some setups output negative for down.
                # Adding debug info to reasons so you can see the value on screen
                reasons.append(f"Pitch: {int(pitch)}")
                
                if pitch > self.PITCH_THRESHOLD:
                    is_distracted = True
                    reasons.append(f"Is Down")
                    
        return is_distracted, reasons
