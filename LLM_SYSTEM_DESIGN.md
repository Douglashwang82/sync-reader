# Sync Reader: LLM-Centric System Design

Version: 1.0
Date: 2026-04-05
Status: Proposed

## 1. Purpose and Scope

This document defines a detailed system design for the LLM portion of Sync Reader and its direct dependencies. It turns the PRD into an implementable architecture focused on:

- Reliable multimodal reasoning over mobile screen captures
- Low-latency streaming responses in desktop chat
- Explicit grounding of model outputs in visible captures
- Pluggable model providers with stable core logic
- Privacy-first, zero-retention session processing

This design targets MVP requirements in PRD section 3 (FR-19 through FR-24, plus related session and transport requirements).

## 2. LLM-Specific Objectives

### 2.1 Functional outcomes

- Answer user questions using current and recent visual context from mobile captures
- Reference what is visible and admit uncertainty when content is unreadable
- Stream responses token-by-token to desktop
- Continue operation across transient disconnects
- Support provider switching without touching conversation orchestration

### 2.2 Quality targets

- First token latency: under 3 seconds p95
- Grounding quality: at least 80% of answers cite at least one relevant frame
- Hallucination guardrail: under 5% of sampled answers contain unsupported factual claims about visible content
- Error recovery: at least 99% of provider failures return actionable retry feedback in UI

### 2.3 Capacity assumptions

From PRD MVP target:

- 500 concurrent sessions
- Capture interval default 3s
- Max capture size 200KB

Approximate sustained capture ingress:

- Frames/s = 500 / 3 = 166.7 frames/s
- Ingress bytes/s = 166.7 * 200KB = 33.3 MB/s (before protocol overhead)

LLM compute does not process every frame directly. It processes selected context slices per question.

## 3. Architecture Overview

## 3.1 High-level components

1. Mobile Capture Client
- Captures JPEG frames every 3 seconds (configurable)
- Sends binary frames over WebSocket
- Sends control messages: pause, resume, end

2. Realtime Gateway
- Terminates WSS for mobile and desktop clients
- Validates session membership and connection roles
- Routes frames and control events
- Emits heartbeat and disconnect detection

3. Session Context Service
- Maintains rolling multimodal context per session
- Stores frame metadata, compact embeddings, and chat turns in Redis
- Produces candidate frame sets for each question

4. LLM Orchestrator
- Builds grounded multimodal prompt packages
- Selects provider adapter and model
- Streams completion tokens to desktop
- Handles retries, fallback, and error normalization

5. Provider Adapter Layer
- Unified interface for OpenAI, Anthropic, future backends
- Handles provider-specific request shape, image packaging, and streaming parse

6. Telemetry and Evaluation Pipeline
- Real-time metrics and structured logs
- Online grounding checks
- Offline benchmark replay and model comparison

## 3.2 Context flow

1. Mobile frame arrives at gateway
2. Frame normalizer validates dimensions and JPEG quality bounds
3. Frame stored in in-memory session ring buffer (max 20 active)
4. Frame metadata enriched:
- sequence number
- timestamp
- perceptual hash
- lightweight visual embedding
- scene change score vs previous frame
5. Desktop preview receives latest frame immediately
6. When user asks a question, orchestrator requests context package from Session Context Service
7. Context package plus chat history goes to provider through adapter
8. Tokens stream back to desktop while final answer metadata is stored

## 3.3 Why this architecture

- Keeps transport concerns independent from model concerns
- Enables deterministic context selection and explainability
- Meets pluggable provider requirement without copy-pasting business logic
- Supports future upgrades like summarization memory and retrieval

## 4. Data Model and Memory Strategy

## 4.1 Session state in Redis

Use Redis as the authoritative volatile session cache.

Keys:

- session:{id}:meta
- session:{id}:frames (sorted set by sequence)
- session:{id}:messages (list)
- session:{id}:question_queue (list)
- session:{id}:status

TTL policy:

- Waiting session code: 5 minutes
- Active session keys: no fixed TTL while active
- On session end: hard delete all keys immediately

## 4.2 Frame object

{
  "frame_id": "uuid",
  "session_id": "uuid",
  "seq": 184,
  "captured_at": "2026-04-05T12:04:09.114Z",
  "jpeg_bytes": "binary",
  "width": 1080,
  "height": 2340,
  "size_bytes": 146203,
  "phash": "hex64",
  "embedding": [0.013, -0.220, ...],
  "scene_delta": 0.41,
  "ocr_hint": null,
  "source": "mobile"
}

