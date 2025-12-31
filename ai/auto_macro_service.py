import time
import asyncio
import os
import sys

# ai/sound 폴더를 path에 추가하여 stt_core를 불러올 수 있게 함
base_dir = os.path.dirname(os.path.abspath(__file__))
sys.path.append(os.path.join(base_dir, "sound"))

from macro_bot import MacroBot
from zoom_automation import ZoomAutomator
from stt_core import GhostEars, load_config

async def run_auto_macro():
    # 1. 초기화
    print("🚀 [Zoom 자동 매크로 서비스] 가동 중... (STT 연동 모드)")
    
    config = load_config()
    ears = GhostEars(config)
    bot = MacroBot()
    automator = ZoomAutomator()
    
    print("-" * 50)
    print(f"🎤 마이크 인덱스: {ears.device_index}")
    print(f"🧠 AI 모델: {bot.model.model_name if bot.model else 'None'}")
    print("💡 Enter: 확인 및 전송 / Right Shift: 취소")
    print("-" * 50)

    # 2. STT 백그라운드 청취 시작
    if not ears.start_listening():
        print("❌ 마이크를 시작할 수 없습니다. 장치 번호를 확인하세요.")
        return

    try:
        # 3. 텍스트 발생 감시 루프
        print("👂 소리를 듣고 있습니다... 설정된 키워드나 질문이 들리면 AI가 작동합니다.")
        for text in ears.process_queue():
            if text:
                print(f"\n▶ 인식된 대화: {text}")
                
                # 트리거 체크 (키워드 또는 질문)
                trigger = ears.check_trigger(text)
                
                if trigger:
                    trigger_type, matched = trigger
                    print(f"🎯 트리거 감지! ({trigger_type}: {matched})")
                    
                    # Gemini 답변 생성
                    print("🧠 AI가 답변을 생각하는 중...")
                    suggestion = bot.get_suggestion(text)
                    
                    if suggestion:
                        # 사용자 확인 및 전송
                        print(f"💡 추천 답변: {suggestion}")
                        print("👉 [Enter] 전송 / [Right Shift] 취소")
                        
                        automator.wait_for_user_confirmation(suggestion)
                    else:
                        print("⚠️ 답변 생성 실패")
                else:
                    # 트리거가 없을 때는 그냥 로그만 남기고 조용히 넘어감
                    pass

    except KeyboardInterrupt:
        print("\n👋 서비스를 종료합니다.")
    finally:
        if hasattr(ears, 'stopper'):
            ears.stopper(wait_for_stop=False)

if __name__ == "__main__":
    asyncio.run(run_auto_macro())
