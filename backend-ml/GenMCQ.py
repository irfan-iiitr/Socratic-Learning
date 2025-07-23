from langchain_groq import ChatGroq
from langchain_community.utilities import GoogleSerperAPIWrapper
from dotenv import load_dotenv
import os
import json

load_dotenv()

GROQ_API_KEY = os.getenv("GROQ_API_KEY")
SERPER_API_KEY = os.getenv("SERPER_API_KEY")

chat = ChatGroq(
    temperature=0,
    groq_api_key=GROQ_API_KEY,
    model_name="llama3-70b-8192",
    model_kwargs={"response_format": {"type": "json_object"}}
)

serper = GoogleSerperAPIWrapper(serper_api_key=SERPER_API_KEY)

def get_mcq_prompt(topic: str, noq: int, level: str) -> str:
    return f"""You are a data structure and algorithm expert.
Create {noq} multiple choice questions about {topic} at {level} level.

Return ONLY this JSON format:
{{
  "questions": [
    {{
      "question": "Question text?",
      "options": ["A", "B", "C", "D"],
      "correct": 0
    }}
  ]
}}

Make sure:
- Exactly 4 options per question
- correct is 0, 1, 2, or 3
- Questions are clear and educational"""

def generate_mcqs_with_llm(topic: str, noq: int, level: str):
    prompt = get_mcq_prompt(topic, noq, level)
    response = chat.invoke(prompt)
    
    try:
        content = response.content if hasattr(response, 'content') else str(response)
        data = json.loads(content)
        return data.get('questions', [])
    except:
        return []

def fallback_google_search(topic: str, noq: int, level: str):
    search_results = serper.run(f"{topic} multiple choice questions")
    
    prompt = f"""Based on this content, create {noq} original MCQs about {topic}:

{search_results}

Return ONLY this JSON format:
{{
  "questions": [
    {{
      "question": "Question text?",
      "options": ["A", "B", "C", "D"],
      "correct": 0
    }}
  ]
}}"""
    
    response = chat.invoke(prompt)
    
    try:
        content = response.content if hasattr(response, 'content') else str(response)
        data = json.loads(content)
        return data.get('questions', [])
    except:
        return []

def generate_mcqs(topic: str, noq: int, level: str):
    print(f"Generating {noq} MCQs on {topic} ({level} level)...")
    
    # Try main method
    mcqs = generate_mcqs_with_llm(topic, noq, level)
    
    # Try fallback if needed
    if not mcqs:
        print("Trying fallback method...")
        mcqs = fallback_google_search(topic, noq, level)
    
    print(f"Generated {len(mcqs)} MCQs")
    return mcqs

# Test it
if __name__ == "__main__":
    questions = generate_mcqs("Python", 2, "beginner")
    print(json.dumps(questions, indent=2))