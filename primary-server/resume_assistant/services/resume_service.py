import os
from dotenv import load_dotenv
from langchain_openai import ChatOpenAI
from ..utils.prompts import CLASSIFY_PROMPT
from typing import List, Dict, Any, Optional
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.messages import HumanMessage, SystemMessage

class ResumeService:
    load_dotenv()
    OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
    GEMINI_API_KEY = os.getenv("GOOGLE_API_KEY")

    openai_model = ChatOpenAI(model="gpt-4o-mini", temperature=0.4, api_key=OPENAI_API_KEY)
    gemini_model = ChatGoogleGenerativeAI(
        model='gemini-2.5-flash',
        temperature=0.4,
        google_api_key=GEMINI_API_KEY,
        streaming=True
    )

    @classmethod
    def handle_classification_node(cls, user_message: str, history: Optional[List[Dict[str, Any]]] = None) -> str:
        messages = [SystemMessage(content=CLASSIFY_PROMPT)]
        if history:
            for msg in history:
                role = msg.get("role")
                content = msg.get("content")
                if role == "user":
                    messages.append(HumanMessage(content=content))

        messages.append(HumanMessage(content=user_message))
        response = cls.openai_model.invoke(input=messages)
        return response.content.strip().lower()