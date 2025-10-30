import os
import json
import tiktoken 
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle, HRFlowable

encoding_model = "cl100k_base"
def get_encoding(text: str)->int:
    encoding = tiktoken.get_encoding(encoding_model)
    return len(encoding.encode(text))

GENERAL_SYSTEM_PROMPT="""
You are an intelligent Resume Assistant designed to help users create, improve, or adapt resumes in a professional and effective manner.
Your primary goal is to provide accurate, structured, and actionable resume-related guidance — including writing, formatting, optimizing for ATS, and tailoring for specific job roles — while preserving the factual accuracy and integrity of user-provided information.
If a user asks personal or technical details about the LLM (yourself) or your internal systems (e.g., how you are trained, what tools you use, or how you work internally), politely respond that you cannot provide that information under any circumstances.

Be clear, concise, and context-aware in your responses. 
Focus entirely on helping the user with their resume, career presentation, or job preparation needs.

Today's date is {today_date} IST.
"""

RESUME_SYSTEM_PROMPT="""
You are an expert Resume Role Adaptation Assistant. Your goal is to intelligently tailor an existing resume to match a given job role or job description without losing structure, section order, or factual accuracy.

Rules:
0. Preserve Original Structure:
   - Keep the resume’s sections in the same order as the original, Keep all section titles exactly as they appear.
1. Selective Modification Based on Role:
   - Adjust the section lines to align with the provided job role. Only make modifications necessary to improve relevance.
   - Do not invent or remove any real experience, project, or education unless explicitly instructed by the user.
2. Preserve Authenticity:
   - Do not alter quantitative achievements or company names.
3. If Links are Present:
    - Retain all hyperlinks in their original positions. Replace each clickable text area with the link points to the same URL.
4. Integrate Additional Content if Provided:
   - If the user provides extra material, seamlessly insert it into the most relevant section — without breaking the structure.
5. Tone and Style:
   - Use action verbs and role-aligned keywords relevant to the target job description.
6. Output Format:
   - Return the entire modified resume text.
   - Ensure section headings, bullet and layout are clearly preserved. No explanations, comments, or notes — only the final formatted resume.

Generate a fully rewritten resume optimized for the target job role while preserving all original sections, order, and authenticity.
"""

RESUME_EXTRACTOR_PROMPT = """
You are a highly accurate resume data extraction model.  
Your task is to read a raw resume text and extract all relevant information into a structured JSON object strictly following the schema below.

Rules:
- Always include all keys exactly as shown in the schema.
- If any section is missing or no content, clearly mention it with the string `"null"` (e.g., "<section_name>": {"title": "null","entries": []}).
- If any field is missing or not found, set its value to the string `"null"`.
- Return Only Valid JSON — no explanations, no comments, no extra text.
- Preserve lists, nested structures, and null placeholders properly.
- Extract multiple entries where applicable into lists as per below schema (e.g., multiple experiences, projects, education items).

Output format:
{{
    "name": "<person_name>",
    "contact": {{
        "phone": "<contact_number>",
        "email": "<email_address>",
        "links": {{
            "LinkedIn": "<linkedin_url>",
            "GitHub": "<github_url>",
            # optional: add more if needed
            "<key>": "<value>"
        }}
    }},
    "skills": {{
        "title": "<section_name>",
        # Example: "Skills"
        "entries": {{
            "<skill_category>": "<skills_list_comma_separated>",
            # Example: "Languages": "Python, JavaScript, C++"
        }}
    }},
    "experience": {{
        "title": "<section_name>",
        "entries": [
            {{
                "role": "<job_role>",
                "company": "<job_company>",
                "duration": "<job_duration>",
                # Example: "Aug 2017 – Aug 2020"
                "location": "<job_location>",
                "highlights": [
                    "<job_highlight_point>",
                    "..."
                ]
            }}
        ]
    }},
    "projects": {{
        "title": "<section_name>",
        "entries": [
            {{
                "name": "<project_name>",
                "duration": "<project_duration>",
                # Example: "Python, React.js, VPS"
                "links": {{
                    "Live": "<project_live_url>",
                    # optional
                    "<key>": "<value>"
                }},
                "highlights": [
                    "<project_highlight_point>",
                    "..."
                ]
            }}
        ]
    }},
    "certificates": {{
        "title": "<section_name>",
        "entries": [
            {{
                "name": "<certificate_name>",
                "duration": "<certificate_duration>",
                # Example: "March 2022"
                "links": {{
                    "CertificateLink": "<certificate_link>",
                    # optional
                    "<key>": "<value>"
                }},
                "highlights": [
                    "<certificate_highlight_point>",
                    "..."
                ]
            }}
        ]
    }},
    "education": {{
        "title": "<section_name>",
        "entries": [
            {{
                "institution": "<institution_name>",
                "cgpa": "<cgpa_value>",
                # Example: 8.0, 8.5
                "degree": "<degree_name>",
                # Example: "Bachelor of Technology in Mechanical Engineering"
                "duration": "<education_duration>",
                # Example: "Aug 2017 – Aug 2020"
                "location": "<education_location>"
            }}
        ]
    }}
}}
"""

