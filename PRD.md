# PRD: Sync Reader

> **Version:** 1.0 | **Date:** 2026-04-05 | **Status:** Draft

---

## 1. Context

### Problem Statement
People constantly read content on their phones — articles, ebooks, PDFs, social media threads, documentation — but when they want to ask questions, take notes, or discuss what they're reading, they have to manually copy-paste text or describe what they're looking at. This context-switching is tedious and breaks the reading flow. There is no seamless way to have an AI-powered conversation about exactly what you're reading on your phone, in real time, from the comfort of a full desktop keyboard and screen.

### Product Vision
Sync Reader creates a live bridge between your mobile reading experience and a desktop AI assistant that sees exactly what you see. Reading becomes a collaborative experience where asking questions, getting summaries, or exploring deeper context is as natural as having a knowledgeable friend reading over your shoulder.

### Goals
- Enable real-time screen sharing from a mobile device to a desktop web interface via WebSocket
- Provide an AI-powered conversational agent on the desktop that has full visual context of the user's mobile screen over the entire reading session
- Achieve sub-3-second latency from screen capture to AI context availability
- Support cross-platform mobile (Android & iOS) with a single codebase
- Launch a functional MVP within 6 weeks with a clean, scalable web UI

### Non-Goals
- **This is not an e-reader or content aggregator.** We do not host, curate, or recommend reading content. Users read in whatever app they already use.
- **We will not support real-time audio or video streaming.** The sync mechanism is periodic screen captures, not a live video feed.
- **We will not build OCR or text extraction as a standalone feature.** Screen captures are sent to the AI model's vision capabilities directly; we are not building our own text recognition pipeline.
- **We will not support multi-user collaborative reading in v1.** One mobile device connects to one desktop session.
- **We will not support offline mode.** Both the mobile app and desktop web client require an active internet connection.
- **We will not build a mobile-to-mobile or desktop-to-desktop pairing.** The flow is strictly mobile (capture) → desktop (conversation).

---

## 2. User Experience

### Persona 1: Alex, Graduate Student
- **Background:** 26 years old, reads 20+ research papers per week on their phone during commutes. Uses a desktop at home for writing and note-taking.
- **Pain Point:** Reads a dense paper on the bus, has questions about methodology or terminology, but can't easily discuss it until they get home — by which point they've lost context.
- **Motivation:** Wants an instant, always-available study companion that understands what they're currently reading without manual copy-pasting.

### Persona 2: Maria, Product Manager
- **Background:** 34 years old, constantly scrolling through Slack, competitor blogs, industry reports, and product analytics on her phone throughout the day.
- **Pain Point:** Finds an interesting competitive insight on her phone but needs to synthesize it with other information. Switching between phone and desktop tools is disjointed.
- **Motivation:** Wants to quickly ask "what does this mean for our product?" while reading on her phone, and get intelligent answers on her desktop without context-switching overhead.

### Critical User Flow

**Flow Name:** "Start reading on phone, ask a question on desktop"

```
Step 1: User opens Sync Reader mobile app → App displays a unique session code / QR code and begins screen capture service
Step 2: User opens Sync Reader website on desktop, enters session code or scans QR → WebSocket connection established, desktop shows "Connected" status
Step 3: User switches to any reading app on their phone (browser, Kindle, PDF reader, etc.) → Mobile app captures screen periodically and streams captures to server via WebSocket
Step 4: User types a question on the desktop web interface → AI agent processes the question with full context of all captured screens from the session and responds with a relevant, informed answer ✓
```

