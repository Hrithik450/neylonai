import os
import json
import pytz
from datetime import datetime
from dotenv import load_dotenv
from rich.console import Console
from dataclasses import dataclass
from typing import List, Literal, TypedDict, Dict, Optional

# --- LangChain / LangGraph imports ---
from langchain.tools import tool
from langgraph.prebuilt import ToolNode
from langchain.chat_models import init_chat_model
from langgraph.graph.state import CompiledStateGraph
from langchain_google_genai import ChatGoogleGenerativeAI
from langgraph.graph import StateGraph, MessagesState, START, END

# ---- Project Imports ----
load_dotenv()
from ..tools.semantic_search_tool import SemanticSearchTool
from ..tools.email_filtering_tool import EmailFilteringTool
from .utils import AGENT_MODEL, MEMORY_LAYER_PROMPT, parse_json
from api.services.thread_message import ChatMessageService
from api.services.thread import ChatThreadService
from api.services.thread_title import ChatTitleService


@dataclass
class StateMessage(TypedDict):
    role: Literal["system", "user", "assistant"]
    content: str


@dataclass
class MessageState(TypedDict):
    messages: List[StateMessage]


class LoadInitialAgentConfig:
    search_tool_instance = SemanticSearchTool()
    email_tool_instance = EmailFilteringTool()

    def __init__(self):
        print("Initializing LangGraph agent...")
        # ============================================================
        # CONFIG & GLOBALS
        # ============================================================
        self.console = Console()
        IST = pytz.timezone("Asia/Kolkata")
        self.today_date = datetime.now(IST).strftime("%B %d, %Y")

        self.GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
        if not self.GEMINI_API_KEY:
            raise ("Please add GEMINI_API_KEY inside env variables")

        # Initialize Instances Of Services
        self.chat_thread_service = ChatThreadService()
        self.chat_message_service = ChatMessageService()
        self.chat_title_service = ChatTitleService()

        # LangGraph model + tools
        self.tools = [LoadInitialAgentConfig.semantic_search_tool_func]
        self.tool_node = ToolNode(self.tools)

        self.base_model = ChatGoogleGenerativeAI(
            model="gemini-2.5-flash",
            temperature=0.4,
            max_retries=2,
            google_api_key=self.GEMINI_API_KEY,
        )
        self.model_with_tools = self.base_model.bind_tools(self.tools)

        # self.llm = init_chat_model(model=AGENT_MODEL, temperature=0)
        self.memory_model = ChatGoogleGenerativeAI(
            model="gemini-2.5-pro",
            temperature=0.4,
            max_retries=2,
            google_api_key=self.GEMINI_API_KEY,
        )
        self.llm_with_tools = self.memory_model.bind_tools(
            self.tools
        )  # for small helper tasks

        self.agent_graph = self.build_agent_graph()
        print("Initialized LangGraph agent.")

    # ============================================================
    # Tools
    # ============================================================
    @staticmethod
    @tool("semantic_search_tool", parse_docstring=True)
    def semantic_search_tool_func(query: str) -> str:
        """
        This tool performs a semantic search over the documents to retrieve
        the most relevant chunks based on user asked query.

        Args:
            query (str): The natural language query.

        Returns:
            str: Top 10 most relavent documents with data.
        """
        return LoadInitialAgentConfig.search_tool_instance.run_tool(query)

    @staticmethod
    @tool("email_filtering_tool", parse_docstring=True)
    def email_filtering_tool_func(
        uid: str = None,
        threadId: str = None,
        thread_count: bool = False,
        thread_details: bool = False,
        thread_details_limit: int = 1,
        sender: str = None,
        recipient: str = None,
        subject: str = None,
        cc: bool = False,
        labels: list[str] = None,
        start_date: str = None,
        end_date: str = None,
        body: bool = False,
        html: bool = False,
        sort_by: str = "date",
        sort_order: str = "desc",
        limit: int = 5,
        analysis: Optional[Dict] = None,
    ) -> str:
        """
        This tool filter emails based on metadata such as sender (human), recipient (human), date range, or thread ID.

        Args:
            uid (str, optional): Filter emails by their unique UID. Exact match required.
            threadId: Filter emails by their conversation (email chian) thread ID, Returns all messages belonging to that specific chain (thread).
            thread_count: Returns the total number of unique email threads present in the dataset or within the applied filters.
            thread_details (bool, optional): If True, provides detailed summaries for each thread for further analytics, useful for including metrics  or sentiment analysis of emails within threads.
            thread_details_limit (int, default=1): Maximum number of threads to include when generating thread details (summaries/analytics). Defaults to 1 if not specified. Useful to limit output size for large datasets.
            sender (str or list of str, optional): Filter emails by sender(s). Can be full email address, partial email, or sender names (case-insensitive, only humans).
            recipient (str or list of str, optional): Filter emails by recipient(s). Can be full email addresses, partial emails, or recipient names, but strictly not numbers. (case-insensitive, only humans).
            subject (str, optional): Filter email by subject text. Can be full or partial subject string (case-insensitive).
            cc (bool, optional): Filter cc recepients of the email only when explicitly requested. Default False.
            labels (list of str, optional): Filter emails by one or more labels. Matches any email that contains at least one of the provided labels (case-insensitive).
            start_date (str, optional): Filter emails sent on or after this date. Format: 'YYYY-MM-DD' or 'YYYY-MM-DD HH:MM:SS'.
            end_date (str, optional): Filter emails sent on or before this date. Format: 'YYYY-MM-DD' or 'YYYY-MM-DD HH:MM:SS'.
            body (bool, optional): Include the plain-text email body only when explicitly requested. Default False.
            html (bool, optional): Include the full HTML body only when explicitly requested. Default False.
            sort_by (str, optional): Column to sort the results by. Default is 'date_dt'.
            sort_order (str, optional): Sort order: 'asc' for ascending, 'desc' for descending. Default is 'desc'.
            limit (int, default=5): Maximum number of results to return. set default value to 5.
            analysis (dict, optional): Specifies workflow or bottleneck analytics; keys include "analysis_type" -> (str: "active_status", str: "thread_status", str: "response_time") -> (where "active_status" → used for checking email_volume, sender_activity, recipient_activity, cc_activity, thread_activity, label_activity, top_senders, top_receivers, top_threads, most_active_labels, communication_frequency, participation_analysis by counting emails per entity and sorting them, where "threads_status" used for checking thread_duration, conversation_lifespan, long_running_threads, delayed_replies, inactivity_gaps, response_delays, slow_threads, thread_health, communication_latency, thread_timeline_analysis, where "response_time" used for checking average_response_time, reply_speed, responsiveness_analysis, sender_responsiveness, recipient_responsiveness, quick_repliers, slow_repliers, communication_efficiency, response_latency, turnaround_time), "field" (str: e.g. "from_normalized", "to_normalized", "cc_normalized", "threadId", "subject", "labels_normalized"), "sort_order" (str, default "desc") -> "desc" for top/slowest, "asc" for least/fastest, "threshold_hours" (int, default 24) -> For unanswered emails, "top_n" (int, default 10) -> Number of results to return, and "min_delayed_replies" (int, optional) -> Minimum number of delayed replies per thread.
        """
        return LoadInitialAgentConfig.email_tool_instance.run_tool(
            uid,
            threadId,
            thread_count,
            thread_details,
            thread_details_limit,
            sender,
            recipient,
            subject,
            cc,
            labels,
            start_date,
            end_date,
            body,
            html,
            sort_by,
            sort_order,
            limit,
            analysis,
        )

    # ============================================================
    # HELPER FUNCTIONS
    # ============================================================
    def call_model(self, state):
        """
        Sends messages to the model and returns the response wrapped in MessagesState format.
        """
        messages = state["messages"]

        response = self.model_with_tools.invoke(messages)
        return {"messages": [response]}

    async def call_memory_model(self, system_prompt: str, user_prompt: str) -> str:
        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ]

        # invoke expects a list of message dicts (or LangChain Message objects)
        response = await self.llm_with_tools.ainvoke(messages)

        # response is an AIMessage object
        return response.content

    def should_continue(self, state: MessagesState) -> bool:
        """
        Decides whether to call tools next based on the last model output.
        """
        messages = state["messages"]
        last_message = messages[-1]
        if last_message.tool_calls:
            return "tools"
        return END

    # Query Reframe Func
    async def reframe_user_query(
        self, user_input: str, last_messages: List[dict]
    ) -> dict:
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

        raw_response = await self.call_memory_model(
            MEMORY_LAYER_PROMPT.format(today_date=self.today_date), user_prompt
        )
        try:
            result = parse_json(raw_response)
        except (json.JSONDecodeError, TypeError) as e:
            result = {
                "is_followup": False,
                "optimized_query": user_input,
                "selected_tools": [],
            }

        return result

    # Build langgraph agent
    def build_agent_graph(
        self,
    ) -> CompiledStateGraph[MessagesState, MessagesState, MessagesState]:
        """Compile the LangGraph agent once."""
        # build the graph
        builder = StateGraph(MessagesState)

        # Add the nodes
        builder.add_node("call_model", self.call_model)
        builder.add_node("tools", self.tool_node)

        # add conditional edges
        builder.add_conditional_edges(
            "call_model", self.should_continue, ["tools", END]
        )

        # add the edges
        builder.add_edge(START, "call_model")
        builder.add_edge("tools", "call_model")

        return builder.compile()