Notes:

- No disk persistence in MVP
- embedding can be small vector from lightweight image encoder for frame similarity and scene changes
- ocr_hint remains null in MVP because OCR is out of scope; field reserved for future

## 4.3 Message object

{
  "message_id": "uuid",
  "session_id": "uuid",
  "role": "user|assistant|system",
  "content": "string",
  "created_at": "timestamp",
  "provider": "openai|anthropic|custom",
  "token_count": 312,
  "referenced_frame_ids": ["uuid", "uuid"],
  "latency_ms": 1824,
  "error": null
}

## 4.4 Rolling memory policy

Active context at question time:

- Last 20 frames maximum
- Full chat turns in current session
- Context selector returns 4 to 8 frame candidates for the request

Rationale:

- Limits payload size and cost
- Preserves recent visual continuity
- Enables direct grounding references

## 5. Multimodal Context Selection

Context selection is the core LLM-quality function.

## 5.1 Selector goals

- Include newest frame always
- Include frames most relevant to question intent and recent content transitions
- Avoid near-duplicate frames
- Keep package within token and image budget

## 5.2 Selector inputs

- User question text
- Last N frames (N <= 20)
- Frame embeddings and scene deltas
- Last K chat turns (K configurable, default all with truncation)

## 5.3 Selector algorithm (MVP)

Step 1: Mandatory inclusion
- Include latest frame as anchor frame F0

Step 2: Diversity pre-filter
- Compute similarity to F0 via embedding cosine
- Discard near-duplicates above threshold (for example > 0.985)
- Keep top scene-change frames by scene_delta

Step 3: Text-image relevance scoring
- Compute text embedding for question
- Score candidate frames by similarity(question, frame)

Step 4: Temporal spread
- Ensure at least one frame from each recent time bucket:
  - 0-30 seconds
  - 30-120 seconds
  - 2-10 minutes (if available)

Step 5: Final budgeted set
- Choose 4 to 8 frames:
  - F0 latest
  - 2 to 4 relevance leaders
  - 1 to 2 scene transition leaders
  - optional previously referenced frames from prior assistant turn if follow-up question detected

## 5.4 Follow-up detection

Use a simple classifier over user turn:

- If message starts with pronouns like this, that, here, above, previous, and prior turn exists
- Or if turn length < 12 words and prior assistant turn had referenced frames

Then include previously referenced frames first.

## 5.5 Reference traceability

Every answer stores referenced_frame_ids.

- Provider response parser extracts structured citation tags when possible
- If provider cannot emit structured citations, orchestrator infers likely references from included set and marks confidence low

## 6. Prompting and Grounding Design

## 6.1 System prompt template

The orchestrator injects a strict system instruction block:

- You are assisting a user based on screen captures from their active mobile reading session.
- Prioritize what is currently visible in the latest frame.
- Use recent frames for continuity when the user asks about earlier content.
- If text or image details are unclear, explicitly say what is unclear.
- Do not claim to read details you cannot reliably see.
- Keep responses concise and useful.
- When possible, cite frame references in the form [frame:seq].

## 6.2 User package template

Input package to provider includes:

- user_question
- selected_images with sequence metadata
- compressed conversation transcript
- response format directive:
  - answer text
  - confidence: high, medium, low
  - referenced_frames: [seq]
  - uncertainty_notes if any

## 6.3 Guardrails

1. Visibility guardrail
- If no selected frame has relevance score above threshold, answer must begin with uncertainty statement.

2. Safety and policy guardrail
- Provider-level moderation route for risky categories
- If flagged, return policy-compliant refusal while preserving session continuity

3. Hallucination dampener
- Ask model to separate observations from inferences:
  - Observed on screen:
  - Likely interpretation:

## 6.4 Example response contract (internal)

{
  "answer": "The article argues that...",
  "confidence": "medium",
  "referenced_frames": [184, 179],
  "uncertainty_notes": "The chart labels are partially blurry in frame 179."
}

Desktop renderer can show user-facing prose while attaching small citations.

## 7. Provider Abstraction and Routing

## 7.1 Adapter interface

TypeScript interface:

interface LLMAdapter {
  providerName(): string
  streamMultimodal(request: MultimodalRequest): AsyncGenerator<TokenEvent>
  estimateCost(request: MultimodalRequest): CostEstimate
  normalizeError(error: unknown): LLMError
}

Adapter size target:

- 50 to 100 lines for basic provider integration

