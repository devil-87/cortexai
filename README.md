# CortexAI

A multi-agent AI chat platform built with the MERN stack and a microservices backend. Messages are routed by a LangGraph workflow to the best agent: general chat, coding, live web search, PDF, PPT or image (vision). You can also speak to it, and your voice is written into the chat box.

## Features

- **Multi-agent routing:** an Auto mode picks the right agent for each message, or you can choose one manually (Chat, Coding, PDF, PPT, Vision, Search).
- **Chat agent:** general conversation with memory, so follow-up questions make sense.
- **Coding agent:** generates code and shows it as an artifact (`index.html`, `style.css`, `script.js`) with syntax highlighting and a Copy button.
- **Search agent:** live web search with Tavily, with clickable sources and relevant images.
- **PDF agent:** upload a PDF and ask questions about it (RAG with a vector database), or generate a PDF and download it through a secure link.
- **PPT agent:** generates presentations from a topic or prompt.
- **Vision agent:** generates images from a prompt and analyzes images you upload.
- **Voice input (mic):** click the mic, speak your task or prompt, and it is converted to text in the input box.
- **File upload:** attach images and documents to your message.
- **Smart chat titles:** the first message of a chat gets an automatic title.
- **Rich answers:** Markdown with tables and code blocks.
- **Image viewer:** open images in a full-screen viewer with next / previous controls.
- **Authentication:** Google login with Firebase and Redis-backed sessions.
- **Credits and billing:** usage is tracked per user by the billing service.

## Architecture

| Service | Port | Responsibility |
| --- | --- | --- |
| Frontend (React + Vite) | 5173 | Chat interface |
| Gateway (Express) | 8000 | Single entry point, routes requests to services |
| Auth service | 8001 | Users, Firebase login, sessions |
| Chat service | 8002 | Conversations and messages (MongoDB) |
| Agent service | 8003 | LangGraph router and AI agents |
| Billing service | 8004 | Credits, plans and payments |

## Tech Stack

- **Frontend:** React, Vite, Redux Toolkit, Tailwind CSS, react-markdown
- **Backend:** Node.js, Express, microservices
- **Database and cache:** MongoDB (Mongoose), Redis
- **AI:** LangChain, LangGraph, Groq, Gemini, OpenRouter, Tavily search, Qdrant (PDF RAG)
- **Auth:** Firebase Authentication
- **Storage:** Amazon S3 (generated files and images)
- **Deployment:** Docker, Amazon ECR, ECS Fargate, Application Load Balancer, ElastiCache Redis, CloudFront + S3 (frontend)

## Getting Started

1. Clone the repository.
2. In each service folder (`backend/gateway`, `backend/services/*` and `frontend`), run:
   ```bash
   npm install
   ```
3. Create a `.env` file in each service, using its `.env.example` as a guide. Never commit real secrets.
4. Start each service:
   ```bash
   npm run dev
   ```
5. Open http://localhost:5173.

### Run the backend with Docker

```bash
cd backend
docker compose up --build
```

## Project Structure

```
1.cortexAI/
  backend/
    gateway/
    services/
      auth/
      chat/
      agent/
      billing/
    docker-compose.yml
  frontend/
```

## Deployment

Backend services are built as Docker images, pushed to Amazon ECR and run on ECS Fargate behind an Application Load Balancer. The frontend is built with Vite, hosted in a private S3 bucket and served through CloudFront. API requests go to the backend through a separate CloudFront distribution.

## Status

All agents are working: Chat, Coding, Search, PDF, PPT and Vision, along with voice input. The app is deployed on AWS.