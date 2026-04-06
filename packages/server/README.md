# Sync Reader Backend

Node.js backend server for the Sync Reader project - bridges mobile screen capture to desktop AI conversation.

## Architecture

- **WebSocket Gateway**: Handles real-time communication between mobile and desktop clients
- **Session Manager**: Redis-based session lifecycle with rolling frame buffers
- **LLM Orchestrator**: Coordinates AI conversation with context selection
- **Provider Adapters**: OpenAI and Anthropic integrations with fallback

## Quick Start

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Start Redis** (Docker):
   ```bash
   docker run -d --name redis -p 6379:6379 redis:7-alpine
   ```

3. **Environment setup**:
   ```bash
   cp .env.example .env
   # Edit .env with your API keys
   ```

4. **Run server**:
   ```bash
   npm run dev
   ```

## Environment Variables

```
OPENAI_API_KEY=your_openai_api_key_here
ANTHROPIC_API_KEY=your_anthropic_api_key_here
REDIS_URL=redis://localhost:6379
SESSION_SECRET=your_session_secret_here
PORT=3002
```

## Development

- `npm run dev` - Start development server with hot reload
- `npm run build` - Build TypeScript to dist/
- `npm test` - Run test suite
- `npm run test:watch` - Run tests in watch mode

## WebSocket Events

### Mobile → Server
- `session_create` - Create new session with pairing code
- `frame_binary` - Send JPEG frame data
- `session_end` - End session

### Desktop → Server  
- `session_join` - Join session with pairing code
- `chat_question` - Ask AI about current frames
- `session_end` - End session

### Server → Clients
- `session_paired` - Confirmation of successful pairing
- `ai_token` - Streaming AI response tokens
- `ai_done` - AI response complete
- `ai_error` - Error in AI processing

## Session Lifecycle

1. Mobile creates session → gets 6-character code
2. Desktop joins with code → session paired
3. Mobile streams JPEG frames every ~3s
4. Desktop asks questions → AI analyzes relevant frames
5. Either client can end session