**Why this flow is the core:** This is the entire value proposition in four steps — seamless connection, passive capture, and intelligent conversation. If any step breaks (connection fails, captures don't stream, AI lacks context), the product delivers zero value.

**High-risk drop-off points:**
- **Step 1 → Step 2:** User may struggle to pair devices. If the session code is hard to type or QR scanning is unreliable, users will abandon before ever experiencing the product.
- **Step 3:** Screen capture permissions on mobile (especially iOS) are a critical gate. If the permission flow is confusing or the user denies it, no data flows.
- **Step 4:** If AI responses feel generic or don't reference what's actually on screen, users will lose trust in the product immediately.

### User Stories

| # | As a... | I want to... | So that... | Priority |
|---|---------|--------------|------------|----------|
| 1 | Mobile user | Open the app and get a session code instantly | I can pair with my desktop in seconds | P0 |
| 2 | Mobile user | Grant screen capture permission once and have it persist | I don't have to re-authorize every session | P0 |
| 3 | Desktop user | Connect to my phone's session via code or QR scan | I can start a conversation about what I'm reading | P0 |
| 4 | Desktop user | See a live thumbnail of my phone's screen on the desktop | I know the connection is active and can see what's being captured | P0 |
| 5 | Desktop user | Ask questions in a chat interface and get context-aware answers | I can have a meaningful conversation about my reading material | P0 |
| 6 | Desktop user | Scroll through the conversation history and see which screen captures the AI referenced | I can track what context informed each answer | P1 |
| 7 | Mobile user | See a persistent notification showing the active session | I know the capture is running and can stop it easily | P0 |
| 8 | Desktop user | End the session and optionally export the conversation | I can save insights for later reference | P1 |
| 9 | Desktop user | Choose which AI provider powers my conversation | I can use the model I trust most or have API keys for | P1 |
| 10 | Mobile user | Pause and resume screen capture without ending the session | I can protect my privacy when switching to sensitive apps | P1 |

---

## 3. Requirements

### 3.1 Functional Requirements (P0 — MVP)

#### Feature 1: Mobile Screen Capture Service
- **Description:** The mobile app runs a background service that periodically captures the device's screen and transmits the images to the server. This is the data pipeline that powers the entire product.
- **Functional Requirements:**
  - FR-01: App requests and obtains screen capture / media projection permission on first launch with a clear explanation of why it's needed.
  - FR-02: Screen captures are taken at a configurable interval (default: every 3 seconds) while the session is active.
  - FR-03: Captures are compressed (JPEG, quality 70–80%) and resized to max 1080px height before transmission to minimize bandwidth.
  - FR-04: Captures are streamed to the server via the established WebSocket connection as binary frames.
  - FR-05: A persistent notification displays session status (active/paused) and provides a one-tap stop button.
  - FR-06: The capture service gracefully handles app backgrounding, screen-off states, and OS-level interruptions.
- **Constraints & NFRs:** Capture-to-server latency must be < 2 seconds on a typical 4G connection. Battery consumption from the capture service must not exceed 5% per hour of active use.
- **Acceptance Criteria:**
  - [ ] Screen capture permission is requested with a user-friendly rationale dialog
  - [ ] Captures are transmitted to the server within 2 seconds of being taken
  - [ ] Compressed image size is consistently under 200KB per frame
  - [ ] Persistent notification is visible and functional throughout the session
  - [ ] Service continues operating when the user switches to other apps

#### Feature 2: Session Management & Device Pairing
- **Description:** A lightweight session system that pairs a mobile device with a desktop browser using a short-lived code or QR scan. No user accounts required for MVP.
- **Functional Requirements:**
  - FR-07: When the mobile app launches and the user taps "Start Session," the server generates a unique 6-character alphanumeric session code and a corresponding QR code.
  - FR-08: Session codes expire after 5 minutes if no desktop client connects.
  - FR-09: The desktop web client provides both a text input for the session code and a QR scanner (using the desktop webcam) for pairing.
  - FR-10: Upon successful pairing, both clients receive a WebSocket confirmation and the session transitions to "active" state.
  - FR-11: Either party can terminate the session. Termination is communicated to both sides immediately.
  - FR-12: Only one desktop client can connect to a session at a time. Attempting a second connection rejects with an error message.
- **Constraints & NFRs:** Session pairing must complete within 3 seconds of code entry. WebSocket connections must use WSS (TLS-encrypted).
- **Acceptance Criteria:**
  - [ ] Session code is generated and displayed within 1 second of tapping "Start Session"
  - [ ] QR code is scannable from at least 30cm distance on a standard laptop webcam
  - [ ] Session correctly rejects expired codes with a clear error message
  - [ ] Session correctly rejects duplicate desktop connections
  - [ ] Both clients show real-time connection status (connected/disconnected/reconnecting)

#### Feature 3: Real-Time WebSocket Communication Layer
- **Description:** The persistent bidirectional communication channel between mobile app, server, and desktop client that carries screen captures, chat messages, and control signals.
- **Functional Requirements:**
  - FR-13: Server maintains a WebSocket connection with both the mobile app and desktop client for each active session.
  - FR-14: Mobile → Server: binary frames (screen captures) and JSON control messages (pause/resume/end).
  - FR-15: Server → Desktop: screen capture frames (forwarded or stored reference), AI responses, and session state updates.
  - FR-16: Desktop → Server: chat messages (user questions) and control messages (end session).
  - FR-17: Automatic reconnection with exponential backoff (max 30 seconds) on both mobile and desktop clients when the connection drops.
  - FR-18: Server sends heartbeat pings every 15 seconds; clients that miss 3 consecutive pongs are marked as disconnected.
- **Constraints & NFRs:** Server must support at least 500 concurrent sessions for MVP. Message delivery latency (server to desktop) must be < 500ms p95.
- **Acceptance Criteria:**
  - [ ] WebSocket connections remain stable for sessions lasting up to 2 hours
  - [ ] Automatic reconnection succeeds within 30 seconds of a network drop
  - [ ] No messages are lost during brief disconnections (< 5 seconds) due to server-side buffering
  - [ ] Heartbeat mechanism correctly detects and cleans up dead connections

#### Feature 4: AI Conversation Agent
- **Description:** The server-side AI integration that receives user questions along with the accumulated screen capture context and returns intelligent, context-aware responses.
- **Functional Requirements:**
  - FR-19: When a user sends a question, the server constructs a prompt that includes: the user's question, the most recent screen capture, and a selection of prior captures that represent key context changes throughout the session.
  - FR-20: The AI provider is abstracted behind a common interface that supports pluggable backends (OpenAI, Anthropic, and others).
  - FR-21: The server maintains a rolling context window per session — up to the last 20 screen captures and full chat history.
  - FR-22: AI responses are streamed token-by-token to the desktop client via WebSocket for a responsive feel.
  - FR-23: If the AI provider is unavailable or returns an error, the user sees a clear error message with a retry option.
  - FR-24: The system prompt instructs the AI to reference specific visual content from the captures and to acknowledge when it cannot read or interpret something clearly.
- **Constraints & NFRs:** AI response initiation (first token) must occur within 3 seconds of question submission. The pluggable provider interface must support adding a new provider with < 100 lines of adapter code.
- **Acceptance Criteria:**
  - [ ] AI responses demonstrate awareness of content visible in the most recent screen capture
  - [ ] AI responses reference earlier captures when the user asks about something read previously in the session
  - [ ] Switching between AI providers (via configuration) works without code changes to the conversation logic
  - [ ] Streaming responses render token-by-token on the desktop UI
  - [ ] Error states are handled gracefully with retry capability

#### Feature 5: Desktop Web Chat Interface
- **Description:** A clean, responsive web application where the user views their phone's screen in real time and chats with the AI agent about what they're reading.
- **Functional Requirements:**
  - FR-25: Landing page with session code input field and QR scanner option — no sign-up required.
  - FR-26: Once connected, the interface displays two primary panels: (1) a live phone screen preview showing the most recent capture, and (2) a chat panel for conversation.
  - FR-27: The phone screen preview updates in real time as new captures arrive via WebSocket.
  - FR-28: The chat panel supports markdown rendering in AI responses (code blocks, bold, links, lists).
  - FR-29: Session status indicator (connected/disconnected/reconnecting) is always visible.
  - FR-30: The layout is responsive, adapting from a side-by-side panel view on wide screens to a tabbed view on narrower screens.
  - FR-31: A session info bar shows: session duration, number of captures received, and AI provider in use.
- **Constraints & NFRs:** Initial page load must be < 2 seconds on a standard broadband connection. UI must be built with a component-based architecture (React) to support future scaling.
- **Acceptance Criteria:**
  - [ ] Landing page loads and is interactive within 2 seconds
  - [ ] Phone screen preview updates within 1 second of a new capture arriving
  - [ ] Chat messages render with proper markdown formatting
  - [ ] UI works correctly on Chrome, Firefox, Safari, and Edge (latest versions)
  - [ ] Responsive layout transitions cleanly between wide-screen and narrow-screen modes

### 3.2 Edge Cases & Error Handling

| Scenario | Expected Behavior |
|----------|-------------------|
| Mobile app loses network connectivity mid-session | Captures are buffered locally (up to 50 frames). Upon reconnection, buffered captures are sent in order. Desktop shows "Mobile device reconnecting..." status |
| Desktop browser loses connectivity mid-session | Chat input is disabled with "Reconnecting..." overlay. Upon reconnection, any missed captures and messages are synced. Chat history is preserved |
| User denies screen capture permission | App shows a clear explanation of why the permission is needed with a "Grant Permission" button that deep-links to OS settings |
| Session code entered after expiration | Desktop shows "This session code has expired. Please generate a new one from the mobile app." |
| AI provider API key is invalid or rate-limited | User sees "AI service temporarily unavailable. Please check your API configuration or try again in a moment." with a retry button |
| User switches to a sensitive app (banking, passwords) | The pause/resume button on the mobile notification allows instant capture suspension. A privacy reminder is shown during onboarding |
| Very long session (2+ hours) | Older captures beyond the rolling context window are dropped from active memory but the chat history is preserved. User is notified if context has been trimmed |
| Multiple rapid questions before AI responds | Questions are queued and processed sequentially. A "typing..." indicator shows the AI is still processing the previous question |
| Screen capture shows content the AI cannot interpret (complex diagrams, handwritten notes) | AI acknowledges the limitation: "I can see an image/diagram but I'm having difficulty interpreting all the details. Could you describe what you'd like to know about it?" |
| WebSocket connection fails to establish initially | Both clients retry with exponential backoff (1s, 2s, 4s, 8s, max 30s). After 5 failed attempts, show "Unable to connect. Please check your internet connection and try again." |

### 3.3 Analytics & Telemetry Requirements

| Event Name | Trigger | Properties | Purpose |
|------------|---------|------------|---------|
| `session_created` | User taps "Start Session" on mobile | `session_id`, `device_os`, `device_model` | Track session volume and platform distribution |
| `session_paired` | Desktop connects to mobile session | `session_id`, `pairing_method` (code/qr), `pairing_duration_ms` | Measure pairing success rate and friction |
| `session_ended` | Either party ends the session | `session_id`, `duration_seconds`, `capture_count`, `message_count`, `end_reason` (user/timeout/error) | Understand session engagement patterns |
| `capture_sent` | Screen capture transmitted to server | `session_id`, `image_size_bytes`, `capture_latency_ms` | Monitor capture pipeline performance |
| `question_asked` | User sends a chat message | `session_id`, `message_length`, `captures_in_context` | Track conversation engagement |
| `ai_response_received` | AI response fully streamed | `session_id`, `response_latency_ms`, `token_count`, `ai_provider` | Monitor AI performance and cost |
| `ai_provider_error` | AI provider returns an error | `session_id`, `provider`, `error_type`, `error_code` | Track reliability issues |
| `reconnection_attempt` | Client attempts WebSocket reconnection | `session_id`, `client_type` (mobile/desktop), `attempt_number` | Monitor connection stability |
| `permission_granted` | User grants screen capture permission | `device_os`, `is_first_launch` | Track onboarding funnel |
| `permission_denied` | User denies screen capture permission | `device_os`, `is_first_launch` | Identify onboarding drop-off |

### 3.4 Post-MVP Features (P1/P2)
- **User accounts & session history:** Persistent accounts so users can revisit past conversations and reading sessions — P1
- **AI provider selection UI:** In-app settings to choose between AI providers and enter API keys — P1
- **Conversation export:** Export chat + referenced captures as PDF or Markdown — P1
- **Capture pause/resume with smart detection:** Auto-pause when sensitive apps (banking, password managers) are detected — P1
- **Bookmarking & highlights:** Mark specific captures or AI responses as important for later reference — P2
- **Multi-language AI support:** AI responds in the same language as the content being read — P2
- **Browser extension alternative:** A browser extension that captures the active tab instead of requiring a mobile app — P2
- **Shared sessions:** Allow multiple desktop clients to join the same session for collaborative discussion — P2

---

## 4. Constraints

### Performance
| Requirement | Target |
|-------------|--------|
| Screen capture to server latency | < 2 seconds on 4G |
| WebSocket message delivery (server → desktop) | < 500ms p95 |
| AI first-token response time | < 3 seconds |
| Desktop page load time | < 2 seconds on broadband |
| Mobile app battery consumption | < 5% per hour of active capture |
| Concurrent active sessions | 500 minimum for MVP |

### Security
| Requirement | Details |
|-------------|---------|
| WebSocket encryption | WSS (TLS 1.3) for all connections |
| Session code entropy | 6-character alphanumeric (2.1B combinations), expires after 5 minutes |
| Screen capture storage | Captures stored in server memory only during active session; purged on session end |
| AI API keys | Stored server-side, never exposed to client. Encrypted at rest |
| Rate limiting | 100 WebSocket messages/min per client; 20 AI requests/min per session |

### Privacy & Compliance
- **Applicable regulations:** GDPR (if serving EU users), CCPA (California users). Privacy-by-design approach since screen captures may contain any type of personal data.
- **PII handling:** Screen captures are transient — stored only in server memory during the active session and purged immediately upon session end. No captures are persisted to disk or cloud storage in MVP.
- **Data retention:** Zero retention policy for MVP. All session data (captures, chat history) is deleted when the session ends. Post-MVP accounts will have configurable retention with 30-day default.
- **Consent requirements:** Explicit consent screen on mobile app before screen capture begins, explaining what data is captured, where it's sent, and that it's processed by a third-party AI service. Privacy policy link required.
- **Data residency:** Server deployed in US region for MVP. Multi-region support planned for post-MVP based on user geography.

### Localization & Accessibility
- **Languages:** Primary: en-US. The AI agent can respond in multiple languages based on content context, but the UI is English-only for MVP.
- **Accessibility:** WCAG 2.1 AA compliance for the desktop web interface. High-contrast mode support. Keyboard navigation for all chat and session controls.

---

## 5. Technical Implementation (Reference)

> **Note:** This section is a reference for engineering, not a mandate. Engineers should design the architecture based on the requirements above.

> **MVP Philosophy:** Ship fast with managed services. Prioritize developer velocity over theoretical scalability.

### Recommended Tech Stack

| Layer | Technology | Rationale |
|-------|------------|-----------|
| Mobile App | React Native (Expo) | Single codebase for Android & iOS. Expo simplifies build/deploy pipeline. Native modules available for screen capture APIs |
| Desktop Frontend | React + Vite | Fast dev server, component-based architecture, excellent WebSocket library support. Clean separation of concerns for scalability |
| Backend / WebSocket Server | Node.js + Socket.io | Native WebSocket support, excellent performance for real-time I/O, Socket.io provides reconnection, rooms, and namespacing out of the box |
| AI Integration | Pluggable adapter pattern | Common interface wrapping OpenAI, Anthropic, and future providers. Each adapter ~50-80 lines of code |
| Session Store | Redis | In-memory store for session state, capture references, and chat history. Natural TTL support for session expiration |
| Hosting | Railway or Render | Simple deployment for Node.js services. WebSocket support. Free/cheap tiers for MVP |

### System Architecture Overview

The system has three main components connected via WebSocket: (1) a React Native mobile app that runs a screen capture service and streams compressed JPEG frames to the server, (2) a Node.js backend that manages sessions via Redis, routes captures and messages between clients, and interfaces with AI providers through a pluggable adapter layer, and (3) a React web app that displays the live phone screen preview and chat interface. The backend acts as the central hub — it receives binary capture frames from mobile clients, stores them in a rolling buffer in Redis, and forwards them to the paired desktop client. When a user asks a question, the backend assembles a multimodal prompt (text + relevant captures) and streams the AI response back to the desktop via the same WebSocket connection.

### API & Third-Party Integrations

| Integration | Purpose | Notes |
|-------------|---------|-------|
| OpenAI API (GPT-4o) | Primary AI provider — vision + chat | Supports image inputs natively. Pay-per-token pricing |
| Anthropic API (Claude) | Secondary AI provider | Strong vision and reasoning capabilities. Alternative pricing model |
| Socket.io | WebSocket abstraction | Handles reconnection, rooms, binary frames. Well-documented |
| Redis | Session state & capture buffer | Managed Redis via Railway/Render add-on or Upstash for serverless |

### Key Technical Decisions & Trade-offs

- **Periodic screen capture vs. continuous streaming:** Chose periodic captures (every 3s) over video streaming to dramatically reduce bandwidth, server cost, and battery drain. Trade-off: the AI might miss content that flashes briefly on screen.
- **Image-based AI context vs. OCR pipeline:** Sending raw captures to multimodal AI models (GPT-4o, Claude) rather than building an OCR pipeline. Trade-off: higher per-request AI cost, but eliminates an entire processing layer and works with any visual content (diagrams, charts, non-Latin scripts).
- **No user accounts for MVP:** Session-code-based pairing with no sign-up. Trade-off: no session persistence or history, but removes the entire auth stack from MVP scope and eliminates onboarding friction.
- **React Native over native Android/iOS:** Single codebase for both platforms. Trade-off: screen capture APIs require native modules (especially iOS MediaProjection equivalent), which adds complexity, but the UI layer and networking code are shared.
- **Rolling context window (20 captures) vs. full history:** Limits AI prompt size and cost while maintaining relevance. Trade-off: very long sessions lose early context, but this is acceptable for MVP and can be improved with summarization later.

---

## 6. Strategy & Success

### Strategic Assumptions

| # | Assumption | How to Test | Invalidation Signal |
|---|-----------|-------------|---------------------|
| 1 | Users want to discuss what they're reading on their phone using a desktop interface rather than a mobile-only solution | Landing page survey: "Would you use a desktop companion while reading on your phone?" | < 30% positive response |
| 2 | Periodic screen captures (every 3s) provide sufficient context for meaningful AI conversations | Beta user feedback on AI response relevance | > 40% of users report the AI "doesn't understand what I'm reading" |
| 3 | Users are comfortable granting screen capture permissions to a third-party app | Track permission grant rate in beta | < 50% of users who install the app grant the permission |
| 4 | The 2-device flow (phone + desktop) is not too much friction for the value delivered | Measure session completion rate (paired + at least 1 question asked) | < 30% of created sessions result in at least one question |
| 5 | Multimodal AI models are accurate enough to interpret diverse screen content (articles, PDFs, code, social media) | Curated test set across 10 content types, measure response accuracy | < 60% accuracy on the test set |

### Pivot Triggers
If after 200 beta sessions, fewer than 25% of users ask more than 3 questions per session, the core value proposition (ongoing conversation about reading) may be wrong — users might just want quick one-off answers. In that case, pivot to a simpler "screenshot + ask" model without the persistent session. If screen capture permission grant rates stay below 40%, explore the browser extension approach (P2 feature) as the primary product instead, since it requires fewer sensitive permissions.

### Success Metrics

| Metric | Target | Measurement Method |
|--------|--------|-------------------|
| Session pairing success rate | > 90% | `session_paired` / `session_created` events |
| Avg. questions per session | > 5 | `question_asked` events per `session_id` |
| AI response relevance (user rating) | > 4.0 / 5.0 | Post-response thumbs up/down + end-of-session survey |
| Session duration (median) | > 10 minutes | `session_ended` event `duration_seconds` |
| Day-7 retention | > 25% | Cohort analysis of returning users (post-MVP with accounts) |
| Screen capture permission grant rate | > 70% | `permission_granted` / (`permission_granted` + `permission_denied`) |

### Rollout Plan

| Phase | Audience | Goal | Duration |
|-------|----------|------|----------|
| Internal Alpha | Team & friends (10–15 people) | Smoke-test pairing flow, capture pipeline, and AI quality on diverse devices | 1 week |
| Closed Beta | 50–100 invited users (recruited from reading/productivity communities) | Validate value proposition, measure engagement metrics, collect qualitative feedback | 3–4 weeks |
| Public Beta | Open sign-up, featured on ProductHunt / HackerNews | Growth, scale testing, iterate on feedback | Ongoing |

**Feature flag requirements:** Beta features (conversation export, AI provider selection) hidden behind flags. Closed beta access controlled via invite code system (separate from session codes).

---

## 7. Appendix

### User Permissions Matrix (CRUD)

| Entity | Anonymous User (MVP) | Future: Registered User | Future: Admin |
|--------|---------------------|------------------------|---------------|
| Session | Create, Read (own), Delete (own) | CRUD (own) | Read (all), Delete (all) |
| Screen Captures | Create (via mobile), Read (own session) | Read (own, historical) | Read (all) |
| Chat Messages | Create, Read (own session) | CRUD (own) | Read (all), Delete |
| AI Configuration | — | Read/Update (own) | CRUD |

### Proposed Data Model (Reference Only)

> Engineers should treat this as a starting point, not a specification.

**Session**
- `id` (UUID, PK)
- `session_code` (string, unique, 6-char alphanumeric)
- `status` (enum: waiting_for_pair | active | paused | ended)
- `mobile_socket_id` (string, nullable)
- `desktop_socket_id` (string, nullable)
- `ai_provider` (enum: openai | anthropic | custom)
- `created_at` (timestamp)
- `paired_at` (timestamp, nullable)
- `ended_at` (timestamp, nullable)

**Capture**
- `id` (UUID, PK)
- `session_id` → Session (FK)
- `image_data` (binary / buffer reference)
- `sequence_number` (integer)
- `captured_at` (timestamp)

**Message**
- `id` (UUID, PK)
- `session_id` → Session (FK)
- `role` (enum: user | assistant | system)
- `content` (text)
- `referenced_capture_ids` (array of UUIDs, nullable)
- `token_count` (integer, nullable — for AI responses)
- `created_at` (timestamp)

### Open Questions & Risks

| # | Question / Risk | Owner | Status |
|---|----------------|-------|--------|
| 1 | iOS screen capture is restricted — MediaProjection equivalent requires a Broadcast Upload Extension. Can React Native handle this cleanly? | Engineering | Open — Needs spike |
| 2 | AI API costs per session could be high with frequent multimodal requests. What's the projected cost per session at 20 captures + 10 questions? | Product / Engineering | Open — Needs estimation |
| 3 | Will users trust a third-party app with screen capture permissions? Privacy perception is a major adoption risk | Product / Design | Open — Needs user research |
| 4 | Socket.io vs. native WebSocket — Socket.io adds overhead but provides reconnection and rooms. Is the trade-off worth it for MVP? | Engineering | Open — Leaning Socket.io |
| 5 | How to handle content that violates AI provider terms of service (NSFW content on screen)? | Product / Legal | Open |
| 6 | Battery optimization on different Android OEMs — aggressive battery savers may kill the background capture service | Engineering | Open — Needs device testing |

### UI/UX References
- Desktop layout inspiration: ChatGPT interface (chat panel) + Figma mirror (device preview)
- Mobile app inspiration: Minimal — similar to AirDrop/casting setup screens (session code + status only)
- Component library: shadcn/ui (clean, accessible, easy to customize)