### **Overview**

| Detail           | Value                                                                                                                           |
| :--------------- | :------------------------------------------------------------------------------------------------------------------------------ |
| **Project Name** | **AI-Solutionz**                                                                                                                |
| **Description**  | A full-stack AI agency platform designed to deliver scalable, accurate, and customizable AI solutions and intelligent agents.   |
| **Core Stack**   | Built with **Next.js** for a high-performance frontend and **Django** as the backend API and orchestration layer.               |
| **Purpose**      | To streamline the creation, management, and deployment of intelligent AI agents and automation tools across various industries. |

---

## **Tech Stack**

| Layer        | Technology                                    | Description                                                          |
| :----------- | :-------------------------------------------- | :------------------------------------------------------------------- |
| **Frontend** | Next.js (React 18\)                           | Modern SSR/ISR web framework for a fast, responsive user experience. |
| **Backend**  | Django \+ Django REST Framework               | Core API backend, business logic, and agent orchestration.           |
| **Database** | PostgreSQL / Redis                            | Persistent relational storage and in-memory caching/task queue.      |
| **AI Layer** | Python (LangChain, OpenAI, HuggingFace, etc.) | Core AI pipelines, model handling, and agent logic.                  |
| **Hosting**  | Cloud Run / Vercel / AWS                      | Scalable, cloud-native deployment options.                           |
| **Auth**     | JWT / OAuth2 / 2FA                            | Secure authentication and role-based access control.                 |
| **Storage**  | S3 / Cloud Storage                            | File, asset, and trained model persistence.                          |

---

## **Architecture Overview**

The system follows a standard service-oriented architecture:

Code snippet

graph TD  
 A\[Next.js Client\] \--\>|REST / WebSocket API| B(Django Backend \- Core API)  
 B \--\> C(AI Agents Module)  
 B \--\> D(Task Scheduler / Cron Jobs)  
 B \--\> E(Redis Cache Layer)  
 B \--\> F(PostgreSQL Database)  
 B \--\> G(Cloud Deployment \- Docker \+ CI/CD)

---

## **Local Development Setup**

### **Prerequisites**

Ensure you have the following installed:

- **Node.js**
- **Python**
- **PostgreSQL** (Local instance or Docker container)
- **Redis** (Optional, for caching and task queues)
- **Docker** (For consistent containerization)

### **Clone & Install**

Bash

git clone https://github.com/hruthikm/ai-agency.git  
cd ai-agency

### **Frontend Setup (client/)**

Bash

cd client  
npm install  
\# Start the Next.js development server  
npm run dev

### **Backend Setup (server/)**

Bash

cd server  
\# Create and activate a Python virtual environment  
python \-m venv venv  
source venv/bin/activate  
\# Install dependencies  
pip install \-r requirements.txt  
\# Run database migrations  
python manage.py migrate  
\# Start the Django development server  
python manage.py runserver

---

## **Environment Variables**

Create the following files in their respective folders, filling in the necessary values:

### **Frontend (client/.env.local)**

Bash

NEXT_PUBLIC_BACKEND_URL=http://localhost:8000  
NEXT_PUBLIC_API_KEY=your_public_api_key_or_client_id

### **Backend (server/.env)**

Bash

DEBUG=True  
SECRET_KEY=your_secret_key  
DATABASE_URL=postgres://user:pass@localhost:5432/ai_agency  
REDIS_URL=redis://localhost:6379/0  
OPENAI_API_KEY=your_openai_key \# Or other model provider key

---

## **Core Modules (Backend)**

| Module        | Description                                                   |
| :------------ | :------------------------------------------------------------ |
| users         | Handles authentication, JWT token management, and 2FA.        |
| agents        | AI agent registry, configuration, and execution logic.        |
| workflows     | Automated task orchestration and complex pipeline management. |
| analytics     | Performance tracking, usage metrics, and logging.             |
| billing       | Subscription, usage tracking, and invoice generation.         |
| notifications | Email, SMS, or push alert handling for agents and users.      |

---

## **Frontend Modules**

| Folder      | Description                                                |
| :---------- | :--------------------------------------------------------- |
| components/ | Reusable UI components (buttons, headers, cards).          |
| pages/      | Application routes and SSR/ISR pages.                      |
| context/    | Global state management (e.g., user session, theme).       |
| hooks/      | Reusable React logic (e.g., useApi, useAuth).              |
| lib/        | API handlers, utility functions, and third-party wrappers. |

---

## **Testing**

We use dedicated tools for testing both layers:

Bash

\# Run Backend tests (Django/Python)  
cd server  
pytest

\# Run Frontend tests (Jest/React Testing Library)  
cd client  
npm run test

---

## **Deployment Guide**

### **Option 1: Local Docker Deploy**

Use docker-compose for a quick, self-contained deployment:

Bash

\# Build images and start all services  
docker-compose up \--build

### **Option 2: Production Cloud Deploy**

1. **Backend:** Push the Django Docker image to Google Artifact Registry. Deploy to **Cloud Run** with necessary environment variables and secrets.
2. **Frontend:** Deploy the Next.js application via **Vercel** or **AWS Amplify/CloudFront**, pointing the public API endpoint to the Cloud Run service URL.

---

## **CI/CD**

- **GitHub Actions** are used for automated testing and deployment.
- **Linting:** ESLint (Frontend) and Flake8 (Backend) enforce code quality.
- **Pre-commit hooks** (via Husky/Pre-commit) enforce code formatting (Black for Python, Prettier for JS/TS/CSS).

---

## **Contributing**

1. **Fork** the repository.
2. **Create** your feature branch (git checkout \-b feature/new-ai-agent).
3. **Commit** your changes (git commit \-m 'feat: add new agent type').
4. **Submit** a Pull Request (PR) to the main branch.
5. Wait for code review and approval from a core developer.

---

## **Folder Structure**

root  
 ├── client/ \# Next.js Frontend  
 │ ├── components/  
 │ ├── pages/  
 │ └── ...  
 ├── server/ \# Django Backend  
 │ ├── ai_agents/ \# Core agent logic  
 │ ├── users/  
 │ └── ...  
 ├── docker-compose.yml \# Local environment definition  
 ├── requirements.txt \# Python dependencies  
 ├── README.dev.md \# THIS FILE  
 └── README.client.md \# Customer-facing documentation

---

## **Contact Us**

| Platform     | Details                                                                                                                                            |
| :----------- | :------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Website**  | [AI Solutionz](https://ai-solutionz.vercel.app/)                                                                                                   |
| **Email**    | [mhrithik450@gmail.com](mailto:mhrithik450@gmail.com)                                                                                              |
| **LinkedIn** | [LinkedIn](https://www.linkedin.com/in/hruthik-m-3595a0329?utm_source=share&utm_campaign=share_via&utm_content=profile&utm_medium=android_app_app) |
| **Location** | Bangalore, India 🇮🇳 (IST)                                                                                                                          |

---

## **License**

This project is licensed under the **MIT License**.

---
