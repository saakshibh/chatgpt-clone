# ChatBuddy

A full-stack, ChatGPT-style AI chat app built with the **MERN stack** and **Google Gemini**, deployed entirely on free-tier platforms.

**Live demo:** https://chatgpt-clone-brown-eight.vercel.app/

> Note: the first request can take up to a minute, because the free backend sleeps when idle.


---

## Features

### Chat
- Streaming replies (text appears word by word) with a **Stop** button
- Conversation memory: every thread is saved and sent back to the model
- Markdown rendering with **syntax-highlighted code blocks** and a **copy button**
- Auto-generated chat titles
- **Web search** (Gemini's Google Search grounding) with a clickable Sources list
- **Thinking** mode for harder questions
- Attach images, PDF, TXT and MD files (up to 5 files, 10 MB each)

### Chat management
- Rename, pin, archive, delete and **share** (public read-only link) from each chat's menu
- **Projects**: group chats and move them in and out
- **Search** across chat titles and message text (`Ctrl + K`)
- Archived chats view with unarchive and delete

### Modes
- **Codex**: a coding mode with a software-engineer system prompt and starter prompts
- **Scheduled tasks**: run a prompt daily or weekly (optionally with web search), see each run's result, or open it as a normal chat

### Voice
- **Dictation**: speak into the input box (Web Speech API)
- **Voice mode**: a hands-free spoken conversation (listen, think, answer aloud, repeat)
- **Read aloud** on every reply

### Account and settings
- Register and login with **JWT** and **bcrypt**
- Every chat, project, setting and schedule belongs to one user
- **Forgot password** with a one-time recovery code (no email service needed), plus change password
- **Personalization**: your name, about you and custom instructions are sent to the model with every message
- Theme (system, light, dark), export all chats as JSON, delete all chats

---

## Tech stack

| Part | Technology |
|---|---|
| Frontend | React (Vite), react-markdown, rehype-highlight, react-icons |
| Backend | Node.js, Express |
| Database | MongoDB Atlas with Mongoose |
| AI | Google Gemini API (`@google/genai`) |
| Auth | JWT, bcryptjs, express-rate-limit |
| Scheduling | node-cron |
| File uploads | multer (in memory, never stored) |
| Voice | Browser Web Speech API (recognition and synthesis) |
| Hosting | Vercel (frontend), Render (backend), MongoDB Atlas, UptimeRobot |

---

## Project structure

```
chatgpt-clone/
├── client/                 # React app (Vite)
│   └── src/
│       ├── components/     # Sidebar, ChatWindow, modals, AuthPage, VoiceMode ...
│       └── utils/          # auth (token handling), speech (voice helpers)
└── server/                 # Express API
    ├── models/             # User, Thread, Project, Schedule, Settings
    ├── routes/             # auth, chat, projects, search, settings, schedules, share
    ├── middleware/         # JWT auth
    └── utils/              # gemini helpers, scheduler
```

---

## Run it locally

**Prerequisites:** Node.js 20+, a free [MongoDB Atlas](https://www.mongodb.com/atlas) cluster and a free [Gemini API key](https://aistudio.google.com).

```bash
git clone https://github.com/YOUR_USERNAME/chatgpt-clone.git
cd chatgpt-clone
```

**Backend**

```bash
cd server
npm install
```

Create `server/.env`:

```
PORT=8080
MONGODB_URI=your_atlas_connection_string
GEMINI_API_KEY=your_gemini_key
JWT_SECRET=a_long_random_string
CLIENT_URL=http://localhost:5173
```

```bash
npm run dev
```

**Frontend** (in a second terminal)

```bash
cd client
npm install
```

Create `client/.env`:

```
VITE_API_URL=http://localhost:8080/api
```

```bash
npm run dev
```

Open http://localhost:5173 and create an account.

---

## Deployment

| Service | What runs there | Key settings |
|---|---|---|
| MongoDB Atlas | Database | Network access allows `0.0.0.0/0` |
| Render | Backend (Root Directory `server`) | Start command `npm start`, env vars from the list above, `CLIENT_URL` set to the Vercel URL |
| Vercel | Frontend (Root Directory `client`) | `VITE_API_URL` set to `https://<render-url>/api` |
| UptimeRobot | Pings `/health` every 5 minutes | Keeps the free backend awake so scheduled tasks keep running |

`client/vercel.json` rewrites all routes to `index.html`, so share links work on refresh.

---

## Security notes

- Passwords are stored only as bcrypt hashes; recovery codes are stored only as hashes
- All API routes except auth and public share links require a valid JWT
- Every query is scoped to the logged-in user
- Login and recovery routes are rate limited
- CORS is limited to the configured frontend URL

---

## Known limitations

- Hosted on free tiers: the backend sleeps when idle, and Gemini has daily quotas
- Voice features need **Chrome or Edge**, and speech recognition needs an internet connection
- Shared chat links are public to anyone who has the link
- Scheduled tasks only run while the backend is awake
- The app uses its own branding and is **not affiliated with OpenAI**

---

## Future improvements

- Image generation and a file library
- Email-based password reset
- Light and dark themes through proper CSS variables
- Message editing and regenerate

---

## Author

**Sakshi B H** · 4th-year CSE student
GitHub: https://github.com/saakshibh