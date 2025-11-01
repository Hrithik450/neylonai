from ..lib.utils import RESUME_EXTRACTOR_PROMPT, RESUME_SYSTEM_PROMPT, GENERAL_SYSTEM_PROMPT, parse_json, build_resume, test_resume_data
from langchain_core.messages import ToolMessage, HumanMessage, SystemMessage, AIMessage
from core_manager.services.model_message_service import ChatMessagesResponse, ChatMessageService
from core_manager.services.model_thread_service import ChatThreadResponse, ChatThreadService
from core_manager.services.model_title_service import ChatTitleResponse, ChatTitleService
from pydantic import BaseModel, ValidationError, field_validator
from core_manager.services.model_user_service import UserService
from apscheduler.schedulers.background import BackgroundScheduler
from langchain_google_genai import ChatGoogleGenerativeAI
from django.core.files.storage import default_storage
from django.core.files.base import ContentFile
from django.http import StreamingHttpResponse
from rest_framework.response import Response
from langgraph.graph import MessagesState
from rest_framework.views import APIView
from langchain_openai import ChatOpenAI
from asgiref.sync import async_to_sync
from django.core.files import File
from rest_framework import status
from django.utils import timezone
from datetime import datetime
from datetime import timedelta
from dotenv import load_dotenv
from typing import List, Dict
from PyPDF2 import PdfReader
from typing import Optional
from io import BytesIO
import traceback
import tempfile
import time
import pytz
import json
import os

class GenerateResumeSchema(BaseModel):
    userMessage: str
    senderId: str
    threadId: Optional[str] = None

    @field_validator("*", mode='before')
    def normalize(cls, v):
        """If a field is a list with one element, unwrap it"""
        if isinstance(v, list) and len(v) == 1:
            return v[0]
        return v

class GenerateResumeUtils:

    @staticmethod
    def delete_file(*file_paths):
        for path in file_paths:
            if os.path.exists(path):
                os.remove(path)
                print(f"🗑 Deleted temporary file: {path}")

    @staticmethod
    def is_resume(file: File, resume_words: List[str]) -> bool:
        pdf_reader = PdfReader(BytesIO(file.read()))
        text = ""
        for page in pdf_reader.pages:
            text += page.extract_text() or ""
        text = text.lower()
        matches = sum(1 for word in resume_words if word in text)
        file.seek(0)
        return matches>=4
    
    @staticmethod
    def extract_resume(file: File) -> Dict[str, List[str]]:
        print(file)
        pdf_reader = PdfReader(BytesIO(file.read()))
        text = ""
        links = set()

        for page in pdf_reader.pages:
            text += page.extract_text() or ""
            annots = page.get("/Annots")
            if annots:
                for annot_ref in annots:
                    annot = annot_ref.get_object()
                    if annot.get("/A") and annot["/A"].get("/URI"):
                        links.add(annot["/A"]["/URI"])
        return {"resume": text.strip(), "links": list(links)}

class GenerateResumeService:

    load_dotenv()
    OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
    GEMINI_API_KEY=os.getenv("GOOGLE_API_KEY")

    gemini_model = ChatGoogleGenerativeAI(
        model='gemini-2.5-flash',
        temperature=0.4,
        max_retries=2,
        google_api_key=GEMINI_API_KEY,
        streaming=True
    )
    openai_model = ChatOpenAI(
        model="gpt-4o-mini",
        temperature=0.4,
        api_key=OPENAI_API_KEY
    )

    @classmethod
    def classification_node(cls, state: MessagesState) -> MessagesState:
        user_input_message = next((msg for msg in reversed(state['messages']) if isinstance(msg, HumanMessage)), None)

        CLASSIFY_PROMPT = f"""
            Classify the following user request into one of three intents:
            - "general" if it's a general question or chat unrelated to resumes
            - "ats" if user only wants an ATS resume
            - "adapt" if user wants to tailor or rewrite a resume for a specific role
            
            Return only one word: general / ats / adapt
            User Input: "{user_input_message.content}"
        """
        
        response = cls.openai_model.invoke(input=[HumanMessage(content=CLASSIFY_PROMPT)])
        state["messages"].append(AIMessage(content=response.content.strip().lower()))
        return state

