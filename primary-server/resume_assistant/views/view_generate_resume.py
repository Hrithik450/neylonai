from apscheduler.schedulers.background import BackgroundScheduler
from django.core.files.storage import default_storage
from django.core.files.base import ContentFile
from rest_framework.response import Response
from rest_framework.views import APIView
from django.utils import timezone
from django.conf import settings
from datetime import timedelta
from rest_framework import status
from django.core.files import File
from PyPDF2 import PdfReader
from typing import List
from io import BytesIO
import traceback
import os

class GenerateResumeUtils:

    @staticmethod
    def is_resume(file: File, resume_words: List[str]):
        pdf_reader = PdfReader(BytesIO(file.read()))
        text = ""
        for page in pdf_reader.pages:
            text += page.extract_text() or ""
        text = text.lower()
        matches = sum(1 for word in resume_words if word in text)
        file.seek(0)
        return matches>=4
    
    @staticmethod
    def delete_file(*file_paths):
        for path in file_paths:
            if os.path.exists(path):
                os.remove(path)
                print(f"🗑 Deleted temporary file: {path}")

class GenerateResumeView(APIView):

    RESUME_KEYWORDS = ["education", "experience", "skills", "projects", "linkedin", "email", "contact", "profile", "certifications", "React.js", "Next.js", "Tailwind CSS", "Langchain", "Langgraph", "Chroma DB", "OpenAI", "Google Gemini", "Django", "FastAPI", "Express.js", "Node.js", "Postman API", "WebSockets", "REST API", "REST APIs", "MongoDB", "PostgreSQL", "Google Cloud Platform", "GCP", "Firebase", "Python", "JavaScript", "C++", "Git", "GitHub", "Vercel", "Render", "VPS", "Figma", "Cloud Run", "Frontend", "Backend", "Fullstack", "Full-stack", "AI", "Machine Learning", "Deep Learning", "NLP"]
    utils = GenerateResumeUtils()
    scheduler = BackgroundScheduler()
    scheduler.start()
    
    def post(self, request):
        try:
            file: File = request.FILES.get("file")
            if not file:
                return Response({"success": False, "error": "No file uploaded", "details": traceback.format_exc()}, status=status.HTTP_400_BAD_REQUEST)
            
            if not self.utils.is_resume(file, self.RESUME_KEYWORDS):
                return Response({"success": False, "error": "Uploaded file does not appear to be a valid resume", "details": traceback.format_exc()}, status=status.HTTP_400_BAD_REQUEST)

            file_name = default_storage.save(f"resumes/{file.name}", ContentFile(file.read()))
            file_path = os.path.join(default_storage.location, file_name)
            abs_file_path = os.path.abspath(file_path)

            delete_time = timezone.now() + timedelta(days=2)
            self.scheduler.add_job(self.utils.delete_file, 'date', run_date=delete_time, args=[abs_file_path])

            download_url = request.build_absolute_uri(f"{settings.MEDIA_URL}{file_name}")
            return Response({"success": True, "message": f"{download_url}"}, status=status.HTTP_200_OK)
        except Exception as e:
            return Response({"success": False, "error": str(e), "details": traceback.format_exc()}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)