from ..lib.utils import RESUME_EXTRACTOR_PROMPT, RESUME_SYSTEM_PROMPT, GENERAL_SYSTEM_PROMPT
from langchain_core.messages import ToolMessage, HumanMessage, SystemMessage, AIMessage
from apscheduler.schedulers.background import BackgroundScheduler
from langchain_google_genai import ChatGoogleGenerativeAI
from django.core.files.storage import default_storage
from django.http import StreamingHttpResponse
from django.core.files.base import ContentFile
from rest_framework.response import Response
from langgraph.graph import MessagesState
from rest_framework.views import APIView
from langchain_openai import ChatOpenAI
from django.core.files import File
from rest_framework import status
from django.utils import timezone
from django.conf import settings
from datetime import datetime
from datetime import timedelta
from dotenv import load_dotenv
from typing import List, Dict
from PyPDF2 import PdfReader
from io import BytesIO
import traceback
import pytz
import json
import os

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
    MAX_FILE_SIZE = 2 * 1024 * 1024
    ALLOWED_EXTENSIONS = [".pdf"]

    utils = GenerateResumeUtils()
    scheduler = BackgroundScheduler()
    scheduler.start()

    resume_service = GenerateResumeService()
    today_date = datetime.now(pytz.timezone("Asia/Kolkata")).strftime("%B %d, %Y")
        
    @classmethod
    def stream_response(cls, state: MessagesState):
        try:
            classified_state = cls.resume_service.classification_node(state)
            user_input_message = next((msg for msg in reversed(state['messages']) if isinstance(msg, HumanMessage)), None)
            intent = classified_state['messages'][-1].content.strip().lower()
            print(classified_state)
            
            if "adapt" in intent:
                yield f"event: thinkingPhase<|EVENT_BREAK|>data: {json.dumps({"thinking": "true", "thinkingPhase": "resume_build"})}<|END_OF_EVENT|>"
                resume_tool_message = next((msg for msg in state['messages'] if isinstance(msg, ToolMessage) and getattr(msg, "tool_call_id", "") == "uploaded_resume"), None)
                if not resume_tool_message:
                    yield f"event: error\ndata: ⚠️ No uploaded resume found. Please upload a resume file to proceed."
                
                resume_data = json.loads(resume_tool_message.content)
                resume_text = resume_data.get("resume", "")
                resume_links = resume_data.get("links", [])
                
                messages = [
                    SystemMessage(content=RESUME_SYSTEM_PROMPT),
                    HumanMessage(content=f"Hyperlinks:{resume_links}\nResume Text:{resume_text}\nUser request:{user_input_message.content}")
                ]
                for chunk in cls.resume_service.gemini_model.stream(input=messages):
                    if hasattr(chunk, "content") and chunk.content:
                        yield f"event: assistantResponse<|EVENT_BREAK|>data: {chunk.content}<|END_OF_EVENT|>"
                yield f"event: done<|EVENT_BREAK|>data: done<|END_OF_EVENT|>"

            elif "ats" in intent:
                yield f"event: thinkingPhase<|EVENT_BREAK|>data: {json.dumps({"thinking": "true", "thinkingPhase": "ats_optimization"})}<|END_OF_EVENT|>"
                yield f"event: done<|EVENT_BREAK|>data: done<|END_OF_EVENT|>"

            else:
                messages = [
                    SystemMessage(content=GENERAL_SYSTEM_PROMPT.format(today_date=cls.today_date)),
                    HumanMessage(content=user_input_message.content.strip().lower())
                ]
                for chunk in cls.resume_service.gemini_model.stream(input=messages):
                    if hasattr(chunk, "content") and chunk.content:
                        yield f"event: assistantResponse<|EVENT_BREAK|>data: {chunk.content}<|END_OF_EVENT|>"
                yield f"event: done<|EVENT_BREAK|>data: end<|END_OF_EVENT|>"

        except Exception as e:
            error_payload = {"error": str(e), "traceback": traceback.format_exc()}
            yield f"event: error<|EVENT_BREAK|>data: {json.dumps(error_payload)}"
            return
    
    def post(self, request):
        try:
            self.state: MessagesState = MessagesState(messages=[])
            user_prompt = request.data.get("userMessage")

            if not user_prompt:
                return Response({"success": False, "error": "Body cannot be empty"}, status=status.HTTP_400_BAD_REQUEST)
            self.state['messages'].append(HumanMessage(content=user_prompt))
            
            file: File = request.FILES.get("file")
            if file:
                ext = os.path.splitext(file.name)[1].lower()
                if ext not in self.ALLOWED_EXTENSIONS:
                    return Response({"success": False, "error": "Invalid file type. Only PDF files are allowed.", "details": traceback.format_exc()}, status=status.HTTP_400_BAD_REQUEST)
                
                if file.size > self.MAX_FILE_SIZE:
                    return Response({"success": False, "error": "File size exceeds the 2MB limit", "details": traceback.format_exc()}, status=status.HTTP_400_BAD_REQUEST)
                
                if not self.utils.is_resume(file, self.RESUME_KEYWORDS):
                    return Response({"success": False, "error": "Uploaded file does not appear to be a valid resume", "details": traceback.format_exc()}, status=status.HTTP_400_BAD_REQUEST)
                
                file_name = default_storage.save(f"resumes/{file.name}", ContentFile(file.read()))
                file_path = os.path.join(default_storage.location, file_name)
                abs_file_path = os.path.abspath(file_path)
                file.seek(0)

                resume_content = self.utils.extract_resume(file)
                self.state["messages"].append(ToolMessage(tool_call_id="uploaded_resume", content=json.dumps(resume_content)))
                print(self.state)

                delete_time = timezone.now() + timedelta(days=2)
                self.scheduler.add_job(self.utils.delete_file, 'date', run_date=delete_time, args=[abs_file_path])

                self.download_url = request.build_absolute_uri(f"{settings.MEDIA_URL}{file_name}")

            return StreamingHttpResponse(self.stream_response(self.state), content_type="text/plain; charset=utf-8")
        
        except Exception as e:
            return Response({"success": False, "error": str(e), "details": traceback.format_exc()}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)