## 7.2 Model router

Routing policy (MVP):

- Default provider from server config
- Optional per-session provider override
- Fallback provider if primary returns retriable error class

Error classes:

- RATE_LIMIT
- AUTH
- TIMEOUT
- TRANSIENT_UPSTREAM
- POLICY_BLOCK
- UNKNOWN

Retry policy:

- One immediate retry for transient errors
- One fallback attempt on secondary provider
- Then return graceful failure to client

## 7.3 Streaming normalization

Each provider has different event shapes.

Normalize to gateway event:

{
  "type": "ai_token",
  "session_id": "uuid",
  "message_id": "uuid",
  "delta": "text chunk",
  "done": false
}

Final event includes metadata:

{
  "type": "ai_done",
  "session_id": "uuid",
  "message_id": "uuid",
  "token_count": 402,
  "referenced_frame_ids": ["..."],
  "latency_ms": 2210
}

## 8. End-to-End Runtime Flows

## 8.1 Ask question flow

1. Desktop sends question over WebSocket
2. Orchestrator enqueues question in session queue (sequential processing)
3. Context Service selects frame set
4. Prompt package built and validated for budget
5. Router selects provider and model
6. Adapter starts streaming
7. Tokens forwarded to desktop in near-real-time
8. Completion metadata persisted to Redis message list
9. Telemetry events emitted

## 8.2 Reconnection behavior

During short disconnect:

- Desktop input disabled with reconnecting state
- Mobile frames buffered server-side and optionally on mobile (up to 50 local frames)
- On reconnect, server sends missed frame metadata and message tail

Guarantee for PRD:

- No message loss for disconnects under 5 seconds with server buffering

## 8.3 Session end flow

1. End signal from either client
2. Broadcast ended state to both clients
3. Cancel in-flight model streams
4. Purge Redis keys for frames and messages
5. Emit session_ended telemetry with aggregate counters

## 9. Latency, Cost, and Token Budget Controls

## 9.1 Latency budget decomposition

Target first token under 3s.

Typical budget:

- Queue wait: 0 to 200ms
- Context selection: 80 to 200ms
- Prompt packaging and upload: 200 to 600ms
- Provider time to first token: 700 to 1800ms
- Stream bridge overhead: 20 to 80ms

## 9.2 Payload controls

- Max images per query: 8
- Max image dimensions sent to provider: 1080 px longest side
- JPEG quality 70 to 80 from mobile
- Duplicate image suppression via phash

## 9.3 Token controls

- Keep full chat in memory store, but apply dynamic transcript truncation by token estimate
- Preserve last turns fully, summarize older turns into compact memory block when needed

## 9.4 Cost controls

- Provider-specific cost estimate before request
- Emit per-message estimated and actual token/cost metrics
- Optional session-level soft cap with warning banner

## 10. Error Handling and UX Contracts

## 10.1 User-visible error mapping

- AUTH: AI service configuration issue. Check provider settings.
- RATE_LIMIT: AI service is busy. Retry in a few seconds.
- TIMEOUT: Response is taking longer than expected. Retry.
- POLICY_BLOCK: Cannot answer this request due to policy constraints.
- UNKNOWN: Temporary issue. Retry.

## 10.2 Fallback behavior

If multimodal call fails after retries:

- Return failure status with retry action
- Preserve question in chat history marked as failed
- Do not drop session context

## 10.3 Partial stream failure

If stream starts but fails mid-way:

- Send ai_error with partial_content flag
- Persist partial assistant message with status partial
- Allow user retry from same question context

## 11. Security and Privacy Design

## 11.1 Data handling

- WSS only with TLS 1.3
- Session-bound authorization tokens for socket roles
- No frame persistence to disk
- In-memory and Redis-only ephemeral storage
- Immediate purge on session end

## 11.2 Key management

- Provider API keys server-side only
- Encrypted at rest in secrets manager
- Rotatable without redeploy

## 11.3 Abuse controls

- Rate limits:
  - 100 websocket messages per minute per client
  - 20 LLM requests per minute per session
- Input size caps for text and image payloads
- Basic prompt injection resistance:
  - system prompt precedence
  - no execution of model-returned instructions

## 11.4 Compliance readiness

MVP alignment:

- Zero retention
- Explicit consent before capture
- Privacy notice in mobile onboarding

## 12. Observability, Evaluation, and Quality Gates

## 12.1 Telemetry events to emit

- question_asked
- ai_response_received
- ai_provider_error
- capture_sent
- reconnection_attempt

