from rest_framework.views import APIView
from pydantic import BaseModel, ValidationError
from typing import Optional, List
from langgraph.graph import StateMessage
from ..services.model_message_service import ChatMessageService, ChatMessagesResponse
from rest_framework.response import Response
from rest_framework import status
from django.apps import apps

# # Get the app config instance
# text_generation_config = apps.get_app_config('text_generation')  # 'text_generation' = name in apps.py

# class StreamChatSchema(BaseModel):
#     userMessage: str
#     senderId: str
#     threadId: Optional[str]

# class StreamChatView(APIView):
#     chat_message_service = ChatMessageService()

#     async def post(self, request):
#             try:
#                 raw_body = await request.body()
#                 if not raw_body:
#                     return Response({"success": False, "error": "body cannot be empty"}, status=status.HTTP_400_BAD_REQUEST)
                
#                 raw_json = await request.json() 
#                 validatedData = StreamChatSchema(**raw_json)
#             except ValidationError as e:
#                 return Response({"success": False, "error": "Invalid request data", "details": e.errors()}, status=status.HTTP_400_BAD_REQUEST)
            
#             # normalize commonly used values
#             user_message: str = getattr(validatedData, "userMessage", "")
#             sender_id: str = getattr(validatedData, "senderId", "")
#             current_thread_id: Optional[str] = getattr(validatedData, "threadId", None)

#             # fetch last messages for the thread if available (handle None)
#             last_msgs: List[StateMessage] = []
#             if current_thread_id:
#                 try:
#                     response: ChatMessagesResponse = self.chat_message_service.get_thread_messages(thread_id=str(current_thread_id))
#                     if isinstance(response, ChatMessagesResponse) and response.success and response.data:
#                         last_msgs = [msg.model_dump() for msg in response.data[-10:]]
#                     else:
#                         last_msgs = []
#                 except Exception:
#                     last_msgs = []


#             # reframe/optimize user query
#             try:
#                 reframed = await text_generation_config.reframe_user_query(user_input=user_message, last_messages=last_msgs)
#             except Exception:
#                 # fallback to raw user message if reframing fails
#                 reframed = {"optimized_query": user_message, "selected_tools": []}

#             internal_message = {
#                 "query": reframed["optimized_query"],
#                 "selected_tools": reframed.get("selected_tools", []),
#             }
#             print(internal_message, "optmized query")


# async def stream_chat(req: Request):
#     messages_state: MessageState = {
#         "messages": [
#             {"role": "system", "content": SYSTEM_PROMPT.format(today_date=today_date)},
#             *last_msgs[-5:],
#             {"role": "user", "content": "optimized_query: " + json.dumps(internal_message)},
#         ]
#     }
#     # messages_state: MessagesState = convert_to_standard_messages(database_msg_state)

#     # assume email_agent_graph.astream is an async iterator over events
#     events_iter = email_agent_graph.astream_events(input=messages_state, version='v2')

#     async def event_generator(events_iter):
#         nonlocal current_thread_id
#         assistant_msg = ""
#         thread_created = False

#         try:
#             # --- Thread creation (if no threadId provided but senderId exists)
#             if not current_thread_id and validatedData.senderId:
#                 # run both tasks concurrently
#                 title_response:ChatTitleResponse = await chat_title_service.create_title_for_threads({"user_message": user_message})
#                 thread_response:ChatThreadService = chat_thread_service.create_chat_thread({"user_id": sender_id, "title": "New Chat"})

#                 title: str = "New Chat"
#                 if isinstance(title_response, ChatTitleResponse) and title_response.data:
#                     title = getattr(title_response.data, "title", "New Chat")

#                 thread_id = None
#                 if isinstance(thread_response, ChatThreadResponse) and thread_response.data:
#                     thread_id = getattr(thread_response.data, "id", None)

#                 if thread_id:
#                     # update title if a nicer title was generated
#                     if title != "New Chat":
#                         try:
#                             chat_thread_service.update_chat_thread(thread_id, {"title": title})
#                         except Exception:
#                             pass

#                     current_thread_id = thread_id
#                     thread_created = True
#                     new_thread = {"data": {"id": thread_id}, "title": title}
#                     yield f"event: threadCreated\ndata: {json.dumps(new_thread)}\n\n"
            
#             # --- Stream assistant response by iterating agent events            
#             async for event in events_iter:
#                 if event["event"] == "on_chat_model_stream":
#                     # Stream only chunks from the *last* root model run
#                     if "data" in event and "chunk" in event["data"]:
#                         chunk = event["data"]["chunk"]
#                         text = getattr(chunk, "content", None)
#                         if text:
#                             # Split text into words, preserving punctuation
#                             words = re.findall(r'\S+\s*', text)  # each element includes trailing spaces
#                             chunk_size = 5
#                             for i in range(0, len(words), chunk_size):
#                                 small_chunk = ''.join(words[i:i + chunk_size])
#                                 yield f"data: {small_chunk}\n\n"
                            
#                 elif event["event"] == "on_chain_end" and not event.get("parent_ids"):
#                     messages = event["data"]["output"]["messages"]
#                     assistant_msg = messages[-1].content if messages else ""
                    
#                     # Persist messages into memory / DB
#                     try:
#                         if current_thread_id:
#                             chat_message_service.create_chat_message(data={"thread_id": current_thread_id,"role": "user","content": user_message})
#                             chat_message_service.create_chat_message(data={"thread_id": current_thread_id,"role": "assistant","content": assistant_msg})
#                     except Exception:
#                         pass

#                     # final event with assistant response and thread id (if created)
#                     payload = {
#                         "assistantResponse": assistant_msg,
#                         "threadId": current_thread_id if thread_created else current_thread_id,
#                     }
#                     yield ("event: assistantResponseCompleted\n"f"data: {json.dumps(payload)}\n\n")
#                     # mark the SSE stream as completed
#                     yield "event: done\ndata: end\n\n"
#                     return
                
#                 elif event['event'] == "error":
#                     # if agent reported an error event, forward it to client
#                     err_payload = event.get("data", {"error": "unknown error"})
#                     print(err_payload)
#                     yield f"event: error\ndata: {json.dumps(err_payload)}\n\n"

#                 else:
#                     # handle or ignore other event types
#                     # optionally forward generic event with its data
#                     try:
#                         if "data" in event:
#                             yield f"event: {event['event']}\ndata: {json.dumps(event.get('data'))}\n\n"
#                     except Exception:
#                         pass
#         except ValidationError as ve:
#             yield f"event: error\ndata: {json.dumps({'Validation error': str(ve)})}\n\n"
#         except Exception as e:
#             print(str(e))
#             yield f"event: error\ndata: {json.dumps({'error': str(e)})}\n\n"

#     return StreamingResponse(event_generator(events_iter), media_type="text/event-stream")