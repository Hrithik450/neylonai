import os
import re
import json
import uuid
import tiktoken
import traceback
from io import BytesIO
from PyPDF2 import PdfReader
from pathlib import Path
from django.core.files import File
from pydantic import BaseModel
from typing import List, Set, Any, Optional
from django.core.files.base import ContentFile
from django.core.files.storage import default_storage
from core_manager.services.model_message_service import ChatMessagesResponse, ChatMessageService
from reportlab.lib.pagesizes import A4
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle, HRFlowable

class ResumeUtilsResponse(BaseModel):
    success: bool
    data: Optional[Any] = None
    error: Optional[str] = None

class ResumeUtils:
    encoding_model = "cl100k_base"
    BASE_DIR = Path(os.path.dirname(__file__)).parent

    @staticmethod
    def parse_json(raw_response):
        if not raw_response:
            return None
        match = re.search(r'\{.*\}', raw_response, re.S)
        if match:
            return json.loads(match.group(0))
        return None

    @staticmethod
    def get_encoding(text: str)->int:
        encoding = tiktoken.get_encoding(ResumeUtils.encoding_model)
        return len(encoding.encode(text))

    @staticmethod
    def delete_file(*paths):
        for path in paths:
            if os.path.exists(path):
                os.remove(path)

    @staticmethod
    def extract_resume(file: File) -> ResumeUtilsResponse:
        try:
            reader = PdfReader(BytesIO(file.read()))
            links: Set[str] = set()
            text = ""

            for page in reader.pages:
                text += page.extract_text() or ""
                annots = page.get("/Annots")
                if annots:
                    for annot_ref in annots:
                        annot = annot_ref.get_object()
                        if annot.get("/A") and annot["/A"].get("/URI"):
                            links.add(annot["/A"]["/URI"])
            file.seek(0)
            return ResumeUtilsResponse(success=True, data={"resume": text.strip(), "links": list(links)})
        except Exception as e:
            return ResumeUtilsResponse(success=False, error=f"{str(e), {traceback.format_exc()}}")
    
    @staticmethod
    def is_resume(file: File, resume_words: List[str]) -> ResumeUtilsResponse:
        try:
            reader = PdfReader(BytesIO(file.read()))
            text = " ".join(page.extract_text() or "" for page in reader.pages).lower()
            file.seek(0)
            matches = sum(1 for word in resume_words if word in text)
            return ResumeUtilsResponse(success=True, data=matches >= 4)
        except Exception as e:
            return ResumeUtilsResponse(success=False, error=f"{str(e), {traceback.format_exc()}}")
    
    @staticmethod
    def save_uploaded_resume(file: File, sender_id: str) -> ResumeUtilsResponse:
        try:
            random_str = uuid.uuid4().hex[:8]
            cloud_path = f"resumes/{sender_id}_{random_str}.pdf"
            saved_path = default_storage.save(cloud_path, ContentFile(file.read()))

            file.seek(0)
            return ResumeUtilsResponse(success=True, data=default_storage.url(saved_path))
        except Exception as e:
            return ResumeUtilsResponse(success=False, error=f"{str(e), {traceback.format_exc()}}")

    @staticmethod
    def save_generated_resume(sender_id: str, abs_file_path: str) -> ResumeUtilsResponse:
        try:
            random_str = uuid.uuid4().hex[:8]
            cloud_path = f"generated_resumes/{sender_id}_{random_str}.pdf"
            with open(abs_file_path, "rb") as f:
                saved_path = default_storage.save(cloud_path, ContentFile(f.read()))
            return ResumeUtilsResponse(success=True, data=default_storage.url(saved_path))
        except Exception as e:
            return ResumeUtilsResponse(success=False, error=f"{str(e), {traceback.format_exc()}}")
    
    @staticmethod
    def get_conversation_history(thread_id: str) -> ResumeUtilsResponse:
        try:
            thread_messages_response:ChatMessagesResponse = ChatMessageService.list_recent_thread_messages(thread_id=str(thread_id))
            if not thread_messages_response.success:
                return ResumeUtilsResponse(success=False, error=f"Error occured while retreieving the recent messages {thread_messages_response.error}")
            conversation_history = [msg.model_dump() for msg in thread_messages_response.data]
            return ResumeUtilsResponse(success=True, data=conversation_history)
        except Exception as e:
            return ResumeUtilsResponse(success=False, error=f"{str(e), {traceback.format_exc()}}")
        
    @staticmethod
    def build_resume(resume_data: dict, resume_path: str) -> ResumeUtilsResponse:
        try:
            pdfmetrics.registerFont(TTFont('Guminert-Regular', os.path.join(ResumeUtils.BASE_DIR, "assets/fonts/Guminert-Regular.ttf")))
            pdfmetrics.registerFont(TTFont('Guminert-Medium', os.path.join(ResumeUtils.BASE_DIR, "assets/fonts/Guminert-Medium.ttf")))

            doc = SimpleDocTemplate(resume_path, pagesize=A4, rightMargin=10, leftMargin=10, topMargin=2, bottomMargin=2)

            styles = getSampleStyleSheet()
            normal = styles['Normal']
            story = []

            # Name
            story.append(Paragraph(resume_data["name"], ParagraphStyle(name="Name", fontSize=28, alignment=1, spaceAfter=8, leading=28, fontName="Guminert-Medium")))

            # Contact
            contact = resume_data.get("contact", {})
            links = contact.get("links", {})

            # Extract safely with fallbacks
            phone = contact.get("phone", "null")
            email = contact.get("email", "null")
            linkedin = links.get("LinkedIn", "null")
            github = links.get("GitHub", "null")

            contact_parts = []
            if phone != "null":
                contact_parts.append(f"{phone}")
            if email != "null":
                contact_parts.append(f"<link href='mailto:{email}' color='#085A8C' underline='true'>{email}</link>")
            if linkedin != "null":
                contact_parts.append(f"<link href='{linkedin}' color='#085A8C' underline='true'>{linkedin}</link>")
            if github != "null":
                contact_parts.append(f"<link href='{github}' color='#085A8C' underline='true'>{github}</link>")

            if len(contact_parts) > 3:
                contact_info = ("&nbsp;&nbsp;".join(contact_parts[:3]) + "<br/>" + "&nbsp;&nbsp;".join(contact_parts[3:]))
            else:
                contact_info = "&nbsp;&nbsp;".join(contact_parts)
            story.append(Paragraph(contact_info, ParagraphStyle(name="Contact", fontSize=12, alignment=1, spaceAfter=12, leading=17, fontName="Guminert-Regular")))

            # Education Section
            if resume_data.get("education") and resume_data["education"].get("title") != "null" and resume_data["education"].get("entries"):
                story.append(Paragraph(f'<b>{resume_data["education"]["title"]}</b>', ParagraphStyle(name="education", fontSize=13, leading=16, spaceBefore=8, underlineWidth=1, fontName="Guminert-Medium")))
                story.append(HRFlowable(width="100%", thickness=0.5, lineCap='round', color="#000000", spaceBefore=2, spaceAfter=2))

                for entry in resume_data["education"]["entries"]:
                    institution = entry.get("institution", "null")
                    duration = entry.get("duration", "null")
                    degree = entry.get("degree", "null")
                    location = entry.get("location", "null")
                    cgpa = entry.get("cgpa", "null")

                    row1 = []
                    row2 = []

                    if cgpa != "null" and institution != "null":
                        row1.append(Paragraph(f'<b>{institution}, G.P.A: {cgpa}</b>', ParagraphStyle(name="institution_and_gpa", parent=normal, fontName="Guminert-Regular", fontSize=11)))
                    
                    if cgpa == "null" and institution != "null":
                        row1.append(Paragraph(f'<b>{institution}</b>', ParagraphStyle(name="institution", parent=normal, fontName="Guminert-Regular", fontSize=12))) if institution != "null" else row1.append("")

                    if duration != "null":
                        row1.append(Paragraph(f'<b>{duration}</b>', ParagraphStyle(name="duration", parent=normal, fontName="Guminert-Medium", fontSize=12, alignment=2)))

                    if degree != "null":
                        row2.append(Paragraph(f'{degree}', ParagraphStyle(name="degree", parent=normal, fontName="Guminert-Regular", fontSize=12)))
                    
                    if location != "null":
                        row2.append(Paragraph(f'{location}', ParagraphStyle(name="location", parent=normal, fontName="Guminert-Regular", fontSize=12, alignment=2)))

                    data = [row1, row2]
                    table = Table(data, colWidths=["75%", "25%"])
                    table.setStyle(TableStyle([
                        ("VALIGN", (0, 0), (-1, -1), "TOP"),
                        ("ALIGN", (1, 0), (1, 0), "RIGHT"),
                        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
                        ("TOPPADDING", (0, 0), (-1, -1), 0),
                        ("LEFTPADDING", (0, 0), (-1, -1), 0),
                        ("RIGHTPADDING", (0, 0), (-1, -1), 0)
                    ]))
                    story.append(table)

            # Skills Section
            if resume_data.get("skills") and resume_data["skills"].get("title") != "null" and resume_data["skills"].get("entries"):
                story.append(Paragraph(f'<b>{resume_data["skills"]["title"]}</b>', ParagraphStyle(name="section_title", fontSize=13, leading=16, spaceBefore=8, underlineWidth=1, fontName="Guminert-Medium")))
                story.append(HRFlowable(width="100%", thickness=0.5, lineCap='round', color="#000000", spaceBefore=2, spaceAfter=2))

                for key, value in resume_data["skills"]["entries"].items():
                    story.append(Paragraph(f"<b>{key}:</b> {value}", ParagraphStyle(name="skill_points", fontSize=12, spaceBefore=2, spaceAfter=2, bulletIndent=10, leading=15, fontName="Guminert-Regular")))

            # Experience Section
            if resume_data.get("experience") and resume_data["experience"].get("title") != "null" and resume_data["experience"].get("entries"):
                story.append(Paragraph(f'<b>{resume_data["experience"]["title"]}</b>', ParagraphStyle(name="section_title", fontSize=13, leading=16, spaceBefore=8, underlineWidth=1, fontName="Guminert-Medium")))
                story.append(HRFlowable(width="100%", thickness=0.5, lineCap='round', color="#000000", spaceBefore=2, spaceAfter=2))

                for entry in resume_data.get("experience", {}).get("entries", []):
                    role = entry.get("role", "null")
                    company = entry.get("company", "null")
                    duration = entry.get("duration", "null")
                    location = entry.get("location", "null")
                    highlights = entry.get("highlights", [])

                    if role != "null":
                        job_role = Paragraph(f'<b>{role}</b>', ParagraphStyle(name="job_role", parent=normal, fontName="Guminert-Medium", fontSize=12))

                    if company != "null":
                        job_company = Paragraph(company, ParagraphStyle(name="job_company", parent=normal, fontName="Guminert-Regular", fontSize=12))

                    if duration != "null":
                        job_duration = Paragraph(f'<b>{duration}</b>', ParagraphStyle(name="job_duration", parent=normal, fontName="Guminert-Medium", fontSize=12, alignment=2))

                    if location != "null":
                        job_location = Paragraph(location, ParagraphStyle(name="job_location", parent=normal, fontName="Guminert-Regular", fontSize=12, alignment=2))

                    if location != "null" and duration != "null" and company != "null" and role != "null":
                        data = [[job_role, job_duration], [job_company, job_location]]
                    elif duration != "null" and company != "null" and role != "null":
                        data = [[job_role, job_duration], [job_company, ""]]
                    elif location != "null" and company != "null" and role != "null":
                        data = [[job_role, ""], [job_company, job_location]]
                    elif location != "null" and duration != "null" and role != "null":
                        data = [[job_role, job_duration], ["", job_location]]
                    elif company != "null" and role != "null":
                        data = [[job_role, ""], [job_company, ""]]
                    elif location != "null" and role != "null":
                        data = [[job_role, ""], ["", job_location]]
                    elif duration != "null" and role != "null":
                        data = [[job_role, job_duration], ["", ""]]
                    else:
                        data = [[job_role, ""], ["", ""]]

                    table = Table(data, colWidths=["70%", "30%"])
                    table.setStyle(TableStyle([
                        ("VALIGN", (0, 0), (-1, -1), "TOP"),
                        ("ALIGN", (1, 0), (1, 0), "RIGHT"),
                        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
                        ("TOPPADDING", (0, 0), (-1, -1), 0),
                        ("LEFTPADDING", (0, 0), (-1, -1), 0),
                        ("RIGHTPADDING", (0, 0), (-1, -1), 0)
                    ]))
                    story.append(table)

                    if highlights:
                        for point in highlights:
                            story.append(Paragraph(f"<bullet>&bull;</bullet> {point}", ParagraphStyle(name="bullet_points", fontSize=12, leftIndent=20, spaceBefore=2, spaceAfter=2, bulletIndent=10, leading=16, fontName="Guminert-Regular")))
                    story.append(Spacer(1, 4))

            # Projects Section
            if resume_data.get("projects") and resume_data["projects"].get("title") != "null" and resume_data["projects"].get("entries"):
                story.append(Paragraph(f'<b>{resume_data["projects"]["title"]}</b>', ParagraphStyle(name="section_title", fontSize=13, leading=16, spaceBefore=8, underlineWidth=1, fontName="Guminert-Medium")))
                story.append(HRFlowable(width="100%", thickness=0.5, lineCap='round', color="#000000", spaceBefore=2, spaceAfter=2))

                for entry in resume_data["projects"]["entries"]:
                    name = entry["name"]
                    duration = entry.get("duration", "null")
                    live_link = entry.get("links", {}).get("Live", "null")

                    if live_link != "null":
                        project_name = Paragraph(f"<b>{name}</b> | <link href='{live_link}' color='#085A8C' underline='true'>View Live</link>", ParagraphStyle(name="ProjectName", parent=normal, fontName="Guminert-Medium", fontSize=12))
                    else:
                        project_name = Paragraph(f"<b>{name}</b>", ParagraphStyle(name="ProjectName", parent=normal, fontName="Guminert-Medium", fontSize=12))

                    if duration != "null":
                        duration_para = Paragraph(duration, ParagraphStyle(name="Duration", parent=normal, fontName="Guminert-Medium", fontSize=12, alignment=2))
                    
                    if duration != "null":
                        data = [[project_name, duration_para]]
                    else:
                        data = [[project_name, ""]]
                
                    table = Table(data, colWidths=["70%", "30%"])
                    table.setStyle(TableStyle([
                        ("VALIGN", (0, 0), (-1, -1), "TOP"),
                        ("ALIGN", (1, 0), (1, 0), "RIGHT"),
                        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
                        ("TOPPADDING", (0, 0), (-1, -1), 0),
                        ("LEFTPADDING", (0, 0), (-1, -1), 0),
                        ("RIGHTPADDING", (0, 0), (-1, -1), 0)
                    ]))
                    story.append(table)

                    for point in entry["highlights"]:
                        story.append(Paragraph(f"<bullet>&bull;</bullet> {point}", ParagraphStyle(name="BulletPoints", fontSize=12, leftIndent=20, spaceBefore=2, spaceAfter=2, bulletIndent=10, leading=16, fontName="Guminert-Regular")))
                    story.append(Spacer(1, 4))

            # Certificates Section
            if resume_data.get("certificates") and resume_data["certificates"].get("title") != "null" and resume_data["certificates"].get("entries"):
                story.append(Paragraph(f'<b>{resume_data["certificates"]["title"]}</b>', ParagraphStyle(name="SectionTitle", fontSize=13, leading=16, spaceBefore=8, underlineWidth=1, fontName="Guminert-Medium")))
                story.append(HRFlowable(width="100%", thickness=0.5, lineCap='round', color="#000000", spaceBefore=2, spaceAfter=2))

                for entry in resume_data["certificates"]["entries"]:
                    name = entry["name"]
                    duration = entry.get("duration", "")
                    highlights = entry.get("highlights", [])
                    certificate_link = entry.get("links", {}).get("CertificateLink", "null")

                    if certificate_link != "null":
                        certificate_name = Paragraph(f"<b>{name}</b> | <link href='{certificate_link}' color='#085A8C' underline='true'>Certificate</link>", ParagraphStyle(name="CertificateName", parent=normal, fontName="Guminert-Regular", fontSize=12))
                    else:
                        certificate_name = Paragraph(f"<b>{name}</b>", ParagraphStyle(name="CertificateName", parent=normal, fontName="Guminert-Regular", fontSize=12))

                    if duration != "null":
                        duration_para = Paragraph(duration, ParagraphStyle(name="Duration", parent=normal, fontName="Guminert-Regular", fontSize=12, alignment=2))
                        data = [[certificate_name, duration_para]]
                    else:
                        data = [[certificate_name, ""]]

                    table = Table(data, colWidths=["75%", "25%"])
                    table.setStyle(TableStyle([
                        ("VALIGN", (0, 0), (-1, -1), "TOP"),
                        ("ALIGN", (1, 0), (1, 0), "RIGHT"),
                        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
                        ("TOPPADDING", (0, 0), (-1, -1), 0),
                        ("LEFTPADDING", (0, 0), (-1, -1), 0),
                        ("RIGHTPADDING", (0, 0), (-1, -1), 0)
                    ]))
                    story.append(table)

                    if highlights:
                        for point in highlights:
                            story.append(Paragraph(f"<bullet>&bull;</bullet> {point}", ParagraphStyle(name="BulletPoints", fontSize=12, leftIndent=20, spaceBefore=2, spaceAfter=2, bulletIndent=10, leading=16, fontName="Guminert-Regular")))

            doc.build(story)
            return ResumeUtilsResponse(success=True, data=f"Resume saved as {resume_path}.")
        except Exception as e:
            return ResumeUtilsResponse(success=False, error=f"{str(e)}, {traceback.format_exc()}")