import os

from dotenv import load_dotenv

# .env 파일 로드
base_dir = os.path.dirname(os.path.abspath(__file__))
dotenv_path = os.path.normpath(os.path.join(base_dir, '..', '.env'))
load_dotenv(dotenv_path=dotenv_path, override=True)

class MeetingSummarizer:
    def __init__(self):
        # EXAONE 모델 로드
        from exaone_loader import ExaoneLoader
        self.loader = ExaoneLoader()
        self.model = self.loader._model

        self.last_summary = "아직 요약된 내용이 없습니다."

    def summarize(self, full_text: str):
        """
        전체 대화 텍스트를 받아 핵심 내용을 요약
        """
        if not self.model or not full_text.strip():
            return self.last_summary

        prompt = f"""
        당심은 전문 회의 기록원입니다. 제공된 대화 로그를 분석하여 다음 형식으로 요약하세요.
        문체는 정중한 한국어 문어체를 사용하세요.

        [요약 지침]
        1. **회의 주제**: 단 한 문장으로 정의
        2. **핵심 안건**: 불렛 포인트로 3~5개 정리
        3. **결정 사항 및 할 일**: 명확하게 기술
        4. **전체 분위기**: 간략하게 한 줄 요약

        [대화 로그]
        {full_text}

        요약 결과:
        """

        try:
            # EXAONE Loader 사용
            summary = self.loader.generate_content(prompt)
            self.last_summary = summary.strip()
            return self.last_summary
        except Exception as e:
            print(f"❌ EXAONE 요약 에러: {e}")
            return self.last_summary
