# Sync Reader — User Guide

## What is Sync Reader?

Sync Reader creates a live bridge between your phone and your desktop. While you read anything on your phone — articles, PDFs, e-books, research papers, Slack threads — the app periodically captures your screen and streams it to an AI assistant on your desktop. You can then ask questions about what you're reading in natural language and get context-aware answers, without ever copying text or switching apps.

---

## What You Can Do

- **Ask questions about your reading material** — "What does this term mean?" / "Summarize the argument so far" / "How does this relate to what I read earlier?"
- **Get AI answers grounded in your actual screen** — The AI sees up to 20 of your most recent screen captures and picks the most relevant ones to answer each question.
- **Read in any app** — Sync Reader works with your browser, Kindle, PDF reader, Twitter/X, Slack, or any other app. There is nothing to install in those apps.
- **Pause screen capture** — If you switch to something private (banking, messages), you can pause capture with one tap and resume when you're back to reading.
- **End and discard sessions** — All screen captures are held only in memory and deleted the moment the session ends. Nothing is ever written to disk.

---

## What Sync Reader Is Not

- **Not an e-reader or content library** — It does not store or curate content. You read in whatever app you already use.
- **Not a video call** — It captures a still image roughly every 3 seconds, not live video or audio.
- **Not multi-user** — One phone connects to one desktop per session.
- **Not offline** — Both your phone and your desktop must have an active internet connection.

---

## Requirements

| Component | Requirement |
|-----------|-------------|
| Mobile app | React Native / Expo app (Android & iOS) |
| Desktop | Any modern browser (Chrome, Firefox, Safari, Edge) |
| Internet | Active connection on both devices |
| Server | Running instance with valid OpenAI and Anthropic API keys |

---

## Getting Started

### Step 1 — Start a Session on Your Phone

1. Open the **Sync Reader** mobile app.
2. Tap **Create Session**.
3. The app displays a **6-character session code** (e.g., `A3BX7Q`) and begins connecting to the server.

> The code is shown in large text on screen. Keep this screen visible while you pair your desktop.

### Step 2 — Connect on Your Desktop

1. Open the Sync Reader web app in your browser.
2. Type the **6-character code** from your phone into the code input field.
3. Press **Join Session** (or hit Enter).
4. The desktop UI changes to show the main interface — a phone preview panel on the left and a chat panel on the right.

### Step 3 — Start Reading

1. On your phone, **switch to any reading app** — your browser, Kindle, a PDF viewer, anything.
2. The mobile app runs in the background, capturing your screen every **~3 seconds** and streaming frames to the server.
3. On your desktop you will see a live thumbnail of your phone screen updating in the phone preview panel. This confirms data is flowing.

### Step 4 — Ask Questions on Your Desktop

1. Click the chat input at the bottom of the desktop UI.
2. Type your question and press **Enter** or click **Send**.
3. The AI selects the most relevant recent screen captures from your session and streams a response back — typically within 3 seconds.
4. Continue the conversation naturally. The AI has context from your full session history.

---

## Desktop Interface

```
┌──────────────────────┬─────────────────────────────────────┐
│                      │  Sync Reader      Session: A3BX7Q   │
│   Phone Preview      │  Mobile Connected          [End]    │
│                      ├─────────────────────────────────────┤
│  (live thumbnail     │                                     │
│   of your phone      │  [AI answer appears here,           │
│   screen)            │   streamed in real time]            │
│                      │                                     │
│                      │  You: What is the main argument?    │
│                      │  AI:  The author argues that...     │
│                      │                                     │
│                      ├─────────────────────────────────────┤
│                      │  Ask about what you're reading... │ │
└──────────────────────┴─────────────────────────────────────┘
```

**Session status bar** — shows your session code and whether your phone is connected. If it says "Waiting for Mobile", the phone has not yet paired.

**Phone preview panel** — displays the latest screen capture from your phone. Shows a placeholder if no frames have arrived yet.

**Chat panel** — the conversation history. Your messages appear on the right, AI responses on the left. New tokens stream in as the AI responds.

