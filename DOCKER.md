# Docker Setup for Sync Reader

This Docker configuration allows you to run the entire Sync Reader frontend and backend with a single command.

## Quick Start

1. **Set up environment variables:**
   ```bash
   cp .env.example .env
   ```
   Edit `.env` and add your API keys:
   - `OPENAI_API_KEY`: Your OpenAI API key
   - `ANTHROPIC_API_KEY`: Your Anthropic API key
   - `SESSION_SECRET`: A random secret for session security

2. **Start all services:**
   ```bash
   docker-compose up --build
   ```

3. **Access the application:**
   - Desktop Web UI: http://localhost:3000
   - Backend API: http://localhost:3002
   - Health Check: http://localhost:3002/health
   - Redis: localhost:6379 (internal)

## Services

### 🖥️ Desktop Frontend (Port 3000)
- React/Vite application served by Nginx
- Optimized for production with gzipped assets
- Automatically connects to backend WebSocket

### 🔧 Backend Server (Port 3002)
- Node.js server with Socket.io
- LLM orchestration (OpenAI + Anthropic)
- Session management via Redis
- Health check endpoint at `/health`

### 📦 Redis (Port 6379)
- Session storage and frame buffering
- Persistent data volume
- Health checks for service coordination

## Development vs Production

This setup is optimized for local development and testing. For production deployment:

1. Use proper secrets management (not .env files)
2. Configure proper CORS origins in the server
3. Use a production Redis instance with proper persistence
4. Add proper SSL/TLS termination
5. Configure proper resource limits

## Commands

```bash
# Start all services
docker-compose up

# Start with rebuild
docker-compose up --build

# Run in background
docker-compose up -d

# Stop all services
docker-compose down

# Stop and remove volumes
docker-compose down -v

# View logs
docker-compose logs -f [service-name]

# Scale specific service
docker-compose up --scale server=2
```

## Troubleshooting

### Service won't start
- Check the logs: `docker-compose logs [service-name]`
- Ensure API keys are set in `.env`
- Make sure ports 3000, 3002, and 6379 are not in use

### Cannot connect to backend
- Verify the server health check: http://localhost:3002/health
- Check if Redis is running: `docker-compose ps`
- Review server logs: `docker-compose logs server`

### Frontend shows connection errors
- Confirm backend is accessible at http://localhost:3002
- Check browser network tab for WebSocket connection errors
- Ensure CORS is properly configured in server

### Redis connection issues
- Wait for Redis health check to pass before starting other services
- Clear Redis data: `docker-compose down -v` then `docker-compose up`

## File Structure
```
├── docker-compose.yml          # Service orchestration
├── Dockerfile.server          # Backend build
├── Dockerfile.desktop         # Frontend build
├── .dockerignore             # Exclude files from builds
└── .env.example              # Environment template
```