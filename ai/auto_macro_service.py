import time
import asyncio
import requests
from macro_bot import MacroBot
from zoom_automation import ZoomAutomator

# 기존 server.py의 상태를 모니터링하기 위한 설정
SERVER_URL = "http://127.0.0.1:8000/state"

async def run_auto_macro():
    bot = MacroBot()
    automator = ZoomAutomator()
    
    last_processed_text = ""
    
    print("🚀 [Zoom 자동 매크로 서비스] 가동 중...")
    print("💡 터미널 1에서 server.py가 실행 중이어야 합니다.")
    
    while True:
        try:
            # 1. 서버로부터 현재 STT 상태 가져오기 (실제로는 WebSocket이 좋으나 최소 수정을 위해 폴링)
            # 대시보드의 SttPanel에서 transcript가 업데이트되어 서버로 전달되는 구조라면 여기서 읽을 수 있음
            # 하지만 현재 server.py는 transcript를 들고 있지 않으므로, 
            # 사용자 요청대로 'STT 출력 기반'으로 작동하기 위해 가상으로 STT 서버를 체크하는 루프를 만듭니다.
            
            # 여기서는 단순히 테스트를 위해 고정된 텍스트가 들어왔다고 가정하거나
            # 사용자에게 직접 입력을 유도하는 방식으로 먼저 검증합니다.
            
            user_input = input("\n[대화 입력] (또는 Enter 시 자동 감지 모드 시뮬레이션): ").strip()
            
            if not user_input:
                print("⏳ 대화 대기 중... (Ctrl+C로 종료)")
                time.sleep(2)
                continue
                
            if user_input == last_processed_text:
                continue
                
            # 2. Gemini 답변 생성
            print("🧠 AI 분석 중...")
            suggestion = bot.get_suggestion(user_input)
            
            if suggestion:
                # 3. 사용자 확인 및 전송
                automator.wait_for_user_confirmation(suggestion)
                last_processed_text = user_input
            else:
                print("⚠️ 답변을 생성하지 못했습니다.")
                
        except KeyboardInterrupt:
            print("\n👋 서비스를 종료합니다.")
            break
        except Exception as e:
            print(f"❌ 오류 발생: {e}")
            time.sleep(5)

if __name__ == "__main__":
    asyncio.run(run_auto_macro())
