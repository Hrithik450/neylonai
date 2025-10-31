import os
import re
import json
import tiktoken 
import traceback
from pathlib import Path
from reportlab.lib.pagesizes import A4
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle, HRFlowable

BASE_DIR = Path(os.path.dirname(__file__)).parent

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
                # Example: "Aug 2017 – Aug 2020" Use short month names
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
                # Example: "Mar 2020 – Feb 2024" Use short month names
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
                # Example: "Aug 2017 – Aug 2020" Use short month names
                "location": "<education_location>"
            }}
        ]
    }}
}}
"""

def build_resume(resume_data: dict, resume_path: str):
    try:
        pdfmetrics.registerFont(TTFont('Guminert-Regular', os.path.join(BASE_DIR, "assets/fonts/Guminert-Regular.ttf")))
        pdfmetrics.registerFont(TTFont('Guminert-Medium', os.path.join(BASE_DIR, "assets/fonts/Guminert-Medium.ttf")))

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
        return {"success": True, "data": f"Resume saved as {resume_path}."}
    except Exception as e:
        return {"success": False, "error": str(e), "details": traceback.format_exc()}

def parse_json(raw_response):
    if not raw_response:
        return None
    match = re.search(r'\{.*\}', raw_response, re.S)
    if match:
        return json.loads(match.group(0))
    return None

test_resume_data = {
    "name": "Hruthik M",
    "contact": {
        "phone": "+91 7483229386",
        "email": "mhrithik450@gmail.com",
        "links": {
            "LinkedIn": "https://www.linkedin.com/in/hruthik-m-3595a0329?utm_source=share&utm_campaign=share_via&utm_content=profile&utm_medium=android_app",
            "GitHub": "https://github.com/Hrithik450"
        }
    },
    "skills": {
        "title": "Technical Skills",
        "entries": {
            "Frontend": "React.js, Next.js, Tailwind CSS",
            "AI Frameworks": "Langchain, Langgraph, Chroma DB, Open AI, Google Gemini",
            "Backend": "Django, FastAPI, Express.js, Node.js, Postman API, Websockets, REST API’s",
            "Databases": "MongoDB, PostgreSQL",
            "Cloud": "Google Cloud Platform, Firebase, AWS",
            "Languages": "Python, JavaScript, C++",
            "Tools": "Git, GitHub, Vercel, Render, VPS, Figma, Cloud Run, Docker"
        }
    },
    "experience": {
        "title": "Experience",
        "entries": [
            {
                "role": "Software Development Engineer",
                "company": "Codedale",
                "duration": "April 2025 - Present",
                "location": "India",
                "highlights": [
                    "Built and maintained 100+ robust backend endpoints using TypeScript and Next.js, reducing API response time by 90% and improving system reliability for 100k users.",
                    "Designed and implemented PostgreSQL schemas and Drizzle ORM models handling 20K+ records, optimizing queries and reducing average database load by 60%.",
                    "Contributed to 50+ production features end-to-end, including API design, secure authentication, and data validation, supporting 10k+ active users."
                ]
            },
            {
                "role": "Founder & Lead Engineer",
                "company": "Neylon AI",
                "duration": "Aug 2025 - Present",
                "location": "India",
                "highlights": [
                    "Founded Neylon AI, an AI agency delivering scalable AI assistants and agent-based solutions, serving diverse clients with intelligent automation.",
                    "Developed AI agents using LangGraph, LangChain, and vector databases, implementing a RAG pipeline capable of handling 20K+ data records efficiently.",
                    "Engineered the platform to process and query 10GB+ datasets seamlessly using Django backend and Next.js frontend, ensuring high-performance AI workflows."
                ]
            },
            {
                "role": "React.js And Node.js Developer",
                "company": "UVCE College",
                "duration": "Sep 2024 - Aug 2024",
                "location": "Bengaluru, India",
                "highlights": [
                    "Developed a college website by merging two existing websites into a unified platform, improving accessibility and user navigation.",
                    "Utilized React.js and Styled Components for a modern and dynamic frontend experience, enhancing interactive UIs."
                ]
            }
        ]
    },
    "projects": {
        "title": "Projects",
        "entries": [
            {
                "name": "AI-Powered Market Sentiment Analyzer",
                "duration": "March 2020 - April 2024",
                "links": {
                    "Live": "https://analyzer.anox.store/",
                    "GitHub": "https://github.com/Hrithik450/SentimentAnalyzer"
                },
                "highlights": [
                    "Developed an AI-driven sentiment analysis tool that gathers 100,000+ data points daily from crypto news, social media posts, and market trends.",
                    "Integrated Natural Language Processing (NLP) using VADER, achieving 85%+ accuracy in sentiment classification (bullish / bearish).",
                    "Built a scalable backend with Flask, handling 500+ API requests per second while fetching data from RSS feeds, Twitter API’s and crypto forums.",
                    "Potential Impact: Help traders reduce decision-making time by 30%, improving trade success rates based on sentiment analysis."
                ]
            },
            {
                "name": "MERN Launcher - Automation for MERN Stack Setup",
                "duration": "April 2024 - March 2024",
                "links": {
                    "Live": "https://www.npmjs.com/package/mern-launcher",
                    "GitHub": "https://github.com/Hrithik450/mern-launcher"
                },
                "highlights": [
                    "Developed an automation tool that streamlines the setup of a fully functional MERN (MongoDB, Express.js, React.js, Node.js) stack with a single command.",
                    "Automated the installation of frontend and backend dependencies, including React Router, Redux, Express, Mongoose, and authentication modules.",
                    "Potential impact: Reduces setup time from hours to minutes, enabling developers to kickstart MERN projects with minimal effort."
                ]
            },
            {
                "name": "Feature-Rich eCommerce Platform",
                "duration": "May 2025 - August 2025",
                "links": {
                    "Live": "https://anox.store/",
                    "GitHub": "https://github.com/Hrithik450/Ecommerce"
                },
                "highlights": [
                    "Engineered a full-stack eCommerce website with modern UI/UX using React and Styled Components.",
                    "Implemented OAuth authentication (Google, Facebook) for seamless user access and secure login.",
                    "Integrated Razorpay for secure payment processing and Firebase for dynamic product management."
                ]
            },
            {
                "name": "CloudMetrics Dashboard",
                "duration": "August 2025 - September 2026",
                "links": {
                    "Live": "null",
                    "GitHub": "null"
                },
                "highlights": [
                    "Designed and developed a cloud monitoring dashboard using Next.js and Express.",
                    "Integrated AWS CloudWatch APIs for real-time data visualization.",
                    "Deployed application using Docker on AWS EC2."
                ]
            }
        ]
    },
    "certificates": {
        "title": "null",
        "entries": []
    },
    "education": {
        "title": "Education",
        "entries": [
            {
                "institution": "University of Vishveshwaraya College of Engineering.",
                "cgpa": "null",
                "degree": "B.Tech in Computer Science.",
                "duration": "2028",
                "location": "Bengaluru, India"
            }
        ]
    }
}
