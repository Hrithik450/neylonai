from ..utils.prompts import RESUME_EXTRACTOR_PROMPT, GENERAL_SYSTEM_PROMPT, RESUME_SYSTEM_PROMPT
from core_manager.services.model_thread_service import ChatThreadResponse, ChatThreadService
from core_manager.services.model_title_service import ChatTitleResponse, ChatTitleService
from core_manager.services.model_message_service import ChatMessageService
from langchain_core.messages import HumanMessage, SystemMessage, AIMessage
from pydantic import BaseModel, ValidationError, field_validator, Field
from core_manager.services.model_user_service import UserService
from apscheduler.schedulers.background import BackgroundScheduler
from ..services.resume_service import ResumeService
from django.http import StreamingHttpResponse
from ..utils.resume_utils import ResumeUtils
from rest_framework.response import Response
from rest_framework.views import APIView
from asgiref.sync import async_to_sync
from django.core.files import File
from rest_framework import status
from django.utils import timezone
from datetime import datetime
from datetime import timedelta
from typing import Optional
import traceback
import tempfile
import time
import pytz
import json
import os

class GenerateResumeSchema(BaseModel):
    userMessage: str = Field(..., min_length=1, max_length=1500, description="Your message is too long. Please shorten it to 1500 characters or fewer.")
    senderId: str = Field(..., min_length=1, description="Please provide sender id.")
    threadId: Optional[str] = None

    @field_validator("*", mode='before')
    def normalize(cls, v):
        """If a field is a list with one element, unwrap it"""
        if isinstance(v, list) and len(v) == 1:
            return v[0]
        return v

