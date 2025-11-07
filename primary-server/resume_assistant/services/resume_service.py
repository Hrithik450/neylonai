import os
from dotenv import load_dotenv
from langchain_openai import ChatOpenAI
from ..utils.prompts import CLASSIFY_PROMPT
from typing import List, Dict, Any, Optional
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.messages import HumanMessage, SystemMessage

load_dotenv()

class ResumeService:
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
        """Handles the classification node by preparing messages and invoking the model."""

        messages = [SystemMessage(content=CLASSIFY_PROMPT)]
        if history:
            messages.extend(HumanMessage(content=msg['content']) for msg in history if msg.get("role") == 'user' and msg.get('content'))
        messages.append(HumanMessage(content=user_message))
        response = cls.openai_model.invoke(input=messages)
        return response.content.strip().lower()