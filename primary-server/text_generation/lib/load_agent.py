import os
import json
import pytz
from datetime import datetime
from dotenv import load_dotenv
from rich.console import Console
from typing import List, Literal, TypedDict

# --- LangChain / LangGraph imports ---
from langgraph.prebuilt import ToolNode
from langchain.chat_models import init_chat_model
from langgraph.graph.state import CompiledStateGraph
from langchain_google_genai import ChatGoogleGenerativeAI
from langgraph.graph import StateGraph, MessagesState, START, END

# ---- Project Imports ----
load_dotenv()
from ..tools.semantic_search_tool import semantic_search_tool
from ..tools.email_filtering_tool import email_filtering_tool
from .utils import AGENT_MODEL, MEMORY_LAYER_PROMPT, parse_json
from ..services.model_message_service import ChatMessageService
from ..services.model_thread_service import ChatThreadService
from ..services.model_title_service import ChatTitleService

# --- Schemas ---
class StateMessage(TypedDict):
    role: Literal["system", "user", "assistant"]
    content: str

class MessageState(TypedDict):
    messages: List[StateMessage]

class LoadInitialAgentConfig():
    _instance = None

    def __init__(self):
        if hasattr(self, "_initialized") and self._initialized:
            return
        
        print("Initializing LangGraph agent inside class...")

        # ============================================================
        # CONFIG & GLOBALS
        # ============================================================
        self.console = Console()
        IST = pytz.timezone("Asia/Kolkata")
        self.today_date = datetime.now(IST).strftime("%B %d, %Y")

        self.GEMINI_API_KEY = os.getenv("GOOGLE_API_KEY")
        if not self.GEMINI_API_KEY:
            raise("Please add GOOGLE_API_KEY inside env variables")
        
        # Initialize Instances Of Services
        self.chat_thread_service = ChatThreadService()
        self.chat_message_service = ChatMessageService()
        self.chat_title_service = ChatTitleService()

        # LangGraph model + tools
        self.tools = [email_filtering_tool, semantic_search_tool]
        self.tool_node = ToolNode(self.tools)

        self.base_model = ChatGoogleGenerativeAI(
            model='gemini-2.5-pro',
            temperature=0.4,
            max_retries=2,
            google_api_key=self.GEMINI_API_KEY
        )
        self.model_with_tools = self.base_model.bind_tools(self.tools)

        self.llm = init_chat_model(model=AGENT_MODEL, temperature=0)
        self.llm_with_tools = self.llm.bind_tools(self.tools)  # for small helper tasks

        self.agent_graph = self.build_agent_graph()
        self._initialized = True

    @classmethod
    def get_instance(cls):
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance

    # ============================================================
    # HELPER FUNCTIONS
    # ============================================================
    async def call_llm(self, system_prompt: str, user_prompt: str) -> str:
        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt}
        ]

        # invoke expects a list of message dicts (or LangChain Message objects)
        response = await self.llm_with_tools.ainvoke(messages)

        # response is an AIMessage object
        return response.content
    
    def call_model(self, state: MessagesState) -> MessagesState:
        """
        Sends messages to the model and returns the response wrapped in MessagesState format.
        """
        messages = state["messages"]

        response = self.model_with_tools.invoke(input=messages)
        return {"messages": [response]}
    
    def should_continue(self, state: MessagesState) -> bool:
        """
        Decides whether to call tools next based on the last model output.
        """
        messages = state["messages"]
        last_message = messages[-1]
        if last_message.tool_calls:
            return 'tools'
        return END
    
    # Query Reframe Func
    async def reframe_user_query(self, user_input: str, last_messages: List[dict]) -> dict:
        """
        Analyze deeply & decide if user input is a follow-up or is it related to previous questions.
        If yes -> reframe into an optimized query.
        If no -> return original query.
        """
        context = "\n".join(
            [f"{msg['role'].capitalize()}: {msg['content']}" for msg in last_messages]
        )

        user_prompt = f"""
        Conversation context (last 10 messages): 
        {context}

        New user question:
        {user_input}
        """

        raw_response = await self.call_llm(MEMORY_LAYER_PROMPT, user_prompt)
        try:
            result = parse_json(raw_response)
        except (json.JSONDecodeError, TypeError) as e:
            result = {
                "is_followup": False,
                "optimized_query": user_input,
                "selected_tools": []
            }

        return result
    
    # Build langgraph agent
    def build_agent_graph(self) -> CompiledStateGraph[MessagesState, MessagesState, MessagesState]:
        """Compile the LangGraph agent once."""
        # build the graph
        builder = StateGraph(MessagesState)

        # Add the nodes
        builder.add_node("call_model", self.call_model)
        builder.add_node("tools", self.tool_node)

        # add conditional edges
        builder.add_conditional_edges("call_model", self.should_continue, ["tools", END])

        # add the edges
        builder.add_edge(START, "call_model")
        builder.add_edge("tools", "call_model")

        return builder.compile()