class ResumeView(APIView):

    RESUME_KEYWORDS = ["education", "experience", "skills", "projects", "linkedin", "email", "contact", "profile", "certifications", "React.js", "Next.js", "Tailwind CSS", "Langchain", "Langgraph", "Chroma DB", "OpenAI", "Google Gemini", "Django", "FastAPI", "Express.js", "Node.js", "Postman API", "WebSockets", "REST API", "REST APIs", "MongoDB", "PostgreSQL", "Google Cloud Platform", "GCP", "Firebase", "Python", "JavaScript", "C++", "Git", "GitHub", "Vercel", "Render", "VPS", "Figma", "Cloud Run", "Frontend", "Backend", "Fullstack", "Full-stack", "AI", "Machine Learning", "Deep Learning", "NLP"]
    today_date = datetime.now(pytz.timezone("Asia/Kolkata")).strftime("%B %d, %Y")
    MAX_FILE_SIZE = 2 * 1024 * 1024
    ALLOWED_EXTENSIONS = [".pdf"]

    scheduler = BackgroundScheduler()
    scheduler.start()

    resume_service = ResumeService()
    chat_thread_service = ChatThreadService()
    chat_message_service = ChatMessageService()
    chat_title_service = ChatTitleService()
    user_service = UserService()
    
    @classmethod
    def stream_response(cls):
        try:
            if not cls.current_thread_id and cls.sender_id:
                title_response:ChatTitleResponse = async_to_sync(cls.chat_title_service.create_title_for_threads)({"user_message": cls.user_message})
                if not title_response.success:
                    err_payload = {"error": title_response.error}
                    yield f"event: error<|EVENT_BREAK|>data: {json.dumps(err_payload)}<|END_OF_EVENT|>"
                    return

                if isinstance(title_response, ChatTitleResponse) and title_response.data:
                    title = title_response.data.get("title", "New Chat")

                thread_response:ChatThreadResponse = cls.chat_thread_service.create_chat_thread({"user_id": cls.sender_id, "title": title})
                if not thread_response.success:
                    err_payload = {"error": thread_response.error}
                    yield f"event: error<|EVENT_BREAK|>data: {json.dumps(err_payload)}<|END_OF_EVENT|>"
                    return

                if isinstance(thread_response, ChatThreadResponse) and thread_response.data:
                    thread_id = getattr(thread_response.data, "id", None)

                if thread_id and thread_response.data:
                    cls.current_thread_id = thread_id
                    payload = json.dumps(thread_response.data.model_dump())
                    yield f"event: threadCreated<|EVENT_BREAK|>data: {payload}<|END_OF_EVENT|>"

            intent = cls.resume_service.handle_classification_node(user_message=cls.user_message, history=cls.conversation_history)
            print(intent, "intent")
            if "general_followup" in intent:
                messages = [SystemMessage(content=GENERAL_SYSTEM_PROMPT)]
                if cls.conversation_history:
                    for msg in cls.conversation_history:
                        role = msg.get("role")
                        content = msg.get("content")
                        if role == "user":
                            messages.append(HumanMessage(content=content))
                        elif role == "assistant":
                            messages.append(AIMessage(content=content))
                messages.append(HumanMessage(content=cls.user_message))
                for chunk in cls.resume_service.gemini_model.stream(input=messages):
                    if hasattr(chunk, "content") and chunk.content:
                        cls.assistant_msg += chunk.content
                        yield f"event: assistantResponse<|EVENT_BREAK|>data: {chunk.content}<|END_OF_EVENT|>"

            elif "resume_followup" in intent:
                messages = [SystemMessage(content=RESUME_SYSTEM_PROMPT)]
                messages.append(next((AIMessage(content=m["content"]) for m in reversed(cls.conversation_history) if m["role"] == "assistant"), None))
                messages.append(next((HumanMessage(content=m["content"]) for m in reversed(cls.conversation_history) if m["role"] == "user"), None))
                messages.append(HumanMessage(content=cls.user_message))

                for chunk in cls.resume_service.gemini_model.stream(input=messages):
                    if hasattr(chunk, "content") and chunk.content:
                        cls.assistant_msg += chunk.content
                        yield f"event: assistantResponse<|EVENT_BREAK|>data: {chunk.content}<|END_OF_EVENT|>"

                yield f"event: thinkingPhase<|EVENT_BREAK|>data: {json.dumps({"thinking": "true", "thinkingPhase": "ats_optimization"})}<|END_OF_EVENT|>"
                messages = [
                    SystemMessage(content=RESUME_EXTRACTOR_PROMPT),
                    HumanMessage(content=cls.assistant_msg)
                ]
                openai_response = cls.resume_service.openai_model.invoke(input=messages)
                cls.resume_json = ResumeUtils.parse_json(openai_response.content)

                tmp_dir = tempfile.gettempdir()
                os.makedirs(tmp_dir, exist_ok=True)

                local_path = os.path.join(tmp_dir, cls.sender_id)
                abs_file_path = os.path.abspath(local_path)

                build_response = ResumeUtils.build_resume(cls.resume_json, abs_file_path)
                if build_response.success:
                    response = ResumeUtils.save_generated_resume(sender_id=cls.sender_id, abs_file_path=abs_file_path)
                    if response.success:
                        cls.generated_url = response.data
                        yield f"event: fileUrls<|EVENT_BREAK|>data: {json.dumps({'type':'generated', 'url': cls.generated_url})}<|END_OF_EVENT|>"
                else:
                    error_payload = {"error": build_response.error, "traceback": traceback.format_exc()}
                    yield f"event: error<|EVENT_BREAK|>data: {json.dumps(error_payload)}<|END_OF_EVENT|>"
                    return
                
                delete_time = timezone.now() + timedelta(minutes=5)
                cls.scheduler.add_job(ResumeUtils.delete_file, 'date', run_date=delete_time, args=[abs_file_path])
                
            elif "adapt" in intent:
                yield f"event: thinkingPhase<|EVENT_BREAK|>data: {json.dumps({"thinking": "true", "thinkingPhase": "resume_build"})}<|END_OF_EVENT|>"
                time.sleep(0.25)
                if not cls.resume_content:
                    yield f"event: humanError<|EVENT_BREAK|>data: ⚠️ No uploaded resume found. Please upload a resume file to proceed.<|END_OF_EVENT|>"
                    return
                yield f"event: fileUrls<|EVENT_BREAK|>data: {json.dumps({'type':'original', 'url': cls.uploaded_url})}<|END_OF_EVENT|>"
                
                resume_text = cls.resume_content.get("resume", "")
                resume_links = cls.resume_content.get("links", [])
                
                messages = [
                    SystemMessage(content=RESUME_SYSTEM_PROMPT),
                    HumanMessage(content=f"Hyperlinks:{resume_links}\nResume Text:{resume_text}\nUser request:{cls.user_message}")
                ]
                for chunk in cls.resume_service.gemini_model.stream(input=messages):
                    if hasattr(chunk, "content") and chunk.content:
                        cls.assistant_msg += chunk.content
                        yield f"event: assistantResponse<|EVENT_BREAK|>data: {chunk.content}<|END_OF_EVENT|>"

                yield f"event: thinkingPhase<|EVENT_BREAK|>data: {json.dumps({"thinking": "true", "thinkingPhase": "ats_optimization"})}<|END_OF_EVENT|>"
                messages = [
                    SystemMessage(content=RESUME_EXTRACTOR_PROMPT),
                    HumanMessage(content=cls.assistant_msg)
                ]
                openai_response = cls.resume_service.openai_model.invoke(input=messages)
                cls.resume_json = ResumeUtils.parse_json(openai_response.content)

                tmp_dir = tempfile.gettempdir()
                os.makedirs(tmp_dir, exist_ok=True)

                local_path = os.path.join(tmp_dir, cls.sender_id)
                abs_file_path = os.path.abspath(local_path)

                build_response = ResumeUtils.build_resume(cls.resume_json, abs_file_path)
                if build_response.success:
                    response = ResumeUtils.save_generated_resume(sender_id=cls.sender_id, abs_file_path=abs_file_path)
                    if response.success:
                        cls.generated_url = response.data
                        yield f"event: fileUrls<|EVENT_BREAK|>data: {json.dumps({'type':'generated', 'url': cls.generated_url})}<|END_OF_EVENT|>"
                else:
                    error_payload = {"error": build_response.error, "traceback": traceback.format_exc()}
                    yield f"event: error<|EVENT_BREAK|>data: {json.dumps(error_payload)}<|END_OF_EVENT|>"
                    return
                
                delete_time = timezone.now() + timedelta(minutes=5)
                cls.scheduler.add_job(ResumeUtils.delete_file, 'date', run_date=delete_time, args=[abs_file_path])

            elif "ats" in intent:
                yield f"event: thinkingPhase<|EVENT_BREAK|>data: {json.dumps({"thinking": "true", "thinkingPhase": "ats_optimization"})}<|END_OF_EVENT|>"
                time.sleep(0.25)
                if not cls.resume_content:
                    yield f"event: humanError<|EVENT_BREAK|>data: ⚠️ No uploaded resume found. Please upload a resume file to proceed.<|END_OF_EVENT|>"
                    return
                yield f"event: fileUrls<|EVENT_BREAK|>data: {json.dumps({'type':'original', 'url': cls.uploaded_url})}<|END_OF_EVENT|>"
                
                resume_text = cls.resume_content.get("resume", "")
                resume_links = cls.resume_content.get("links", [])

                messages = [
                    SystemMessage(content=RESUME_EXTRACTOR_PROMPT),
                    HumanMessage(content=f"Hyperlinks:{resume_links}\nResume Text:{resume_text}\nUser request:{cls.user_message}")
                ]
                openai_response = cls.resume_service.openai_model.invoke(input=messages)
                cls.resume_json = ResumeUtils.parse_json(openai_response.content)
                
                tmp_dir = tempfile.gettempdir()
                os.makedirs(tmp_dir, exist_ok=True)

                local_path = os.path.join(tmp_dir, cls.sender_id)
                abs_file_path = os.path.abspath(local_path)

                build_response = ResumeUtils.build_resume(cls.resume_json, abs_file_path)
                if build_response.success:
                    response = ResumeUtils.save_generated_resume(sender_id=cls.sender_id, abs_file_path=abs_file_path)
                    if response.success:
                        cls.generated_url = response.data
                        cls.assistant_msg = "Here’s the enhanced version of your ATS-ready resume."
                        yield f"event: assistantResponse<|EVENT_BREAK|>data: {cls.assistant_msg}<|END_OF_EVENT|>"
                        time.sleep(0.25)
                        yield f"event: fileUrls<|EVENT_BREAK|>data: {json.dumps({'type':'generated', 'url': cls.generated_url})}<|END_OF_EVENT|>"
                else:
                    error_payload = {"error": build_response.error, "traceback": traceback.format_exc()}
                    yield f"event: error<|EVENT_BREAK|>data: {json.dumps(error_payload)}<|END_OF_EVENT|>"
                    return
                
                delete_time = timezone.now() + timedelta(minutes=5)
                cls.scheduler.add_job(ResumeUtils.delete_file, 'date', run_date=delete_time, args=[abs_file_path])

            else:
                messages = [
                    SystemMessage(content=GENERAL_SYSTEM_PROMPT.format(today_date=cls.today_date)),
                    HumanMessage(content=cls.user_message.strip().lower())
                ]
                for chunk in cls.resume_service.gemini_model.stream(input=messages):
                    if hasattr(chunk, "content") and chunk.content:
                        cls.assistant_msg += chunk.content
                        yield f"event: assistantResponse<|EVENT_BREAK|>data: {chunk.content}<|END_OF_EVENT|>"
            
            if cls.current_thread_id:
                if cls.uploaded_url:
                    user_response = cls.chat_message_service.create_chat_message(data={"thread_id": cls.current_thread_id,"role": "user", "file_url": cls.uploaded_url, "content": cls.user_message})
                else:
                    user_response = cls.chat_message_service.create_chat_message(data={"thread_id": cls.current_thread_id,"role": "user", "content": cls.user_message})
                if not user_response.success:
                    err_payload = {"error": user_response.error, "details": traceback.format_exc()}
                    yield f"event: error<|EVENT_BREAK|>data: {json.dumps(err_payload)}<|END_OF_EVENT|>"
                    return
                
                if cls.generated_url:
                    assistant_response = cls.chat_message_service.create_chat_message(data={"thread_id": cls.current_thread_id,"role": "assistant", "file_url": cls.generated_url, "content": cls.assistant_msg})
                else:
                    assistant_response = cls.chat_message_service.create_chat_message(data={"thread_id": cls.current_thread_id,"role": "assistant", "content": cls.assistant_msg})
                if not assistant_response.success:
                    err_payload = {"error": assistant_response.error, "details": traceback.format_exc()}
                    yield f"event: error<|EVENT_BREAK|>data: {json.dumps(err_payload)}<|END_OF_EVENT|>"
                    return
                
                deduct_tokens_response = cls.user_service.deduct_tokens(deduction_tokens=0, user_id=cls.sender_id, resume_gen=True)
                if not deduct_tokens_response.success:
                    err_payload = {"error": deduct_tokens_response.error}
                    yield f"event: error<|EVENT_BREAK|>data: {json.dumps(err_payload)}<|END_OF_EVENT|>"
                    return
                yield f"event: tokensUpdated<|EVENT_BREAK|>data: {json.dumps(deduct_tokens_response.data.model_dump())}<|END_OF_EVENT|>"
                time.sleep(0.25)
                yield f"event: done<|EVENT_BREAK|>data: end<|END_OF_EVENT|>"
                return

        except Exception as e:
            error_payload = {"error": str(e), "traceback": traceback.format_exc()}
            yield f"event: error<|EVENT_BREAK|>data: {json.dumps(error_payload)}<|END_OF_EVENT|>"
            return

    @classmethod
    def post(cls, request):
        try:
            data = request.data
            validatedData = GenerateResumeSchema(**data)

            cls.assistant_msg = ""
            cls.uploaded_url = None
            cls.generated_url = None
            cls.resume_content = None
            cls.conversation_history = None
            cls.sender_id: str = getattr(validatedData, "senderId", None)
            cls.user_message: str = getattr(validatedData, "userMessage", None)
            cls.current_thread_id: Optional[str] = getattr(validatedData, "threadId", None)

            if cls.current_thread_id:
                response = ResumeUtils.get_conversation_history(thread_id=cls.current_thread_id)
                if not response.success:
                    return Response({"success": False, "error": response.error}, status=status.HTTP_400_BAD_REQUEST)
                cls.conversation_history = response.data

            file: File = request.FILES.get("file")
            if file:
                ext = os.path.splitext(file.name)[1].lower()
                if ext not in cls.ALLOWED_EXTENSIONS:
                    return Response({"success": False, "error": "Invalid file type. Only PDF files are allowed.", "details": traceback.format_exc()}, status=status.HTTP_400_BAD_REQUEST)
                
                if file.size > cls.MAX_FILE_SIZE:
                    return Response({"success": False, "error": "File size exceeds the 2MB limit", "details": traceback.format_exc()}, status=status.HTTP_400_BAD_REQUEST)
                
                if not ResumeUtils.is_resume(file, cls.RESUME_KEYWORDS):
                    return Response({"success": False, "error": "Uploaded file does not appear to be a valid resume", "details": traceback.format_exc()}, status=status.HTTP_400_BAD_REQUEST)
                
                response = ResumeUtils.save_uploaded_resume(file=file, sender_id=cls.sender_id)
                if not response.success:
                    return Response({"success": False, "error": response.error}, status=status.HTTP_400_BAD_REQUEST)
                cls.uploaded_url = response.data

                response = ResumeUtils.extract_resume(file=file)
                if not response.success:
                    return Response({"success": False, "error": response.error}, status=status.HTTP_400_BAD_REQUEST)      
                cls.resume_content = response.data

            return StreamingHttpResponse(cls.stream_response(), content_type="text/plain; charset=utf-8")
        
        except ValidationError as ve:
            return Response({"success": False, "error": f"Invalid request data: {str(ve.errors())}", "traceback": traceback.format_exc()}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            return Response({"success": False, "error": str(e), "details": traceback.format_exc()}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)