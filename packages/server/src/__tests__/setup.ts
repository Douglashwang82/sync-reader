import Redis from 'ioredis';

// Mock Redis for tests
jest.mock('ioredis', () => {
  return jest.fn().mockImplementation(() => ({
    ping: jest.fn().mockResolvedValue('PONG'),
    hset: jest.fn().mockResolvedValue(1),
    hgetall: jest.fn().mockResolvedValue({}),
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue('OK'),
    del: jest.fn().mockResolvedValue(1),
    expire: jest.fn().mockResolvedValue(1),
    zadd: jest.fn().mockResolvedValue(1),
    zrange: jest.fn().mockResolvedValue([]),
    zrevrange: jest.fn().mockResolvedValue([]),
    zremrangebyrank: jest.fn().mockResolvedValue(1),
    pipeline: jest.fn().mockReturnValue({
      hset: jest.fn().mockReturnThis(),
      set: jest.fn().mockReturnThis(),
      expire: jest.fn().mockReturnThis(),
      zadd: jest.fn().mockReturnThis(),
      del: jest.fn().mockReturnThis(),
      zremrangebyrank: jest.fn().mockReturnThis(),
      exec: jest.fn().mockResolvedValue([])
    }),
    quit: jest.fn().mockResolvedValue('OK')
  }));
});

// Mock OpenAI
jest.mock('openai', () => {
  return jest.fn().mockImplementation(() => ({
    chat: {
      completions: {
        create: jest.fn().mockImplementation(async function* () {
          yield {
            choices: [{
              delta: { content: 'Test response' },
              finish_reason: null
            }]
          };
          yield {
            choices: [{
              delta: {},
              finish_reason: 'stop'
            }]
          };
        })
      }
    }
  }));
});

// Mock Anthropic
jest.mock('@anthropic-ai/sdk', () => {
  return jest.fn().mockImplementation(() => ({
    messages: {
      create: jest.fn().mockImplementation(async function* () {
        yield {
          type: 'content_block_delta',
          delta: { type: 'text_delta', text: 'Test response' }
        };
        yield {
          type: 'message_stop'
        };
      })
    }
  }));
});

// Mock Sharp
jest.mock('sharp', () => {
  return jest.fn().mockImplementation(() => ({
    metadata: jest.fn().mockResolvedValue({ width: 800, height: 600 }),
    stats: jest.fn().mockResolvedValue({
      channels: [
        { mean: 128, stdev: 25 },
        { mean: 130, stdev: 27 },
        { mean: 125, stdev: 23 }
      ]
    })
  }));
});

// Set test environment
process.env.NODE_ENV = 'test';
process.env.OPENAI_API_KEY = 'test-openai-key';
process.env.ANTHROPIC_API_KEY = 'test-anthropic-key';
process.env.REDIS_URL = 'redis://localhost:6379';
process.env.SESSION_SECRET = 'test-secret';

// Global test timeout
jest.setTimeout(10000);