def build_resume(resume_data: dict, resume_path: str):
    if not os.path.exists(resume_path):
        return {"success": False, "error": "Resume file path not found."}

    doc = SimpleDocTemplate(resume_path, pagesize=A4, rightMargin=10, leftMargin=10, topMargin=2, bottomMargin=2)

    styles = getSampleStyleSheet()
    normal = styles["Normal"]
    story = []

    # Name
    story.append(Paragraph(resume_data["name"], ParagraphStyle(name="Name", fontSize=28, alignment=1, spaceAfter=8, leading=28, fontName="Times-Roman")))

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
    story.append(Paragraph(contact_info, ParagraphStyle(name="Contact", fontSize=12, alignment=1, spaceAfter=12, leading=17, fontName="Times-Roman")))

    # Education Section
    if resume_data.get("education") and resume_data["education"].get("title") != "null" and resume_data["education"].get("entries"):
        story.append(Paragraph(f'<b>{resume_data["education"]["title"]}</b>', ParagraphStyle(name="education", fontSize=13, leading=16, spaceBefore=8, underlineWidth=1, fontName="Times-Roman")))
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
                row1.append(Paragraph(f'<b>{institution}, G.P.A: {cgpa}</b>', ParagraphStyle(name="institution_and_gpa", parent=normal, fontName="Times-Roman", fontSize=12)))
            
            if cgpa == "null" and institution != "null":
                row1.append(Paragraph(f'<b>{institution}</b>', ParagraphStyle(name="institution", parent=normal, fontName="Times-Roman", fontSize=12))) if institution != "null" else row1.append("")

            if duration != "null":
                row1.append(Paragraph(f'<b>{duration}</b>', ParagraphStyle(name="duration", parent=normal, fontName="Times-Roman", fontSize=12, alignment=2)))

            if degree != "null":
                row2.append(Paragraph(f'{degree}', ParagraphStyle(name="degree", parent=normal, fontName="Times-Roman", fontSize=12)))
            
            if location != "null":
                row2.append(Paragraph(f'{location}', ParagraphStyle(name="location", parent=normal, fontName="Times-Roman", fontSize=12, alignment=2)))

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
        story.append(Paragraph(f'<b>{resume_data["skills"]["title"]}</b>', ParagraphStyle(name="section_title", fontSize=13, leading=16, spaceBefore=8, underlineWidth=1, fontName="Times-Roman")))
        story.append(HRFlowable(width="100%", thickness=0.5, lineCap='round', color="#000000", spaceBefore=2, spaceAfter=2))

        for key, value in resume_data["skills"]["entries"].items():
            story.append(Paragraph(f"<b>{key}:</b> {value}", ParagraphStyle(name="skill_points", fontSize=12, spaceBefore=2, spaceAfter=2, bulletIndent=10, leading=15, fontName="Times-Roman")))

    # Experience Section
    if resume_data.get("experience") and resume_data["experience"].get("title") != "null" and resume_data["experience"].get("entries"):
        story.append(Paragraph(f'<b>{resume_data["experience"]["title"]}</b>', ParagraphStyle(name="section_title", fontSize=13, leading=16, spaceBefore=8, underlineWidth=1, fontName="Times-Roman")))
        story.append(HRFlowable(width="100%", thickness=0.5, lineCap='round', color="#000000", spaceBefore=2, spaceAfter=2))

        for entry in resume_data.get("experience", {}).get("entries", []):
            role = entry.get("role", "null")
            company = entry.get("company", "null")
            duration = entry.get("duration", "null")
            location = entry.get("location", "null")
            highlights = entry.get("highlights", [])

            if role != "null":
                job_role = Paragraph(f'<b>{role}</b>', ParagraphStyle(name="job_role", parent=normal, fontName="Times-Roman", fontSize=12))

            if company != "null":
                job_company = Paragraph(company, ParagraphStyle(name="job_company", parent=normal, fontName="Times-Roman", fontSize=12))

            if duration != "null":
                job_duration = Paragraph(f'<b>{duration}</b>', ParagraphStyle(name="job_duration", parent=normal, fontName="Times-Roman", fontSize=12, alignment=2))

            if location != "null":
                job_location = Paragraph(location, ParagraphStyle(name="job_location", parent=normal, fontName="Times-Roman", fontSize=12, alignment=2))

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
                    story.append(Paragraph(f"<bullet>&bull;</bullet> {point}", ParagraphStyle(name="bullet_points", fontSize=12, leftIndent=20, spaceBefore=2, spaceAfter=2, bulletIndent=10, leading=15, fontName="Times-Roman")))
            story.append(Spacer(1, 4))

    # Projects Section
    if resume_data.get("projects") and resume_data["projects"].get("title") != "null" and resume_data["projects"].get("entries"):
        story.append(Paragraph(f'<b>{resume_data["projects"]["title"]}</b>', ParagraphStyle(name="section_title", fontSize=13, leading=16, spaceBefore=8, underlineWidth=1, fontName="Times-Roman")))
        story.append(HRFlowable(width="100%", thickness=0.5, lineCap='round', color="#000000", spaceBefore=2, spaceAfter=2))

        for entry in resume_data["projects"]["entries"]:
            name = entry["name"]
            duration = entry.get("duration", "null")
            live_link = entry.get("links", {}).get("Live")

            if live_link:
                project_name = Paragraph(f"<b>{name}</b> | <link href='{live_link}' color='#085A8C' underline='true'>View Live</link>", ParagraphStyle(name="ProjectName", parent=normal, fontName="Times-Roman", fontSize=12))
            else:
                project_name = Paragraph(f"<b>{name}</b>", ParagraphStyle(name="ProjectName", parent=normal, fontName="Times-Roman", fontSize=12))

            if duration != "null":
                duration_para = Paragraph(duration, ParagraphStyle(name="Duration", parent=normal, fontName="Times-Roman", fontSize=12, alignment=2))
            
            if duration != "null":
                data = [[project_name, duration_para]]
            else:
                data = [[project_name, ""]]
        
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

            for point in entry["highlights"]:
                story.append(Paragraph(f"<bullet>&bull;</bullet> {point}", ParagraphStyle(name="BulletPoints", fontSize=12, leftIndent=20, spaceBefore=2, spaceAfter=2, bulletIndent=10, leading=15, fontName="Times-Roman")))
            story.append(Spacer(1, 4))

    # Certificates Section
    if resume_data.get("certificates") and resume_data["certificates"].get("title") != "null" and resume_data["certificates"].get("entries"):
        story.append(Paragraph(f'<b>{resume_data["certificates"]["title"]}</b>', ParagraphStyle(name="SectionTitle", fontSize=13, leading=16, spaceBefore=8, underlineWidth=1, fontName="Times-Roman")))
        story.append(HRFlowable(width="100%", thickness=0.5, lineCap='round', color="#000000", spaceBefore=2, spaceAfter=2))

        for entry in resume_data["certificates"]["entries"]:
            name = entry["name"]
            duration = entry.get("duration", "")
            highlights = entry.get("highlights", [])
            certificate_link = entry.get("links", {}).get("CertificateLink")

            if certificate_link:
                certificate_name = Paragraph(f"<b>{name}</b> | <link href='{certificate_link}' color='#085A8C' underline='true'>Certificate</link>", ParagraphStyle(name="CertificateName", parent=normal, fontName="Times-Roman", fontSize=12))
            else:
                certificate_name = Paragraph(f"<b>{name}</b>", ParagraphStyle(name="CertificateName", parent=normal, fontName="Times-Roman", fontSize=12))

            if duration != "null":
                duration_para = Paragraph(duration, ParagraphStyle(name="Duration", parent=normal, fontName="Times-Roman", fontSize=12, alignment=2))
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
                    story.append(Paragraph(f"<bullet>&bull;</bullet> {point}", ParagraphStyle(name="BulletPoints", fontSize=12, leftIndent=20, spaceBefore=2, spaceAfter=2, bulletIndent=10, leading=15, fontName="Times-Roman")))

    doc.build(story)
    print(f"✅ Resume saved as {resume_path}")