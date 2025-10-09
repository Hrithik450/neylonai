from django.http import StreamingHttpResponse
from rest_framework.views import APIView
from pydantic import BaseModel, ValidationError
from typing import Optional, List
from ..services.model_message_service import ChatMessagesResponse
from ..services.model_thread_service import ChatThreadResponse
from ..services.model_title_service import ChatTitleResponse
from rest_framework.response import Response
from rest_framework import status
from ..lib.load_agent import LoadInitialAgentConfig, MessageState, StateMessage
from ..lib.utils import SYSTEM_PROMPT
from datetime import datetime
from asgiref.sync import async_to_sync, sync_to_async
import asyncio
import json
import pytz
import re

class StreamChatSchema(BaseModel):
    userMessage: str
    senderId: str
    threadId: Optional[str] = None

class StreamChatView(APIView):
    # Langgraph agent
    agent_graph = LoadInitialAgentConfig.get_instance()

    IST = pytz.timezone("Asia/Kolkata")
    today_date = datetime.now(IST).strftime("%B %d, %Y")

    async def event_generator(self, events_iter):
        assistant_msg = ""
        thread_created = False
        try:
            # --- Thread creation (if no threadId provided but senderId exists)
            if not self.current_thread_id and self.sender_id:
                # run both tasks concurrently
                title_response:ChatTitleResponse = await self.agent_graph.chat_title_service.create_title_for_threads({"user_message": self.user_message})
                if not title_response.success:
                    err_payload = {"error": title_response.error}
                    yield f"event: error\ndata: {json.dumps(err_payload)}\n\n"

                if isinstance(title_response, ChatTitleResponse) and title_response.data:
                    title = title_response.data.get("title", "New Chat")

                thread_response:ChatThreadResponse = await sync_to_async(self.agent_graph.chat_thread_service.create_chat_thread)({"user_id": self.sender_id, "title": title})
                if not thread_response.success:
                    err_payload = {"error": thread_response.error}
                    yield f"event: error\ndata: {json.dumps(err_payload)}\n\n"

                if isinstance(thread_response, ChatThreadResponse) and thread_response.data:
                    thread_id = getattr(thread_response.data, "id", None)

                if thread_id:
                    self.current_thread_id = thread_id
                    thread_created = True
                    new_thread = {"data": {"id": thread_id}, "title": title}
                    yield f"event: threadCreated\ndata: {json.dumps(new_thread)}\n\n"
            
            # --- Stream assistant response by iterating agent events            
            async for event in events_iter:
                if event["event"] == "on_chat_model_stream" and event["name"] == "ChatGoogleGenerativeAI" and event["metadata"]["langgraph_node"] == "call_model":
                    # Stream only chunks from the *last* root model run
                    if "data" in event and "chunk" in event["data"]:
                        chunk = event["data"]["chunk"]
                        text = getattr(chunk, "content", None)
                        if text:
                            yield f"data: {text}\n\n"
                            # Split text into words, preserving punctuation
                            # words = re.findall(r'\S+\s*', text)  # each element includes trailing spaces
                            # chunk_size = 10
                            # for i in range(0, len(words), chunk_size):
                            #     small_chunk = ''.join(words[i:i + chunk_size])
                            #     yield f"data: {small_chunk}\n\n"

                elif event["event"] == "on_chain_end" and not event.get("parent_ids"):
                    messages = event["data"]["output"]["messages"]
                    assistant_msg = messages[-1].content if messages else ""
                    
                    # Persist messages into memory / DB
                    try:
                        if self.current_thread_id:
                            user_response = await sync_to_async(self.agent_graph.chat_message_service.create_chat_message)(data={"thread_id": self.current_thread_id,"role": "user","content": self.user_message})
                            if not user_response.success:
                                err_payload = {"error": user_response.error, "role": "user"}
                                yield f"event: error\ndata: {json.dumps(err_payload)}\n\n"

                            assistant_response = await sync_to_async(self.agent_graph.chat_message_service.create_chat_message)(data={"thread_id": self.current_thread_id,"role": "assistant","content": assistant_msg})
                            if not assistant_response.success:
                                err_payload = {"error": assistant_response.error, "role": "assistant"}
                                yield f"event: error\ndata: {json.dumps(err_payload)}\n\n"

                    except Exception as e:
                        err_payload = {"error": str(e), "role": "system"}
                        yield f"event: error\ndata: {json.dumps(err_payload)}\n\n"

                    # final event with assistant response and thread id (if created)
                    payload = {
                        "assistantResponse": assistant_msg,
                        "threadId": self.current_thread_id if thread_created else self.current_thread_id,
                    }
                    yield ("event: assistantResponseCompleted\n"f"data: {json.dumps(payload)}\n\n")
                    # mark the SSE stream as completed
                    yield "event: done\ndata: end\n\n"
                    return
                
                elif event['event'] == "error":
                    # if agent reported an error event, forward it to client
                    err_payload = event.get("data", {"error": "unknown error"})
                    print(err_payload)
                    yield f"event: error\ndata: {json.dumps(err_payload)}\n\n"

                else:
                    # handle or ignore other event types
                    # optionally forward generic event with its data
                    try:
                        if "data" in event:
                            yield f"event: {event['event']}\ndata: {json.dumps(event.get('data'))}\n\n"
                    except Exception:
                        pass

        except ValidationError as ve:
            yield f"event: error\ndata: {json.dumps({'Validation error': ve.errors()})}\n\n"
        except Exception as e:
            print(str(e))
            yield f"event: error\ndata: {json.dumps({'error': str(e)})}\n\n"

    @staticmethod
    def async_to_sync_generator(async_gen):
        """
        Convert an async generator to a sync generator for StreamingHttpResponse.
        """
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)

        agent = async_gen.__aiter__()
        try:
            while True:
                try:
                    chunk = loop.run_until_complete(agent.__anext__())
                    yield chunk
                except StopAsyncIteration:
                    break
        finally:
            # Ensure the async generator is closed
            try:
                loop.run_until_complete(agent.aclose())
            except Exception as e:
                print(f"Error occured while closing the event loop {str(e)}")
                pass

            pending = asyncio.all_tasks(loop)
            if pending:
                loop.run_until_complete(asyncio.gather(*pending, return_exceptions=True))

            loop.close()


    def post(self, request):
        try:
            data = request.data
            validatedData = StreamChatSchema(**data)
            print(validatedData)

            # normalize commonly used values
            self.user_message: str = getattr(validatedData, "userMessage", "")
            self.sender_id: str = getattr(validatedData, "senderId", "")
            self.current_thread_id: Optional[str] = getattr(validatedData, "threadId", None)

            # fetch last messages for the thread if available (handle None)
            last_msgs: List[StateMessage] = []
            
            print(self.current_thread_id)
            if self.current_thread_id:
                try:
                    thread_messages_response:ChatMessagesResponse = self.agent_graph.chat_message_service.list_recent_thread_messages(thread_id=str(self.current_thread_id))
                    print(thread_messages_response)
                    if not thread_messages_response.success:
                        return Response(
                            {"success": False, "error": f"Error occured while retreieving the recent messages {thread_messages_response.error}"},
                            status=status.HTTP_400_BAD_REQUEST
                        )
                    
                    last_msgs = [msg.model_dump() for msg in thread_messages_response.data]
                except Exception as e:
                    return Response(
                        {"success": False, "error": f"Error occured while retreieving the recent messages {str(e)}"},
                        status=status.HTTP_400_BAD_REQUEST
                    )
                
            print(last_msgs, "last messages array")
            # reframe/optimize user query
            try:
                reframed = async_to_sync(self.agent_graph.reframe_user_query)(user_input=self.user_message, last_messages=last_msgs)
            except Exception:
                # fallback to raw user message if reframing fails
                reframed = {"optimized_query": self.user_message, "selected_tools": []}

            internal_message = {
                "query": reframed["optimized_query"],
                "selected_tools": reframed.get("selected_tools", []),
            }
            print(internal_message, "optmized query")

            messages_state: MessageState = {
                "messages": [
                    {"role": "system", "content": SYSTEM_PROMPT.format(today_date=self.today_date)},
                    *last_msgs[-5:],
                    {"role": "user", "content": "optimized_query: " + json.dumps(internal_message)},
                ]
            }

            events_iter = self.agent_graph.agent_graph.astream_events(input=messages_state, version='v2')
            response = StreamingHttpResponse(self.async_to_sync_generator(self.event_generator(events_iter)), content_type="text/event-stream")
            return response
    
        except ValidationError as ve:
            return Response(
                {"success": False, "error": "Invalid request data", "details": ve.errors()},
                status=status.HTTP_400_BAD_REQUEST
            )
        except Exception as e:
            return Response(
                {"success": False, "error": "Internal server error"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )