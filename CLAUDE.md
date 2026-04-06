# CLAUDE.md — Sync Reader

## Project Overview

Sync Reader is a real-time mobile-to-desktop bridge: a mobile app periodically captures the user's screen and streams frames over WebSocket to a backend, which maintains session context and feeds frames to a multimodal LLM so the user can have an AI-powered conversation about exactly what they are reading on their phone — all from a desktop web UI.

**Status:** Pre-implementation. Only PRD.md and LLM_SYSTEM_DESIGN.md exist. No source code yet.

---

## Architecture

Three-tier system connected by WebSocket:

```
Mobile (React Native/Expo)
  └── JPEG frames every ~3s over WSS
      └── Node.js Gateway (Socket.io)
            ├── Session Manager (Redis)
            ├── LLM Orchestrator
            │     └── Provider Adapters (OpenAI / Anthropic)
            └── Desktop Web UI (React + Vite)
```

**Data flow:**
1. Mobile pairs with desktop via 6-char session code (or QR scan).
2. Mobile sends JPEG frames (compressed, <5% battery impact) every ~3 seconds.
3. Backend keeps a rolling 20-frame ring buffer in Redis per session.
4. On user question, Context Selector picks 4–8 most relevant frames.
5. LLM Orchestrator streams tokens back to the desktop UI.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Mobile | React Native + Expo |
| Desktop Frontend | React + Vite |
| Backend | Node.js + Socket.io |
| Session Store | Redis (volatile, no persistence to disk) |
| LLM Providers | OpenAI (GPT-4o) + Anthropic (Claude) via adapter interface |
| Hosting (MVP) | Railway or Render |

---

## Repository Structure (target)

```
sync-reader/
├── apps/
│   ├── mobile/        # React Native / Expo
│   └── desktop/       # React + Vite
├── packages/
│   └── server/        # Node.js + Socket.io gateway + LLM orchestrator
├── PRD.md
├── LLM_SYSTEM_DESIGN.md
└── CLAUDE.md
```

When creating this structure, use a monorepo layout (e.g. pnpm workspaces or npm workspaces). Do not flatten packages into a single root.

---

## Key Constraints & Non-Goals

**Hard constraints (never violate):**
- Session frames are NEVER persisted to disk. Redis TTL clears everything on session end.
- API keys are ALWAYS server-side only — never sent to the client.
- WSS only (TLS 1.3). No plaintext WebSocket connections.
- Mobile → Desktop direction only. Desktop cannot push content to mobile.

**Non-goals (do not implement unless explicitly requested):**
- OCR pipeline — use AI vision directly, not OCR.
- Real-time video/audio streaming.
- Multi-user collaboration.
- Offline mode.
- Content aggregation or e-reader features.
- Mobile-to-mobile sessions.

---

## Performance Targets

These are hard requirements, not aspirational:

| Metric | Target |
|---|---|
| End-to-end question → first AI token | <3s (p95) |
| Screen capture → context available | <2s |
| Concurrent sessions supported | 500 |
| AI grounding quality | ≥80% answers cite relevant frames |
| Hallucination rate | <5% |
| Battery impact of capture service | <5% |
| Session pairing success rate | >90% |

---

## LLM Provider Interface

All providers must implement this interface (see `LLM_SYSTEM_DESIGN.md` for full spec):

```typescript
interface LLMAdapter {
  providerName(): string
  streamMultimodal(request: MultimodalRequest): AsyncGenerator<TokenEvent>
  estimateCost(request: MultimodalRequest): CostEstimate
  normalizeError(error: unknown): LLMError
}
```

- Keep each adapter to 50–100 lines.
- On RATE_LIMIT or TRANSIENT_UPSTREAM: one retry, then fall back to secondary provider, then return actionable error to client.
- Never throw raw provider errors to the client.

---

## WebSocket Event Contracts

These are fixed contracts — do not change event names without updating both sides.

**Desktop → Server:** `session_join`, `chat_question`, `session_end`

**Mobile → Server:** `session_create`, `frame_binary` (raw JPEG bytes), `capture_pause`, `capture_resume`, `session_end`

**Server → Desktop:** `session_status`, `frame_update`, `ai_token`, `ai_done`, `ai_error`

**Server → Mobile:** `session_paired`, `session_error`

---

## Redis Data Model

```
session:{id}:meta          — session metadata (code, status, created_at)
session:{id}:frames        — sorted set, max 20 frames (FIFO eviction)
session:{id}:messages      — chat history
session:{id}:question_queue
session:{id}:status
```

TTL policy: 5 min for unpaired sessions; indefinite while active; immediate purge on `session_end`.

---

## Implementation Order (6-Week Roadmap)

1. **Week 1** — WebSocket session lifecycle, Redis schema, frame ingestion pipeline
2. **Week 2** — LLM adapter interface, provider streaming (OpenAI first), simple prompts
3. **Week 3** — Context selector (20-frame rolling buffer, 4-8 frame selection), citation metadata, question queue
4. **Week 4** — Fallback provider (Anthropic), error handling, telemetry hooks
5. **Week 5** — Latency tuning, 500-session load tests, grounding quality evaluation
6. **Week 6** — Security hardening, rate limiting, feature flags, beta readiness

---

## Coding Guidelines

### General
- Prefer editing existing files over creating new ones.
- Do not add features, abstractions, or error handling beyond what the task requires.
- Do not add docstrings or comments to code you did not change.
- Do not add backwards-compatibility shims for code that has no callers yet.
- Validate only at system boundaries (WebSocket message ingestion, HTTP endpoints). Trust internal data flow.

### TypeScript
- Use strict mode (`"strict": true` in tsconfig).
- Prefer explicit return types on public functions.
- Use `unknown` over `any`. Narrow types rather than casting.
- Use `AsyncGenerator` for streaming LLM responses — do not buffer tokens.

### Security
- Never log frame binary data or API keys.
- Sanitize all user-supplied text before it reaches the LLM prompt.
- Enforce rate limits server-side: 100 WebSocket messages/min per client, 20 LLM requests/min per session.
- Session tokens are bound to their WebSocket connection — reject reuse across connections.

### Testing
- Unit test LLM adapter normalization and context selector logic.
- Integration test the full WebSocket session lifecycle (pair → frame → question → answer → end).
- Load test the gateway at 500 concurrent sessions before Week 6.

---

## Environment Variables

Document all required env vars in a `.env.example` file at the package root. Never commit `.env`. Required keys:

```
OPENAI_API_KEY=
ANTHROPIC_API_KEY=
REDIS_URL=
SESSION_SECRET=
PORT=
```

---

## Open Risks

| Risk | Mitigation |
|---|---|
| iOS screen capture API constraints | Spike iOS Broadcast Upload Extension in Week 1 |
| LLM cost spikes with 8-image prompts | Per-message cost estimation; alert threshold |
| Grounding quality drift across providers | Offline benchmark suite; grounding score metric |
| Model latency variance | Latency budget decomposition logged per request; p95 alerting |

---

## Key Documents

- **PRD.md** — Full product requirements, user personas, functional requirements, success metrics
- **LLM_SYSTEM_DESIGN.md** — LLM orchestration architecture, context selection algorithm, prompt design, provider adapter spec, Redis schema, WebSocket event contracts, latency budget breakdown
