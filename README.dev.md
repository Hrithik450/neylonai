# **Overview**

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
| **Frontend** | Next.js                                       | Modern SSR/ISR web framework for a fast, responsive user experience. |
| **Backend**  | Django \+ Django REST Framework               | Core API backend, business logic, and agent orchestration.           |
| **Database** | PostgreSQL / Redis                            | Persistent relational storage and in-memory caching/task queue.      |
| **AI Layer** | Python (LangChain, OpenAI, HuggingFace, etc.) | Core AI pipelines, model handling, and agent logic.                  |
| **Hosting**  | Cloud Run                                     | Scalable, cloud-native deployment options.                           |
| **Auth**     | JWT / OAuth / 2FA                             | Secure authentication and role-based access control.                 |
| **Storage**  | Google Cloud Storage                          | File, asset, and trained model persistence.                          |

---

## **Architecture Overview**

The system follows a standard service-oriented architecture:

```bash
Next.js Client
     |
     | REST API
     v
Django Backend - Core API
     |--> AI Agents Module
     |--> Task Scheduler / Cron Jobs
     |--> Redis Cache Layer
     |--> PostgreSQL Database
     |--> Cloud Deployment - Docker + CI/CD
```

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

```bash
git clone https://github.com/Hrithik450/AI-Solutionz.git
cd AI-Solutionz
```

### **Frontend Setup (client/)**

```bash
cd client
npm install

# Start the Next.js development server
npm run dev
```

### **Backend Setup (primary-server/)**

```bash
cd server

# Create and activate a Python virtual environment
python \-m venv venv
source venv/bin/activate

# Install dependencies
pip install \-r requirements.txt

# create database migrations
python manage.py makemigrations

# Run database migrations
python manage.py migrate

# Start the Django development server
python manage.py runserver
```

---

## **Environment Variables**

Create the following files in their respective folders, filling in the necessary values:

### **Frontend (client/.env.local)**

```bash
MUX_TOKEN_ID=''
MUX_TOKEN_SECRET=''
DATABASE_URL=''
NEXT_PUBLIC_BACKEND_URL=''
REDIS_URL=''
AUTH_SECRET=''
AUTH_GOOGLE_ID=''
AUTH_GOOGLE_SECRET=''
NEXTAUTH_URL=''
```

### **Backend (server/.env)**

```bash
ENCODER_API_URL="" # Secondary server cross encoder api
DATABASE_URL=""
REDIS_URL=""
GCS_URL=""
CHROMA_API_KEY=""
CHROMA_TENANT=""
CHROMA_DATABASE=""
OPENAI_API_KEY=""
GOOGLE_API_KEY=""
CRON_SECRET=""
```

---

## **Core Modules Primary (Backend)**

| Module                                      | Description                                           |
| :------------------------------------------ | :---------------------------------------------------- |
| `primary-server/core/settings.py/`          | Main server configurations.                           |
| `primary-server/text_generation/`           | Core app where AI agents are configured and streamed. |
| `primary-server/text_generation/lib/`       | Utility functions required by the main app.           |
| `primary-server/text_generation/services/`  | Core microservices for the main app.                  |
| `primary-server/text_generation/views/`     | Route handler functions for the main app.             |
| `primary-server/text_generation/urls.py/`   | API routes for the server.                            |
| `primary-server/text_generation/models.py/` | Data models for the server.                           |
| `primary-server/text_generation/tools/`     | Tools and helpers required for AI assistants.         |

## **Core Modules Secondary (Backend)**

| Module                                     | Description                                    |
| ------------------------------------------ | ---------------------------------------------- |
| `secondary-server/cross_encoder/services/` | Core services for AI assistant operations.     |
| `secondary-server/cross_encoder/views/`    | Route handlers for AI assistant functionality. |
| `secondary-server/cross_encoder/urls.py`   | API routes for the cross-encoder module.       |
| `secondary-server/onnx_cross_encoder/`     | Local ONNX re-ranker model for scoring tasks.  |

---

## **Frontend Modules**

| Folder            | Description                                          |
| :---------------- | :--------------------------------------------------- |
| `src/components/` | Reusable UI components (buttons, headers, cards).    |
| `src/pages/`      | Application routes and SSR/ISR pages.                |
| `src/store/`      | Global state management (e.g., user session, theme). |
| `src/hooks/`      | Reusable React logic (e.g., useApi, useAuth).        |
| `src/lib/`        | utility functions, and third-party wrappers.         |
| `src/app/api`/    | API handlers & actions.                              |

---

## **Testing**

We use dedicated tools for testing both layers:

````bash
# Run Backend Server (Django/Python)
cd primary-server
python manage.py runserver

# Run Frontend Server (Next.Js)
cd client
npm run dev
```

---

## **Contributing**

1. **Fork** the repository.
2. **Create** your feature branch (git checkout \-b feature/new-ai-agent).
3. **Commit** your changes (git commit \-m 'feat: add new agent type').
4. **Submit** a Pull Request (PR) to the main branch.
5. Wait for code review and approval from a core developer.

---

## **Folder Structure**

AISolutionz
├── client/ # Next.js Frontend
│ ├── src/components/ # Reusable UI components
│ ├── src/app # Main app pages/routes
│ └── ... # Other frontend files
├── primary-server/ # Django Backend
│ ├── text_generation/ # Core AI agent logic
│ ├── core/ # Server configurations
│ └── requirements.txt # Python dependencies
├── README.dev.md # Developer-focused documentation
└── README.md # Customer-facing documentation

---

## **Contact Us**

| Platform     | Details                                                                                                                                            |
| :----------- | :------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Website**  | [AI Solutionz](https://ai-solutionz.vercel.app/)                                                                                                   |
| **Email**    | [AI Solutionz](mailto:mhrithik450@gmail.com)                                                                                                       |
| **LinkedIn** | [LinkedIn](https://www.linkedin.com/in/hruthik-m-3595a0329?utm_source=share&utm_campaign=share_via&utm_content=profile&utm_medium=android_app_app) |
| **Location** | Bangalore, India 🇮🇳 (IST)                                                                                                                          |

---

## **License**

This project is licensed under the **MIT License**.

---
````
