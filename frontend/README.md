# 회의 보조 대시보드 (Meeting Assistant Dashboard)

Vite + React 기반의 실시간 회의 보조 대시보드 프론트엔드입니다.

## 요구사항

- **Node.js** 18.x 이상
- **npm** 9.x 이상
- **브라우저**: Chrome 권장 (Web Speech API 지원)

## 설치

```bash
cd frontend
npm install
npm i @mediapipe/tasks-vision
```

## 실행

```bash
npm run dev
```

브라우저에서 `http://localhost:5173` 접속 (포트가 사용 중이면 다른 포트로 자동 변경됨)

## 주요 기능

| 기능 | 설명 |
|------|------|
| **Mock Mode** | 백엔드 없이 랜덤 이벤트 생성으로 테스트 |
| **실시간 이벤트 로그** | gaze_off, yaw/pitch, confidence 표시 |
| **STT (음성 인식)** | Web Speech API 기반 한국어 지원 |
| **AI Reply** | Mock 답변 생성 (API 연결 시 실제 AI 사용) |
| **Video Preview** | 웹캠 미리보기 + 흑백 필터 시뮬레이션 |

## 프로젝트 구조

```
src/
├── pages/
│   └── Dashboard.jsx       # 메인 대시보드 페이지
├── components/
│   ├── StatusBar.jsx       # 상태 표시줄
│   ├── ControlPanel.jsx    # 모드 전환, 설정
│   ├── LogsPanel.jsx       # 이벤트 로그
│   ├── SttPanel.jsx        # 음성 인식
│   ├── AiReplyPanel.jsx    # AI 답변
│   ├── VideoPreview.jsx    # 비디오 미리보기
│   └── Toast.jsx           # 알림 토스트
├── lib/
│   ├── wsClient.js         # WebSocket 클라이언트
│   ├── mockStream.js       # Mock 이벤트 생성기
│   ├── api.js              # API 인터페이스
│   └── time.js             # 시간 유틸리티
├── styles/
│   └── dashboard.css       # 전체 스타일
├── App.jsx
└── main.jsx
```

## 브라우저 권한

- **마이크**: STT 기능 사용 시 필요
- **카메라**: Video Preview 기능 사용 시 필요

## API 연동

백엔드 서버가 있을 경우:
- WebSocket: `ws://127.0.0.1:8080/ws`
- AI Reply API: `POST http://127.0.0.1:5050/ai/reply`
- Macro API: `POST http://127.0.0.1:5050/macro/type`

Mock Mode를 끄면 실제 서버 연결을 시도합니다.