Attach common dimensions:

- session_id
- provider
- model
- latency buckets
- token counts
- selected_frame_count
- confidence level

## 12.2 LLM quality evaluation

Build offline eval set from synthetic or consented de-identified sessions:

- 10 content categories (papers, blogs, code docs, PDFs, social threads, charts)
- For each:
  - frame timeline
  - user questions
  - expected answer rubric

Scored metrics:

- grounding correctness
- answer relevance
- uncertainty honesty
- citation usefulness

Pass gate before public beta:

- grounding correctness >= 0.8
- uncertainty honesty >= 0.9
- median first token <= 3s in staging load tests

## 12.3 Online guardrail checks

Sample 5% of responses for lightweight automated checks:

- includes references when visual claims are made
- does not claim certainty with low confidence
- no forbidden sensitive leakage patterns

## 13. API and Event Contracts

## 13.1 WebSocket events

Desktop to server:

- session_join { code }
- chat_question { text, client_msg_id }
- session_end {}

Mobile to server:

- session_create {}
- frame_binary (jpeg bytes + metadata envelope)
- capture_pause {}
- capture_resume {}
- session_end {}

Server to desktop:

- session_status { waiting|active|reconnecting|ended }
- frame_update { seq, captured_at, image_ref_or_inline }
- ai_token { message_id, delta }
- ai_done { message_id, token_count, referenced_frames }
- ai_error { message_id, code, message, retriable }

## 13.2 Question queue contract

Per-session single-flight policy:

- One active inference per session
- Additional questions queued FIFO
- UI shows typing indicator and queue position optionally

Reason:

- Predictable context and stable costs
- Matches PRD requirement for sequential processing under rapid question bursts

## 14. Deployment and Scaling Plan

## 14.1 Runtime topology

- Node.js gateway and orchestrator in same deploy unit for MVP
- Redis managed instance for volatile state
- Horizontal scale by sticky-session or shared pub/sub for socket events

## 14.2 Scale strategy

Phase 1 (up to 500 sessions):

- 2 to 4 app instances behind load balancer
- Redis single primary with persistence disabled or minimal append policy for reliability

Phase 2 (beyond 500 sessions):

- Separate gateway and orchestrator services
- Redis cluster
- Async job queue for model calls if burst pressure appears

## 14.3 SLOs and alerts

Core SLOs:

- first token latency p95 < 3s
- ai error rate < 2%
- websocket disconnect rate < 1% per session-hour

Alert examples:

- provider timeout spike > 5% over 5 minutes
- reconnect failures > 3% over 10 minutes
- frame ingress lag > 2 seconds p95

## 15. Implementation Roadmap (6 weeks)

Week 1:

- WebSocket session lifecycle
- Redis session schema
- Basic frame ingest and desktop preview

Week 2:

- LLM adapter interface
- Primary provider streaming path
- Simple prompt package with latest frame only

Week 3:

- Context selector with rolling 20-frame policy
- Citation metadata persistence
- Sequential question queue

Week 4:

- Secondary provider fallback
- Error normalization and retry UX
- Telemetry baseline

Week 5:

- Latency and cost tuning
- Load tests for 500 concurrent sessions
- Grounding evaluation harness

Week 6:

- Security and privacy hardening
- Beta readiness checks
- Feature flags for provider selection and export hooks

## 16. Risks and Mitigations

1. iOS capture constraints reduce frame reliability
- Mitigation: dedicated iOS spike, monitor dropped frame rate, tune interval adaptively

2. LLM cost spikes with image-heavy prompts
- Mitigation: strict frame budget, duplicate suppression, optional transcript summarization

3. Grounding quality drifts across providers
- Mitigation: provider-specific prompt tuning and shared evaluation gate

4. Model latency variance harms UX
- Mitigation: fallback routing and user-visible progress states

## 17. Open Decisions

1. Should frame embeddings be computed server-side or on mobile to reduce backend CPU?
2. Should we add optional OCR hints post-MVP to improve citation precision?
3. Should confidence level be shown to users directly in chat UI?
4. Which provider is default for closed beta given cost and latency trade-off?

## 18. Definition of Done for LLM MVP

A release candidate is done when all conditions hold:

- FR-19 to FR-24 acceptance criteria pass
- first token latency p95 under 3s in staging load
- provider switch works by config only
- retry and fallback paths validated in chaos tests
- zero-retention purge verified at session end
- offline eval thresholds met
