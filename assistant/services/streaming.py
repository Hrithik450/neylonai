import json
from asgiref.sync import sync_to_async
from pydantic import ValidationError

from api.services.title_service import ThreadTitleResponse, ThreadTitleService
from api.services.thread_service import ThreadsResponse, ThreadService
from api.services.message_service import ThreadMessageService, ThreadMessageResponse
from langchain_core.messages import AIMessage


class AgentStreamService:

    @staticmethod
    async def create_thread(sender_id, user_input):
        title_response: ThreadTitleResponse = (
            await ThreadTitleService.create_title_for_threads(
                {"user_input": user_input}
            )
        )

        title = "New Chat"
        if title_response.success and title_response.data:
            title = title_response.data.get("title", "New Chat")

        thread_response: ThreadsResponse = await sync_to_async(
            ThreadService.create_chat_thread
        )({"user_id": sender_id, "title": title})

        if not thread_response.success:
            return None, None
        return thread_response.data.id, thread_response.data

    @staticmethod
    async def event_generator(events_iter, user_input, thread_id, sender_id):
        try:
            if sender_id and not thread_id:
                thread_id, thread_data = await AgentStreamService.create_thread(
                    sender_id, user_input
                )
                if thread_data:
                    yield json.dumps(
                        {
                            "event": "threadCreated",
                            "data": thread_data.model_dump(),
                        }
                    )

            async for event in events_iter:
                if (
                    event["event"] == "on_chat_model_stream"
                    and event["metadata"].get("langgraph_node") == "agent"
                ):
                    chunk = event["data"]["chunk"]
                    text = getattr(chunk, "content", None)
                    if text:
                        yield json.dumps({"event": "assistantResponse", "data": text})

                elif event["event"] == "on_chain_end" and not event.get("parent_ids"):
                    messages = event["data"]["output"]["messages"]
                    if isinstance(messages[-1], AIMessage):
                        assistant_message = messages[-1].content
                        yield json.dumps(
                            {"event": "assistantResponse", "data": assistant_message}
                        )

                    if sender_id and thread_id:
                        await sync_to_async(ThreadMessageService.create_thead_message)(
                            data={
                                "role": "user",
                                "thread_id": thread_id,
                                "content": user_input,
                            }
                        )
                        await sync_to_async(ThreadMessageService.create_thead_message)(
                            data={
                                "role": "assistant",
                                "thread_id": thread_id,
                                "content": assistant_message,
                            }
                        )
                    yield json.dumps({"event": "done", "data": "end"})
                    return

                elif event["event"] == "error":
                    err_payload = event.get("data", {"error": "unknown error"})
                    yield json.dumps({"event": "error", "data": err_payload})
                    return

        except ValidationError as ve:
            yield json.dumps({"event": "error", "data": {"error": ve.errors()}})
            return

        except Exception as e:
            yield json.dumps({"event": "error", "data": {"error": str(e)}})
            return
