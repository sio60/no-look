import openai
import os

class MeetingBot:
    def __init__(self):
        self.api_key = os.getenv("OPENAI_API_KEY")
        self.client = None
        if self.api_key:
            self.client = openai.OpenAI(api_key=self.api_key)
            
    def get_reaction(self):
        # Simplified: just return a canned positive response or use LLM if needed
        return "That sounds like a great plan."
