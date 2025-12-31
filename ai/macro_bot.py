import os
import google.generativeai as genai
from dotenv import load_dotenv

# .env 파일 위치를 명시적으로 로드하여 꼬임 방지
base_dir = os.path.dirname(os.path.abspath(__file__))
# ai 폴더 상위의 .env 파일을 찾습니다.
dotenv_path = os.path.normpath(os.path.join(base_dir, '..', '.env'))

# 기존 환경 변수를 무시하고 .env 파일의 내용을 강제로 덮어씁니다.
load_dotenv(dotenv_path=dotenv_path, override=True)

class MacroBot:
    def __init__(self):
        self.api_key = os.getenv("GEMINI_API_KEY")
        if self.api_key:
            # 보안을 위해 키의 일부도 출력하지 않음
            genai.configure(api_key=self.api_key)
            # 가장 안정적이고 할당량이 넉넉한 1.5-flash의 최신 버전 사용
            self.model = genai.GenerativeModel('gemini-flash-latest')
        else:
            self.model = None
            print("⚠️ GEMINI_API_KEY not found in environment.")

    def get_suggestion(self, transcript: str):
        """
        대화 내용을 바탕으로 Zoom 채팅용 답변 생성
        """
        if not self.model or not transcript.strip():
            return None

        prompt = f"""
        당신은 전문적인 온라인 회의(Zoom)의 비서입니다.
        아래의 실시간 음성 인식(STT) 텍스트를 바탕으로, 사용자가 Zoom 채팅창에 보낼 법한 가장 적절한 '단 한 문장'의 한국어 답변을 생성하세요.
        
        조건:
        1. 매우 간결하고 자연스러운 구어체여야 합니다.
        2. 질문에 대한 답변이거나, 의견에 대한 동의/리액션이어야 합니다.
        3. 답변 내용만 출력하세요. 다른 설명은 필요 없습니다.

        STT 텍스트:
        {transcript}
        """
        
        try:
            response = self.model.generate_content(prompt)
            return response.text.strip().replace('"', '') # 따옴표 제거
        except Exception as e:
            # 에러 메시지를 더 상세히 출력하여 원인 파악
            print(f"❌ Gemini API Error: {e}")
            return None

if __name__ == "__main__":
    # 간단한 테스트
    bot = MacroBot()
    test_text = "오늘 회의 주제는 다음 주 프로젝트 일정 관리입니다. 각자 진행 상황 말씀해 주세요."
    print(f"테스트 입력: {test_text}")
    print(f"AI 추천 답변: {bot.get_suggestion(test_text)}")
