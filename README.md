# CortexAI

A multi-agent AI chat platform built with the MERN stack and a microservices backend. Messages are routed by a LangGraph workflow to the best agent: general chat, live web search, or coding help.

## Features

- **Multi-agent routing:** an Auto mode picks the right agent for each message, or you can choose one manually (Chat, Coding, Search).
- **Live web search:** answers use fresh results and show clickable sources and relevant images.
- **Conversation memory:** each chat keeps its history, so follow-up questions make sense.
- **Smart chat titles:** the first message of a chat gets an automatic title.
- **Rich answers:** Markdown with tables, syntax-highlighted code blocks with line numbers and a Copy button.
- **Image viewer:** open search images in a blurred full-screen viewer with next / previous controls.
- **Planned:** PDF, PPT and image-generation agents.

## Architecture

| Service | Port | Responsibility |
|---|---|---|
| Frontend (React + Vite) | 5173 | Chat interface |
| Gateway (Express) | 8000 | Single entry point, routes requests to services |
| Auth service | 8001 | Users and authentication |
| Chat service | 8002 | Conversations and messages (MongoDB) |
| Agent service | 8003 | LangGraph router and AI agents |
| Billing service | - | Plans and payments |

## Tech Stack

- **Frontend:** React, Redux, Tailwind CSS, react-markdown
- **Backend:** Node.js, Express, microservices
- **Database and cache:** MongoDB (Mongoose), Redis
- **AI:** LangChain, LangGraph, Tavily search

## Getting Started

1. Clone the repository.
2. In each service folder (`backend/services/*`, the gateway and `frontend`), run:

   ```bash
   npm install
   ```

3. Create a `.env` file in each service, using its `.env.example` as a guide. Never commit real secrets.
4. Start each service:

   ```bash
   npm run dev
   ```

5. Open `http://localhost:5173`.

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
  frontend/
```

## Status

Work in progress. Chat, Coding and Search agents are working; PDF, PPT and Vision agents are planned.
