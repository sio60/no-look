# ai/rolling_recorder.py
import os
import time
import sys
from collections import deque
from dataclasses import dataclass
from typing import Deque, List, Optional

import cv2


@dataclass
class Segment:
    path: str
    start_ts: float
    end_ts: float


def _make_writer(base_path: str, w: int, h: int, fps: float) -> tuple[cv2.VideoWriter, str]:
    """
    mac/win 환경에서 VideoWriter 코덱이 제각각이라,
    열리는 조합을 '순서대로' 찾아서 사용.
    returns (writer, actual_path)
    """
    root, _ = os.path.splitext(base_path)

    candidates = [
        (".mp4", "mp4v"),
        (".mp4", "avc1"),
        (".mov", "avc1"),
        (".avi", "MJPG"),  # ✅ 최후의 보루 (가장 안정)
        (".avi", "XVID"),
    ]

    last_err = None
    for ext, cc in candidates:
        path = root + ext
        fourcc = cv2.VideoWriter_fourcc(*cc)
        writer = cv2.VideoWriter(path, fourcc, fps, (w, h))
        if writer.isOpened():
            return writer, path
        last_err = f"failed codec={cc} ext={ext}"

    raise RuntimeError(f"VideoWriter open failed ({last_err}). Try installing opencv with ffmpeg or use AVI(MJPG).")


class RollingRecorder:
    """
    - 실시간 프레임을 N초 단위(seg)로 잘라 저장
    - 최근 rolling_seconds 만큼만 유지(오래된 seg는 삭제)
    - FAKE 시점엔 가장 오래된 seg부터 순서대로 재생(= 딜레이 영상)
    """

    def __init__(
        self,
        out_dir: str,
        width: int,
        height: int,
        fps: float,
        rolling_seconds: int = 120,
        segment_seconds: int = 10,
    ):
        self.out_dir = out_dir
        os.makedirs(self.out_dir, exist_ok=True)

        self.w = int(width)
        self.h = int(height)
        self.fps = float(fps) if fps and fps > 0 else 30.0

        self.rolling_seconds = int(rolling_seconds)
        self.segment_seconds = int(segment_seconds)

        self._segments: Deque[Segment] = deque()

        self._writer: Optional[cv2.VideoWriter] = None
        self._seg_start_ts: Optional[float] = None
        self._seg_path: Optional[str] = None

        # playback
        self._play_paths: List[str] = []
        self._play_index: int = 0
        self._play_cap: Optional[cv2.VideoCapture] = None

        self.recording_enabled: bool = True

    def set_recording_enabled(self, enabled: bool) -> None:
        enabled = bool(enabled)
        if self.recording_enabled == enabled:
            return
        self.recording_enabled = enabled
        if not self.recording_enabled:
            self._close_writer()

    def _open_new_segment(self, now_ts: float) -> None:
        self._close_writer()

        name = f"seg_{int(now_ts*1000)}.mp4"
        base_path = os.path.join(self.out_dir, name)

        writer, actual_path = _make_writer(base_path, self.w, self.h, self.fps)
        self._writer = writer
        self._seg_start_ts = now_ts
        self._seg_path = actual_path

    def _close_writer(self) -> None:
        if self._writer is not None:
            try:
                self._writer.release()
            except Exception:
                pass
        self._writer = None

        # 세그 종료 처리(segments 큐에 등록)
        if self._seg_start_ts is not None and self._seg_path is not None:
            end_ts = time.time()
            self._segments.append(Segment(self._seg_path, self._seg_start_ts, end_ts))

        self._seg_start_ts = None
        self._seg_path = None

    def _cleanup_old(self, now_ts: float) -> None:
        cutoff = now_ts - self.rolling_seconds
        while self._segments and self._segments[0].end_ts < cutoff:
            seg = self._segments.popleft()
            try:
                os.remove(seg.path)
            except Exception:
                pass

    def update(self, frame, now_ts: float) -> None:
        if not self.recording_enabled or frame is None:
            return

        if frame.shape[1] != self.w or frame.shape[0] != self.h:
            frame = cv2.resize(frame, (self.w, self.h))

        if self._writer is None:
            self._open_new_segment(now_ts)

        if self._seg_start_ts is not None and (now_ts - self._seg_start_ts) >= self.segment_seconds:
            self._open_new_segment(now_ts)

        if self._writer is not None:
            self._writer.write(frame)

        self._cleanup_old(now_ts)

    # ---------- playback ----------
    def start_playback(self) -> None:
        self.stop_playback()
        self._play_paths = [s.path for s in list(self._segments)]
        self._play_index = 0
        self._open_play_cap()

    def _open_play_cap(self) -> None:
        if self._play_index >= len(self._play_paths):
            self._play_cap = None
            return

        path = self._play_paths[self._play_index]
        cap = cv2.VideoCapture(path)
        if not cap.isOpened():
            self._play_index += 1
            self._open_play_cap()
            return

        self._play_cap = cap

    def read_playback_frame(self):
        if self._play_cap is None:
            return None

        ret, frame = self._play_cap.read()
        if ret:
            if frame.shape[1] != self.w or frame.shape[0] != self.h:
                frame = cv2.resize(frame, (self.w, self.h))
            return frame

        # 현재 세그 끝 → 다음 세그로
        try:
            self._play_cap.release()
        except Exception:
            pass
        self._play_cap = None

        self._play_index += 1
        if self._play_index >= len(self._play_paths):
            self._play_index = 0

        self._open_play_cap()
        return None

    def stop_playback(self) -> None:
        if self._play_cap is not None:
            try:
                self._play_cap.release()
            except Exception:
                pass
        self._play_cap = None
        self._play_paths = []
        self._play_index = 0
