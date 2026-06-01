from pydantic import BaseModel, ValidationError
from django.http import StreamingHttpResponse
from typing import Optional

from api.services.message_service import ThreadMessagesResponse, ThreadMessageService
from assistant.services.streaming import AgentStreamService

from rest_framework import status
from rest_framework.views import APIView
from rest_framework.response import Response

from ..lib.utils import system_prompt, async_to_sync_generator
from langchain_core.messages import AIMessage, SystemMessage, HumanMessage

from assistant.agents.agent import agent_graph
from datetime import datetime
import pytz


class InputSchema(BaseModel):
    input: str
    senderId: Optional[str] = None
    threadId: Optional[str] = None


class AgentView(APIView):

    IST = pytz.timezone("Asia/Kolkata")
    today_date = datetime.now(IST).strftime("%B %d, %Y")

    def build_agent_state(self, user_input: str, conversation_history: list):
        messages = [
            SystemMessage(content=system_prompt.format(today_date=self.today_date))
        ]

        for message in conversation_history or []:

            if not message.get("content"):
                continue

            if message["role"] == "user":
                messages.append(HumanMessage(content=message["content"]))
            else:
                messages.append(AIMessage(content=message["content"]))

        messages.append(HumanMessage(content=user_input))
        return {"messages": messages}

    def post(self, request):
        try:
            data = request.data
            validatedData = InputSchema(**data)

            user_input = getattr(validatedData, "input", "")
            sender_id = getattr(validatedData, "senderId", None)
            thread_id = getattr(validatedData, "threadId", None)

            conversation_history = []
            if sender_id and thread_id:
                thread_messages_response: ThreadMessagesResponse = (
                    ThreadMessageService.list_recent_thread_messages(thread_id)
                )
                if thread_messages_response.success and thread_messages_response.data:
                    conversation_history = [
                        msg.model_dump() for msg in thread_messages_response.data
                    ]

            agent_state = self.build_agent_state(user_input, conversation_history)
            events_iter = agent_graph.astream_events(
                input=agent_state,
                version="v2",
            )

            return StreamingHttpResponse(
                async_to_sync_generator(
                    AgentStreamService.event_generator(
                        events_iter, user_input, thread_id, sender_id
                    )
                ),
                content_type="text/event-stream",
            )

        except ValidationError as ve:
            return Response(
                {
                    "success": False,
                    "error": f"Invalid request data: {str(ve.errors())}",
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        except Exception as e:
            return Response(
                {
                    "success": False,
                    "error": f"Internal server error: {str(e)}",
                },
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )
