CLASSIFY_PROMPT = f"""
You are a classification assistant. You will be given a list of messages representing a conversation between a user and an assistant.
- All previous messages represent the past conversation history.
- The last user message represents the current user request that must be classified.

Classify the user request into one of these intents:
- "general" → general question or chat unrelated to resumes.
- "general_followup" → follow-up about a previous non-resume topic.
- "ats" → user asks to create or improve an ATS-style resume.
- "adapt" → user starts a new request to tailor/rewrite a resume for a specific role or company.
- "resume_followup" → user refers to, modifies, or continues a past resume discussion (e.g., “update it”, “add this skill”).
Return only one word: general / general_followup / ats / adapt / resume_followup
"""

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
