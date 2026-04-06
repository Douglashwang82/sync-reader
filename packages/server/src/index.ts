import express from 'express';
import http from 'http';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import Redis from 'ioredis';
import { Server as SocketIOServer } from 'socket.io';

import { SessionManager } from './session/SessionManager.js';
import { WebSocketGateway } from './gateway/WebSocketGateway.js';
import { LLMOrchestrator } from './llm/LLMOrchestrator.js';
import { ContextSelector } from './llm/ContextSelector.js';
import { OpenAIAdapter } from './llm/providers/OpenAIAdapter.js';
import { AnthropicAdapter } from './llm/providers/AnthropicAdapter.js';
import type { ServerConfig } from './types/index.js';

// Load environment variables
dotenv.config();

// Configuration
const config: ServerConfig = {
  port: parseInt(process.env.PORT || '3002'),
  redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',
  openaiApiKey: process.env.OPENAI_API_KEY || '',
  anthropicApiKey: process.env.ANTHROPIC_API_KEY || '',
  sessionSecret: process.env.SESSION_SECRET || 'default-secret'
};

// Validate required API keys
if (!config.openaiApiKey) {
  console.error('❌ OPENAI_API_KEY is required');
  process.exit(1);
}

if (!config.anthropicApiKey) {
  console.error('❌ ANTHROPIC_API_KEY is required');
  process.exit(1);
}

async function startServer() {
  try {
    // Initialize Redis
    const redisClient = new Redis(config.redisUrl, {
      retryDelayOnFailover: 100,
      maxRetriesPerRequest: 3,
      lazyConnect: true
    });

    // Test Redis connection
    await redisClient.ping();
    console.log('✅ Redis connected');

    // Initialize Express app
    const app = express();
    const server = http.createServer(app);

    // Basic middleware
    app.use(helmet());
    app.use(cors({
      origin: true, // Allow all origins for MVP
      credentials: true
    }));
    app.use(express.json());

    // Health check endpoint
    app.get('/health', (req, res) => {
      res.json({ 
        status: 'ok', 
        timestamp: new Date().toISOString(),
        version: '1.0.0'
      });
    });

    // Initialize Socket.IO
    const io = new SocketIOServer(server, {
      cors: {
        origin: true,
        methods: ['GET', 'POST']
      },
      transports: ['websocket', 'polling']
    });

    // Initialize components
    const sessionManager = new SessionManager(redisClient);
    const contextSelector = new ContextSelector();
    
    // Initialize LLM providers
    const openaiAdapter = new OpenAIAdapter(config.openaiApiKey);
    const anthropicAdapter = new AnthropicAdapter(config.anthropicApiKey);
    const llmOrchestrator = new LLMOrchestrator(
      [openaiAdapter, anthropicAdapter],
      contextSelector
    );

    // Initialize WebSocket gateway
    const wsGateway = new WebSocketGateway(io, sessionManager, llmOrchestrator);

    // Start server
    server.listen(config.port, () => {
      console.log(`🚀 Sync Reader backend running on port ${config.port}`);
      console.log(`📊 Health check: http://localhost:${config.port}/health`);
      console.log(`🔌 WebSocket endpoint: ws://localhost:${config.port}`);
    });

    // Graceful shutdown
    process.on('SIGINT', async () => {
      console.log('\n🔄 Shutting down gracefully...');
      
      // Close WebSocket connections
      io.close();
      
      // Close Redis connection
      await redisClient.quit();
      
      // Close HTTP server
      server.close(() => {
        console.log('✅ Server shut down complete');
        process.exit(0);
      });
    });

    process.on('SIGTERM', async () => {
      console.log('\n🔄 SIGTERM received, shutting down...');
      
      // Close WebSocket connections
      io.close();
      
      // Close Redis connection
      await redisClient.quit();
      
      // Close HTTP server
      server.close(() => {
        console.log('✅ Server shut down complete');
        process.exit(0);
      });
    });

    // Handle uncaught exceptions
    process.on('uncaughtException', (error) => {
      console.error('❌ Uncaught Exception:', error);
      process.exit(1);
    });

    process.on('unhandledRejection', (reason, promise) => {
      console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
      process.exit(1);
    });

  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

// Start the server
startServer().catch(error => {
  console.error('❌ Server startup failed:', error);
  process.exit(1);
});