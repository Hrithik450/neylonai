import os
from dotenv import load_dotenv

from typing import Annotated
from typing_extensions import TypedDict

from langgraph.graph.message import add_messages
from langgraph.graph import StateGraph, START
from langgraph.prebuilt import ToolNode, tools_condition

from langchain.tools import tool
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.messages import HumanMessage, SystemMessage, AIMessage

load_dotenv(override=True)


@tool
def semantic_search(query: str):
    """
    Search website knowledge base.
    """
    return "Document"


@tool
def update_lead(
    email: str = "",
    phone: str = "",
    company: str = "",
    name: str = "",
    budget: str = "",
    timeline: str = "",
):
    """
    Store lead information.
    """
    return "Lead information saved"


@tool
def book_demo():
    """
    Provide Booking link
    """
    return "Book a demo here: https://cal.com/company/demo"


@tool
def notify_team(summary: str):
    """
    Send lead summary
    """

    return "Team notified"


class AgentState(TypedDict):
    messages: Annotated[list, add_messages]


tools = [semantic_search, update_lead, book_demo, notify_team]
tool_node = ToolNode(tools)

llm = ChatGoogleGenerativeAI(
    model="gemini-2.5-flash-lite",
    temperature=0.4,
    max_retries=2,
    google_api_key=os.getenv("GOOGLE_API_KEY"),
)
llm_with_tools = llm.bind_tools(tools)

system_prompt = """
You are an AI assistant for our company.

Goals:

1. Answer questions using website knowledge.

2. Gradually collect:
   - name
   - email
   - phone
   - company
   - budget
   - timeline

3. Ask only one missing question at a time.

4. Use update_lead whenever new information is discovered.

5. When enough information exists and the user shows interest,
   offer a demo call.

6. Use book_demo tool to provide booking link.

7. Use notify_team when:
   - budget is provided
   - timeline is provided
   - user requests demo

Never ask all qualification questions at once.
Keep conversation natural.
"""


def agent(state: AgentState):
    response = llm_with_tools.invoke(state["messages"])
    return {"messages": [response]}


builder = StateGraph(AgentState)
builder.add_node(agent)
builder.add_node("tools", tool_node)

builder.add_edge(START, "agent")
builder.add_conditional_edges("agent", tools_condition)
builder.add_edge("tools", "agent")

agent_graph = builder.compile()


async def chat():

    while True:
        user_input = input("You: ")
        if user_input.lower() == "exit":
            break

        async for event in agent_graph.astream_events(
            {
                "messages": [
                    SystemMessage(content=system_prompt),
                    HumanMessage(content=user_input),
                ]
            },
            version="v2",
        ):
            if (
                event["event"] == "on_chat_model_stream"
                and event["metadata"].get("langgraph_node") == "agent"
            ):
                print("\n", event["event"])
                chunk = event["data"]["chunk"]
                text = getattr(chunk, "content", "")
                if text:
                    print(text, end="", flush=True)

            elif event["event"] == "on_chain_end" and not event.get("parent_ids"):
                messages = event["data"]["output"]["messages"]
                last_message = messages[-1]
                if isinstance(last_message, AIMessage):
                    print("final response: ", last_message.content)

        print("\n")