class GenerateResumeView(APIView):

    RESUME_KEYWORDS = ["education", "experience", "skills", "projects", "linkedin", "email", "contact", "profile", "certifications", "React.js", "Next.js", "Tailwind CSS", "Langchain", "Langgraph", "Chroma DB", "OpenAI", "Google Gemini", "Django", "FastAPI", "Express.js", "Node.js", "Postman API", "WebSockets", "REST API", "REST APIs", "MongoDB", "PostgreSQL", "Google Cloud Platform", "GCP", "Firebase", "Python", "JavaScript", "C++", "Git", "GitHub", "Vercel", "Render", "VPS", "Figma", "Cloud Run", "Frontend", "Backend", "Fullstack", "Full-stack", "AI", "Machine Learning", "Deep Learning", "NLP"]
    today_date = datetime.now(pytz.timezone("Asia/Kolkata")).strftime("%B %d, %Y")
    MAX_FILE_SIZE = 2 * 1024 * 1024
    ALLOWED_EXTENSIONS = [".pdf"]

    utils = GenerateResumeUtils()
    scheduler = BackgroundScheduler()
    scheduler.start()

    resume_service = GenerateResumeService()
    chat_thread_service = ChatThreadService()
    chat_message_service = ChatMessageService()
    chat_title_service = ChatTitleService()
    user_service = UserService()
    
    @classmethod
    def stream_response(cls, state: MessagesState):
        try:
            if not cls.current_thread_id and cls.sender_id:
                title_response:ChatTitleResponse = async_to_sync(cls.chat_title_service.create_title_for_threads)({"user_message": cls.user_message})
                if not title_response.success:
                    err_payload = {"error": title_response.error}
                    print(f"Error occurred at line 146: {err_payload}")
                    yield f"event: error<|EVENT_BREAK|>data: {json.dumps(err_payload)}<|END_OF_EVENT|>"
                    return

                if isinstance(title_response, ChatTitleResponse) and title_response.data:
                    title = title_response.data.get("title", "New Chat")

                thread_response:ChatThreadResponse = cls.chat_thread_service.create_chat_thread({"user_id": cls.sender_id, "title": title})
                if not thread_response.success:
                    err_payload = {"error": thread_response.error}
                    print(f"Error occurred at line 157: {err_payload}")
                    yield f"event: error<|EVENT_BREAK|>data: {json.dumps(err_payload)}<|END_OF_EVENT|>"
                    return

                if isinstance(thread_response, ChatThreadResponse) and thread_response.data:
                    thread_id = getattr(thread_response.data, "id", None)

                if thread_id:
                    cls.current_thread_id = thread_id
                    if thread_response.data:
                        payload = json.dumps(thread_response.data.model_dump())
                        yield f"event: threadCreated<|EVENT_BREAK|>data: {payload}<|END_OF_EVENT|>"

            classified_state = cls.resume_service.classification_node(state)
            user_input_message = next((msg for msg in reversed(state['messages']) if isinstance(msg, HumanMessage)), None)
            intent = classified_state['messages'][-1].content.strip().lower()
            
            if "adapt" in intent:
                yield f"event: thinkingPhase<|EVENT_BREAK|>data: {json.dumps({"thinking": "true", "thinkingPhase": "resume_build"})}<|END_OF_EVENT|>"
                time.sleep(0.25)
                resume_tool_message = next((msg for msg in state['messages'] if isinstance(msg, ToolMessage) and getattr(msg, "tool_call_id", "") == "uploaded_resume"), None)
                if not resume_tool_message:
                    yield f"event: humanError<|EVENT_BREAK|>data: ⚠️ No uploaded resume found. Please upload a resume file to proceed.<|END_OF_EVENT|>"
                    return
                yield f"event: fileUrls<|EVENT_BREAK|>data: {json.dumps({'type':'original', 'url': cls.uploaded_url})}<|END_OF_EVENT|>"
                
                resume_data = json.loads(resume_tool_message.content)
                resume_text = resume_data.get("resume", "")
                resume_links = resume_data.get("links", [])
                
                # messages = [
                #     SystemMessage(content=RESUME_SYSTEM_PROMPT),
                #     HumanMessage(content=f"Hyperlinks:{resume_links}\nResume Text:{resume_text}\nUser request:{user_input_message.content}")
                # ]
                # for chunk in cls.resume_service.gemini_model.stream(input=messages):
                #     if hasattr(chunk, "content") and chunk.content:
                #         yield f"event: assistantResponse<|EVENT_BREAK|>data: {chunk.content}<|END_OF_EVENT|>"
            
                messages = [
                    SystemMessage(content=GENERAL_SYSTEM_PROMPT.format(today_date=cls.today_date)),
                    HumanMessage(content=user_input_message.content.strip().lower())
                ]
                for chunk in cls.resume_service.gemini_model.stream(input=messages):
                    if hasattr(chunk, "content") and chunk.content:
                        cls.assistant_msg += chunk.content
                        yield f"event: assistantResponse<|EVENT_BREAK|>data: {chunk.content}<|END_OF_EVENT|>"

                yield f"event: thinkingPhase<|EVENT_BREAK|>data: {json.dumps({"thinking": "true", "thinkingPhase": "ats_optimization"})}<|END_OF_EVENT|>"
                messages = [
                    SystemMessage(content=RESUME_EXTRACTOR_PROMPT),
                    HumanMessage(content=f"Hyperlinks:{resume_links}\nResume Text:{resume_text}\nUser request:{user_input_message.content}")
                ]
                # openai_response = cls.resume_service.openai_model.invoke(input=messages)
                # cls.resume_json = parse_json(openai_response.content)

                tmp_dir = tempfile.gettempdir()
                os.makedirs(tmp_dir, exist_ok=True)

                local_path = os.path.join(tmp_dir, cls.file_name)
                abs_file_path = os.path.abspath(local_path)

                build_response = build_resume(test_resume_data, abs_file_path)
                if build_response.get("success"):
                    generated_resume_cloud_path = f"generated_resumes/{cls.file_name}"
                    with open(local_path, "rb") as f:
                        saved_path = default_storage.save(generated_resume_cloud_path, f)
                        cls.generated_url = default_storage.url(saved_path)
                        yield f"event: fileUrls<|EVENT_BREAK|>data: {json.dumps({'type':'generated', 'url': cls.generated_url})}<|END_OF_EVENT|>"
                else:
                    error_payload = {"error": build_response.get("error", None), "traceback": traceback.format_exc()}
                    yield f"event: error<|EVENT_BREAK|>data: {json.dumps(error_payload)}<|END_OF_EVENT|>"
                    return
                
                delete_time = timezone.now() + timedelta(minutes=5)
                cls.scheduler.add_job(cls.utils.delete_file, 'date', run_date=delete_time, args=[abs_file_path])

            elif "ats" in intent:
                yield f"event: thinkingPhase<|EVENT_BREAK|>data: {json.dumps({"thinking": "true", "thinkingPhase": "ats_optimization"})}<|END_OF_EVENT|>"
                time.sleep(0.25)
                resume_tool_message = next((msg for msg in state['messages'] if isinstance(msg, ToolMessage) and getattr(msg, "tool_call_id", "") == "uploaded_resume"), None)
                if not resume_tool_message:
                    yield f"event: humanError<|EVENT_BREAK|>data: ⚠️ No uploaded resume found. Please upload a resume file to proceed.<|END_OF_EVENT|>"
                    return
                yield f"event: fileUrls<|EVENT_BREAK|>data: {json.dumps({'type':'original', 'url': cls.uploaded_url})}<|END_OF_EVENT|>"
                
                resume_data = json.loads(resume_tool_message.content)
                resume_text = resume_data.get("resume", "")
                resume_links = resume_data.get("links", [])

                messages = [
                    SystemMessage(content=RESUME_EXTRACTOR_PROMPT),
                    HumanMessage(content=f"Hyperlinks:{resume_links}\nResume Text:{resume_text}\nUser request:{user_input_message.content}")
                ]
                # openai_response = cls.resume_service.openai_model.invoke(input=messages)
                # cls.resume_json = parse_json(openai_response.content)
                
                tmp_dir = tempfile.gettempdir()
                os.makedirs(tmp_dir, exist_ok=True)

                local_path = os.path.join(tmp_dir, cls.file_name)
                abs_file_path = os.path.abspath(local_path) 

                build_response = build_resume(test_resume_data, abs_file_path)
                if build_response.get("success"):
                    generated_resume_cloud_path = f"generated_resumes/{cls.file_name}"
                    with open(local_path, "rb") as f:
                        saved_path = default_storage.save(generated_resume_cloud_path, f)
                        cls.generated_url = default_storage.url(saved_path)
                        cls.assistant_msg = "Here’s the enhanced version of your ATS-ready resume."
                        yield f"event: assistantResponse<|EVENT_BREAK|>data: {cls.assistant_msg}<|END_OF_EVENT|>"
                        time.sleep(0.25)
                        yield f"event: fileUrls<|EVENT_BREAK|>data: {json.dumps({'type':'generated', 'url': cls.generated_url})}<|END_OF_EVENT|>"
                else:
                    error_payload = {"error": build_response.get("error", None), "traceback": traceback.format_exc()}
                    yield f"event: error<|EVENT_BREAK|>data: {json.dumps(error_payload)}<|END_OF_EVENT|>"
                    return
                
                delete_time = timezone.now() + timedelta(minutes=5)
                cls.scheduler.add_job(cls.utils.delete_file, 'date', run_date=delete_time, args=[abs_file_path])

            else:
                messages = [
                    SystemMessage(content=GENERAL_SYSTEM_PROMPT.format(today_date=cls.today_date)),
                    HumanMessage(content=user_input_message.content.strip().lower())
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
                
                deduct_tokens_response = cls.user_service.deduct_tokens(deduction_tokens=20, user_id=cls.sender_id)
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
            cls.state: MessagesState = MessagesState(messages=[])
            cls.sender_id: str = getattr(validatedData, "senderId", None)
            cls.user_message: str = getattr(validatedData, "userMessage", None)
            cls.current_thread_id: Optional[str] = getattr(validatedData, "threadId", None)

            if not cls.user_message:
                return Response({"success": False, "error": "Body cannot be empty"}, status=status.HTTP_400_BAD_REQUEST)
            cls.state['messages'].append(HumanMessage(content=cls.user_message))
            
            file: File = request.FILES.get("file")
            if file:
                ext = os.path.splitext(file.name)[1].lower()
                if ext not in cls.ALLOWED_EXTENSIONS:
                    return Response({"success": False, "error": "Invalid file type. Only PDF files are allowed.", "details": traceback.format_exc()}, status=status.HTTP_400_BAD_REQUEST)
                
                if file.size > cls.MAX_FILE_SIZE:
                    return Response({"success": False, "error": "File size exceeds the 2MB limit", "details": traceback.format_exc()}, status=status.HTTP_400_BAD_REQUEST)
                
                if not cls.utils.is_resume(file, cls.RESUME_KEYWORDS):
                    return Response({"success": False, "error": "Uploaded file does not appear to be a valid resume", "details": traceback.format_exc()}, status=status.HTTP_400_BAD_REQUEST)
                
                cls.file_name = file.name
                resume_cloud_path = f"resumes/{cls.file_name}"
                saved_path = default_storage.save(resume_cloud_path, ContentFile(file.read()))
                cls.uploaded_url = default_storage.url(saved_path)                

                file.seek(0)
                resume_content = cls.utils.extract_resume(file)
                cls.state["messages"].append(ToolMessage(tool_call_id="uploaded_resume", content=json.dumps(resume_content)))

                # delete_time = timezone.now() + timedelta(days=2)
                # cls.scheduler.add_job(cls.utils.delete_file, 'date', run_date=delete_time, args=[abs_file_path])

            return StreamingHttpResponse(cls.stream_response(cls.state), content_type="text/plain; charset=utf-8")
        
        except ValidationError as ve:
            return Response({"success": False, "error": f"Invalid request data: {str(ve.errors())}", "traceback": traceback.format_exc()}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            return Response({"success": False, "error": str(e), "details": traceback.format_exc()}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)