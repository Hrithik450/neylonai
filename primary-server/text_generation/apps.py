import os
import re
import json
import pytz
import redis
from uuid import UUID
from datetime import datetime
from dotenv import load_dotenv
from rich.console import Console
from django.apps import AppConfig
from pydantic import BaseModel, ValidationError
from typing import List, Optional, AsyncIterator, Literal, TypedDict

# --- LangChain / LangGraph imports ---
from langgraph.prebuilt import ToolNode
from langchain.chat_models import init_chat_model
from langgraph.graph.state import CompiledStateGraph
from langchain_google_genai import ChatGoogleGenerativeAI
from langgraph.graph import StateGraph, MessagesState, START, END

# ---- Project utils ----
load_dotenv()
from .lib.utils import AGENT_MODEL, SYSTEM_PROMPT, MEMORY_LAYER_PROMPT, parse_json, convert_to_standard_messages

# --- Schemas ---
class StreamChatSchema(BaseModel):
    userMessage: str
    senderId: str
    threadId: Optional[str]

class StateMessage(TypedDict):
    role: Literal["system", "user", "assistant"]
    content: str

class MessageState(TypedDict):
    messages: List[StateMessage]

class TextGenerationConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'text_generation'

    # ============================================================
    # CONFIG & GLOBALS
    # ============================================================
    console = Console()
    IST = pytz.timezone("Asia/Kolkata")
    today_date = datetime.now(IST).strftime("%B %d, %Y")

    DATABASE_URL = os.getenv("DATABASE_URL")
    REDIS_URL = os.getenv("REDIS_URL")
    GEMINI_API_KEY = os.getenv("GOOGLE_API_KEY")

    # Safe Redis client
    redis_client: Optional[redis.Redis] = None
    if REDIS_URL:
        try:
            redis_client = redis.Redis.from_url(REDIS_URL, decode_responses=True, health_check_interval=30, socket_keepalive=True)
            console.log("[green]Connected to Redis[/green]")
        except Exception as e:
            console.log(f"[red]Redis connection failed: {e}[/red]")

    # Initialize Instances Of Services
    # chat_thread_service = ChatThreadService(conn=conn, redis_client=redis_client)
    # chat_message_service = ChatMessageService(conn=conn, redis_client=redis_client)
    # chat_title_service = ChatTitleService()