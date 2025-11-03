


<!--
  Author block (requested to be on top)
-->

**Name:** Ayush Singh  
**University:** IIT Kanpur  
**Department:** BTech in Electrical Engineering

# Mailautomation – IITK Webmail Automation & AI Summarization

Mailautomation is a personal productivity project that connects to the IITK mail system, reads your inbox securely via IMAP, analyzes messages with an AI model, extracts important dates, and helps you compose quick replies. The goal is simple: make your inbox easier to scan, and replying much faster.

## 📺 Demo

Live demo: [ayushsa23.netlify.app/projects/mail-automation](https://ayushsa23.netlify.app/projects/mail-automation)

## Why I built this

I receive lots of announcements and deadline emails. Manually skimming and replying is slow. This app automates the boring parts:
- Summarizes each mail into a 1–2 line card
- Highlights academic and deadline-related dates in a sidebar
- Lets me generate and refine an AI‑drafted reply in a few clicks

## What it does (at a glance)

- 🔐 Secure login (JWT based)
- 📩 Progressive loading of the latest 40 emails (batches of 4)
- 🤖 AI summaries, categories, and event extraction via OpenRouter (MiniMax M2)
- ✉️ Quick-reply with iterative “refine” flow + password confirmation before send
- 🔄 Refresh button + 30‑sec polling (pauses when tab is hidden)
- 🌓 Light/Dark theme toggle

## Bonus Features (3/4 implemented)

1) **External integrations**  
   OpenRouter API (MiniMax M2), IITK IMAP for fetching, MMTP/SMTP for sending.

2) **UI for monitoring/editing**  
   See summaries/categories/events at a glance; generate, edit, and refine replies before sending.

3) **Operational features**  
   Progressive batch execution, 30‑sec polling with visibility awareness, caching of AI results, and robust timeouts.

## Tech Stack

- Frontend: React + TypeScript + TailwindCSS + Vite
- Backend: Node.js + Express + TypeScript
- AI: OpenRouter MiniMax M2 (free) for summarization/categorization/replies
- Email: IMAP (fetch) + MMTP/SMTP (send) with Nodemailer

## Getting Started

### 1) Install dependencies

```bash
npm install
```

### 2) Configure environment

Use the provided example and fill in your values:

```bash
cp .env.example .env
```

Key variables:

```env
OPENROUTER_API=your_openrouter_api_key
WEBMAIL_HOST=qasid.iitk.ac.in
WEBMAIL_PORT=993
MMTP_HOST=smtp.iitk.ac.in
MMTP_PORT=465
PORT=3001
JWT_SECRET=your_jwt_secret_key_change_in_production
NODE_ENV=development
```

Notes:
- IMAP requires port 993 (TLS). Port 443 is for the web UI and will not work with IMAP.
- The app never commits secrets; use `.env` locally.

### 3) Run locally

Backend (Terminal 1):
```bash
npm run dev:server
```

Frontend (Terminal 2):
```bash
npm run dev
```

Default ports: frontend `http://localhost:5173`, backend `http://localhost:3001`.

## Project Structure

```
project/
├── server/
│   ├── index.ts                 # Express server entry
│   ├── routes/
│   │   ├── auth.ts              # Login (JWT)
│   │   └── emails.ts            # Fetch, refresh, generate-reply, send
│   ├── services/
│   │   ├── emailService.ts      # IMAP connection + parsing
│   │   ├── openRouterService.ts # AI analysis + reply generation
│   │   └── smtpService.ts       # MMTP/SMTP send via Nodemailer
│   └── types/
├── src/
│   ├── components/              # Header, EmailCard, Sidebar, ComposeModal
│   ├── pages/                   # Login, Home
│   ├── contexts/                # ThemeContext (light/dark + CSS vars)
│   └── App.tsx / main.tsx
└── .env.example
```

## How it works (high‑level)

1) On login, a JWT is issued.  
2) The frontend progressively fetches and renders emails in batches of 4 (up to 40).  
3) Each email is analyzed once; results are cached in‑memory on the server.  
4) The sidebar aggregates academic/deadline events.  
5) Quick reply lets you prompt the AI, refine the draft, preview, enter CC password, and send.

## API Overview

- `POST /api/auth/login` – authenticate with IITK credentials
- `POST /api/emails/fetch-progressive` – progressive initial load (batches)
- `POST /api/emails/fetch-new` – fetch only new emails since last refresh
- `POST /api/emails/generate-reply` – AI reply (with optional refinement)
- `POST /api/emails/send` – send via MMTP (port 465, SSL/TLS)

## Security & Privacy

- JWT‑based auth; tokens stored locally on the client
- Password prompt before sending keeps credentials ephemeral
- No secrets committed; `.env` is git‑ignored
- Use HTTPS and strong `JWT_SECRET` in production

## Roadmap

- Optional calendar sync (Google Calendar)
- Smart reminders for deadlines
- Multi‑user dashboards (clubs/departments)

## Troubleshooting

If the UI shows “Empty response from server”, ensure the backend is running (`npm run dev:server`) and that IMAP port 993 is reachable from your network. More tips: see `TROUBLESHOOTING.md`.

## License

This project is for educational purposes.