**Chat input** — type up to 1,000 characters. Press Enter to send (Shift+Enter for a newline). Disabled while the AI is responding.

---

## Mobile Interface

### Session Screen (before pairing)

- **Create Session** button — generates your session code and waits for the desktop to connect.
- **Session code display** — large blue code shown while waiting for the desktop to join.
- **Cancel** — returns to the start screen without connecting.

### Capture Screen (after pairing)

| Element | Description |
|---------|-------------|
| Session Active / Code | Confirms which session is running |
| Capture Status | Shows whether capture is Active (green) or Paused (orange) |
| Frames sent | Running count of frames successfully transmitted |
| Last capture | Timestamp of the most recent frame |
| **Pause / Resume** button | Stops or restarts screen capture without ending the session |
| **End Session** button | Ends the session and deletes all session data |

> **Privacy tip:** Tap **Pause Capture** before switching to any app with personal information. Tap **Resume Capture** when you return to your reading.

---

## Tips for Best Results

**Ask specific questions.** "What does the author mean by 'emergent complexity'?" works better than "Explain this."

**Scroll slowly.** The capture interval is ~3 seconds. Give the app a moment to capture each new section before asking about it.

**Keep the Sync Reader app in the foreground or recent apps.** On some devices, aggressive battery optimization may suspend background apps. Check your device settings if frames stop updating.

**Ask follow-up questions.** The AI maintains conversation history for the full session, so you can refer back to earlier answers or build on previous context.

**Pause when switching apps.** If you check messages or open your banking app mid-session, tap Pause first. The desktop AI only sees what you explicitly share.

---

## Ending a Session

**From the mobile app:** Tap **End Session** → confirm the prompt. All frames and conversation history are immediately deleted from the server.

**From the desktop:** Click **End Session** in the top-right corner. The desktop resets to the session code entry screen.

After a session ends, the session code is no longer valid. Start a new session if you want to continue.

---

## Running the Server (Self-Hosted)

### With Docker (recommended)

1. Copy `.env.example` to `.env` and fill in your keys:
   ```
   OPENAI_API_KEY=sk-...
   ANTHROPIC_API_KEY=sk-ant-...
   REDIS_URL=redis://redis:6379
   SESSION_SECRET=<a long random string>
   PORT=3002
   ```
2. Start all services:
   ```bash
   docker compose up
   ```
3. The desktop web UI will be available at `http://localhost:3000`.
4. The backend API and WebSocket endpoint run on `http://localhost:3002`.

### Without Docker (development)

1. Ensure **Node.js ≥ 18** and **Redis** are installed and Redis is running.
2. Install dependencies:
   ```bash
   npm install
   ```
3. Create `.env` in `packages/server/` with the keys listed above.
4. Start all packages in development mode:
   ```bash
   npm run dev
   ```

---

## Troubleshooting

| Problem | What to check |
|---------|---------------|
| "Connection lost" on mobile | Check your internet connection. Tap **Retry Connection**. |
| Session code not accepted on desktop | Make sure you typed all 6 characters exactly. Codes are alphanumeric (A–Z, 0–9). |
| Phone preview shows "Waiting for screen capture…" | Ensure the mobile app is in the foreground and capture is not paused. |
| AI responses feel generic or miss context | Scroll slowly — give the app time to capture each page before asking. |
| Server fails to start | Confirm `OPENAI_API_KEY` and `ANTHROPIC_API_KEY` are set, and Redis is reachable. |
| App suspended in background (iOS/Android) | Disable battery optimization for Sync Reader in your device settings. |

---

## Privacy & Data Handling

- Screen captures are **never written to disk**. They are held in Redis memory with a short TTL and deleted immediately when the session ends.
- API keys are **server-side only** — they are never transmitted to your browser or phone.
- The conversation history exists only for the duration of the session. There is no persistent account or history storage.
- The AI model providers (OpenAI, Anthropic) receive the selected frame images and your question text in order to generate responses. Review their respective privacy policies for how they handle API inputs.
