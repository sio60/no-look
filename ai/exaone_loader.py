import os
import torch
from transformers import AutoModelForCausalLM, AutoTokenizer

class ExaoneLoader:
    _instance = None
    _model = None
    _tokenizer = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(ExaoneLoader, cls).__new__(cls)
            cls._instance._load_model()
        return cls._instance

    def _load_model(self):
        print("📥 Loding LGAI-EXAONE/EXAONE-4.0-1.2B-Instruct model...")
        model_id = "LGAI-EXAONE/EXAONE-4.0-1.2B"  
        
        try:
            self._tokenizer = AutoTokenizer.from_pretrained(model_id, trust_remote_code=True)
            self._model = AutoModelForCausalLM.from_pretrained(
                model_id,
                dtype=torch.float16 if torch.cuda.is_available() else torch.float32,
                device_map="auto",
                trust_remote_code=True
            )
            print("✅ Model loaded successfully.")
        except Exception as e:
            print(f"❌ Failed to load model: {e}")
            self._model = None
            self._tokenizer = None

    def generate_content(self, prompt: str) -> str:
        if not self._model or not self._tokenizer:
            return "모델이 로드되지 않았습니다."

        messages = [
            {"role": "user", "content": prompt}
        ]
        
        input_ids = self._tokenizer.apply_chat_template(
            messages,
            tokenize=True,
            add_generation_prompt=True,
            return_tensors="pt"
        )

        output_ids = self._model.generate(
            input_ids.to(self._model.device),
            max_new_tokens=256,
            eos_token_id=self._tokenizer.eos_token_id,
            do_sample=True,
            temperature=0.7,
            top_p=0.9
        )

        response = self._tokenizer.decode(output_ids[0][len(input_ids[0]):], skip_special_tokens=True)
        return response

if __name__ == "__main__":
    loader = ExaoneLoader()
    print(loader.generate_content("안녕하세요! 자기소개 좀 해주세요."))
