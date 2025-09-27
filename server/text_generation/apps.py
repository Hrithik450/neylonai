from pydantic import BaseModel
from datetime import datetime
from django.apps import AppConfig
from .lib.load_data import df, chroma_collection
from typing import List, Optional, TypedDict, Literal

import pytz
import redis
from dotenv import load_dotenv
from rich.console import Console

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