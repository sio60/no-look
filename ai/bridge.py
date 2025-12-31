# ai/bridge.py
from __future__ import annotations

from typing import Optional
import cv2
import numpy as np

try:
    import pyvirtualcam
    from pyvirtualcam import PixelFormat
except Exception as e:
    pyvirtualcam = None
    PixelFormat = None
    _import_err = e
else:
    _import_err = None


class VirtualCam:
    """
    OpenCV(BGR) 프레임을 가상카메라(OBS Virtual Camera 등)로 송출.
    - macOS/Windows 공용: pyvirtualcam 사용
    - 기본 fmt=BGR 시도, 실패하면 RGB로 fallback
    """

    def __init__(
        self,
        width: int,
        height: int,
        fps: float = 30.0,
        *,
        backend: Optional[str] = None,   # 보통 None 또는 'obs'
        device: Optional[str] = None,    # 보통 None
        print_fps: bool = False,
        pace: bool = False,             # True면 sleep_until_next_frame로 페이싱
    ):
        if pyvirtualcam is None:
            raise RuntimeError(
                f"pyvirtualcam import failed: {_import_err}\n"
                f"pip install pyvirtualcam 로 설치해줘."
            )

        self.w = int(width)
        self.h = int(height)
        self.fps = float(fps) if fps and fps > 0 else 30.0
        self.backend = backend
        self.device = device
        self.print_fps = bool(print_fps)
        self.pace = bool(pace)

        self._cam: Optional[pyvirtualcam.Camera] = None
        self._fmt = None
        self._need_bgr_to_rgb = False

        self._open()

    def _open(self) -> None:
        # backend 후보: 명시된 backend → 'obs' → None(자동)
        backend_candidates = []
        if self.backend is not None:
            backend_candidates.append(self.backend)
        backend_candidates += ["obs", None]

        # fmt 후보: BGR → RGB
        fmt_candidates = [PixelFormat.BGR, PixelFormat.RGB]

        last_err = None
        for be in backend_candidates:
            for fmt in fmt_candidates:
                try:
                    cam = pyvirtualcam.Camera(
                        width=self.w,
                        height=self.h,
                        fps=self.fps,
                        fmt=fmt,
                        device=self.device,
                        backend=be,
                        print_fps=self.print_fps,
                    )
                    self._cam = cam
                    self._fmt = fmt
                    self._need_bgr_to_rgb = (fmt == PixelFormat.RGB)
                    print(f"Virtual Camera initialized: {cam.device} (backend={cam.backend}, fmt={fmt})")
                    return
                except Exception as e:
                    last_err = e

        raise RuntimeError(
            f"VirtualCam open failed: {last_err}\n"
            f"- macOS: OBS 설치 후 Virtual Camera를 한 번 Start/Stop 해서 등록 필요할 수 있음\n"
            f"- macOS: 카메라/화면녹화 권한도 확인\n"
            f"- backend/device 지정이 필요하면 VirtualCam(..., backend='obs') 또는 device='...'로 시도"
        )

    def close(self) -> None:
        if self._cam is not None:
            try:
                self._cam.close()
            except Exception:
                pass
        self._cam = None

    def send(self, frame: np.ndarray) -> None:
        """
        frame: OpenCV BGR (H,W,3) uint8
        """
        if self._cam is None or frame is None:
            return

        # 크기 맞추기
        if frame.shape[0] != self.h or frame.shape[1] != self.w:
            frame = cv2.resize(frame, (self.w, self.h), interpolation=cv2.INTER_LINEAR)

        # 채널 보정
        if frame.ndim == 2:
            frame = cv2.cvtColor(frame, cv2.COLOR_GRAY2BGR)
        elif frame.shape[2] == 4:
            frame = cv2.cvtColor(frame, cv2.COLOR_BGRA2BGR)

        if frame.dtype != np.uint8:
            frame = frame.astype(np.uint8)

        # fmt가 RGB로 열린 경우 변환
        if self._need_bgr_to_rgb:
            frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)

        self._cam.send(frame)

        if self.pace:
            self._cam.sleep_until_next_frame()

    def __enter__(self) -> "VirtualCam":
        return self

    def __exit__(self, exc_type, exc, tb) -> None:
        self.close()
