# LifeLens

Predictive Voice AI for real-world decision making, built as a single unified project with:

- FastAPI backend
- Vapi webhook + tool execution
- Qdrant long-term memory and Qdrant-only user storage
- Real browser live voice chat agent via Vapi Web SDK (primary mode)
- Landing page + authentication modal flow
- Qdrant-backed memory retrieval for both live/secondary flows
- React + Tailwind + Framer Motion premium UI

## Project Structure

```text
lifelens/
  app/
    main.py
    vapi_handler.py
    routes/
      system.py
      vapi.py
    services/
      action_engine.py
      conversation_service.py
      intent_engine.py
      memory_service.py
      session_service.py
      prompts.py
      schemas.py
      settings.py
      state_store.py
      user_service.py
  frontend/
    index.html
    package.json
    postcss.config.js
    tailwind.config.js
    vite.config.js
    src/
      App.jsx
      index.css
      main.jsx
      components/
        AuthModal.jsx
        ActionCards.jsx
        GlassPanel.jsx
        ResponsePanel.jsx
        TranscriptPanel.jsx
        VoiceOrb.jsx
      hooks/
        useSupportChat.js
        useSpeechPlayback.js
        useVapiVoiceAgent.js
      pages/
        Dashboard.jsx
        LandingPage.jsx
  requirements.txt
  .env
  .env.example
```

## Environment Variables

Fill `.env`:

```env
VAPI_PUBLIC_KEY=
VAPI_PRIVATE_KEY=
VAPI_ASSISTANT_ID=
QDRANT_API_KEY=
QDRANT_URL=
GEMINI_API_KEY=
GEMINI_MODEL=gemma-4-26b-it
EMBEDDING_MODEL=text-embedding-004
BACKEND_CORS_ORIGINS=http://localhost:5173
```

For Docker/Compose local setup, start from `.env.example` and keep:

```env
QDRANT_URL=http://qdrant:6333
QDRANT_API_KEY=
BACKEND_CORS_ORIGINS=http://localhost:8000
```

## Docker Quick Start (Recommended For Another PC)

1. Install Docker Desktop.
2. Copy `.env.example` to `.env` and fill required keys (`GEMINI_API_KEY`, and Vapi keys if using live voice).
3. From `lifelens/` run:

```bash
docker compose up --build
```

4. Open `http://localhost:8000`.

This starts:

- `lifelens` app container (FastAPI + built frontend)
- local `qdrant` container with persistent volume

### Rebuild Only App Image

```bash
docker build -t lifelens:latest .
docker run --rm -p 8000:8000 --env-file .env lifelens:latest
```

## Backend Setup

```bash
cd lifelens
python -m venv .venv
.venv\\Scripts\\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

## One-Terminal Startup

Use the root launcher to start both backend and frontend in one terminal:

```bash
cd lifelens
python run.py
```

## Frontend Setup

```bash
cd lifelens/frontend
npm install
npm run dev
```

The live voice chat uses Vapi's Web SDK in the browser. It works best in Chrome or Edge over `localhost` or HTTPS.

## API Endpoints

- `GET /api/health`
- `GET /api/state`
- `GET /api/config`
- `POST /api/chat`
- `POST /api/signup`
- `POST /api/login`
- `POST /api/memory/store`
- `POST /api/memory/retrieve`
- `POST /api/memory/clear`
- `POST /api/user/profile`
- `POST /api/demo-run`
- `POST /api/vapi-webhook`

## Authentication and Session Flow

- Users sign up/login via Qdrant collection `users`.
- Stored user payload shape:
  - `user_id`
  - `name`
  - `phone_or_email`
  - `embedding`
  - `memory`
- Login returns `session_token`; frontend persists this and sends it in API calls.
- Vapi session startup includes `user_id` and `session_token` metadata.
- Webhook resolves user identity and fetches memory for personalized responses.

## Vapi Webhook Configuration

- Webhook URL: `https://<your-public-host>/api/vapi-webhook`
- For private webhook security, include either:
  - `x-vapi-private-key: <VAPI_PRIVATE_KEY>`
  - `Authorization: Bearer <VAPI_PRIVATE_KEY>`

Supported event types:

- `assistant-request`
- `tool-calls`

## Tool Functions

Implemented tools:

- `book_hospital`
- `apply_financial_aid`
- `suggest_jobs`

Each tool returns:

```json
{
  "action": "...",
  "status": "success",
  "details": "..."
}
```

## UI Design Philosophy

**Voice-First Experience with Premium Aesthetics:**

The dashboard is designed to inspire users to share their thoughts and engage meaningfully:

- **Animated gradient background** with organic, flowing blob animations
- **Stunning gradient typography** for the LifeLens title with blue-to-cyan spectrum
- **Motivational messaging** that rotates every 5 seconds with empathetic prompts
- **Large, glowing start button** with gradient (cyan-to-purple) and shadow effects
- **Interactive microphone icon** that pulses during active conversation
- **Premium glassmorphism effects** throughout with 40%+ transparency and backdrop blur
- **Quick-start topic buttons** with smooth hover animations and staggered entrance
- **Gorgeous transcript cards** in corners with gradient backgrounds (blue/purple tones)
- **Modal-based chat interface** with gradient header and smooth animations
- **Live thinking indicator** with animated dot sequence
- **Color psychology**: Calming blues/purples for trust, warm transitions for engagement

## UI Layout

**Voice-First Design:**
- **Live Indicator** with animated rotating border shows connection status
- **Large "Start Conversation" button** with microphone emoji, gradient, and glow effect
- **Motivational Message** displays rotating empathetic prompts below button
- **Voice Orb** in center provides real-time visual feedback during calls
- **Transcripts** in bottom-right corner (gradient cards) show user and LifeLens responses
- **Status Display** in bottom-left corner shows connection status with smooth animations
- **Chat Button** (💬) in top-right corner opens beautiful modal for text-based conversation
- **Animated background blobs** create organic, welcoming visual atmosphere

## Runtime Modes

1. **Live Voice Agent (primary)**
   - Powered by Vapi Web SDK in the browser
   - Start/End voice buttons control active session
   - Real-time transcripts displayed in corner
   - Fully integrated voice experience

2. **LifeLens Conversation (secondary)**
   - Opened via button in top-right corner
   - Modal-based text chat interface
   - Uses `POST /api/chat` backed by `conversation_service.py`
   - Uses Gemini model generation independently from Vapi webhook flow
   - Retrieves/stores memory in Qdrant via `memory_service.py`
   - Quick-start starters for fast interaction

## Production Notes

- Build frontend: `cd lifelens/frontend && npm run build`
- Serve built frontend from FastAPI automatically when `frontend/dist` exists.
- Put FastAPI behind HTTPS reverse proxy for real webhook delivery.
