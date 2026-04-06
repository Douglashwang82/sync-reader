import Anthropic from '@anthropic-ai/sdk';
import type { 
  LLMAdapter, 
  MultimodalRequest, 
  TokenEvent, 
  CostEstimate, 
  LLMError 
} from '../../types/index.js';

export class AnthropicAdapter implements LLMAdapter {
  private client: Anthropic;
  
  // Pricing constants for Claude 3 Sonnet (as of 2024)
  private readonly INPUT_COST_PER_1K_TOKENS = 0.003;
  private readonly OUTPUT_COST_PER_1K_TOKENS = 0.015;
  private readonly IMAGE_COST_PER_IMAGE = 0.0048; // Approximate cost per image
  
  constructor(apiKey: string) {
    this.client = new Anthropic({ apiKey });
  }

  providerName(): string {
    return 'anthropic';
  }

  async *streamMultimodal(request: MultimodalRequest): AsyncGenerator<TokenEvent> {
    try {
      console.log(`🟣 Anthropic processing: ${request.frames.length} frames`);
      
      // Build message content
      const content: Anthropic.MessageParam['content'] = [
        {
          type: 'text',
          text: this.buildUserPrompt(request.question, request.frames.length)
        }
      ];
      
      // Add images
      for (const frame of request.frames) {
        const base64Image = frame.jpegData.toString('base64');
        
        content.push({
          type: 'image',
          source: {
            type: 'base64',
            media_type: 'image/jpeg',
            data: base64Image
          }
        });
      }

      // Create streaming message
      const stream = await this.client.messages.create({
        model: 'claude-3-sonnet-20240229',
        max_tokens: 1000,
        temperature: 0.7,
        system: this.buildSystemPrompt(),
        messages: [{
          role: 'user',
          content
        }],
        stream: true
      });

      // Stream tokens
      for await (const event of stream) {
        if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
          yield {
            type: 'token',
            questionId: request.questionId,
            content: event.delta.text,
            provider: 'anthropic'
          };
        }
        
        if (event.type === 'message_stop') {
          yield {
            type: 'done',
            questionId: request.questionId,
            provider: 'anthropic'
          };
        }
        
        if (event.type === 'error') {
          throw new Error(`Anthropic stream error: ${event.error?.message || 'Unknown error'}`);
        }
      }
      
    } catch (error) {
      const normalizedError = this.normalizeError(error);
      yield {
        type: 'error',
        questionId: request.questionId,
        error: normalizedError.message,
        provider: 'anthropic'
      };
    }
  }

  async estimateCost(request: MultimodalRequest): Promise<CostEstimate> {
    // Estimate input tokens (rough approximation)
    const systemPromptTokens = 200; // Estimated system prompt length
    const userPromptTokens = Math.ceil(request.question.length / 4); // ~4 chars per token
    const imageTokens = request.frames.length * 1600; // Claude 3 uses ~1600 tokens per image
    
    const inputTokens = systemPromptTokens + userPromptTokens + imageTokens;
    const outputTokens = 500; // Estimated average response length
    
    const inputCost = (inputTokens / 1000) * this.INPUT_COST_PER_1K_TOKENS;
    const outputCost = (outputTokens / 1000) * this.OUTPUT_COST_PER_1K_TOKENS;
    const imageCost = request.frames.length * this.IMAGE_COST_PER_IMAGE;
    
    const totalCost = inputCost + outputCost + imageCost;
    
    return {
      inputTokens,
      outputTokens,
      totalCost,
      provider: 'anthropic'
    };
  }

  normalizeError(error: unknown): LLMError {
    if (error instanceof Anthropic.APIError) {
      // Rate limit error
      if (error.status === 429) {
        return {
          type: 'RATE_LIMIT',
          message: 'Anthropic rate limit exceeded. Please try again later.',
          retryAfter: this.extractRetryAfter(error),
          provider: 'anthropic'
        };
      }
      
      // Bad request or authentication
      if (error.status === 400 || error.status === 401) {
        return {
          type: 'PERMANENT',
          message: `Anthropic API error: ${error.message}`,
          provider: 'anthropic'
        };
      }
      
      // Server errors
      if (error.status && error.status >= 500) {
        return {
          type: 'TRANSIENT_UPSTREAM',
          message: 'Anthropic service temporarily unavailable',
          provider: 'anthropic'
        };
      }
      
      // Other API errors
      return {
        type: 'PERMANENT',
        message: `Anthropic error: ${error.message}`,
        provider: 'anthropic'
      };
    }
    
    // Network or other errors
    if (error instanceof Error) {
      if (error.message.includes('ECONNRESET') || error.message.includes('ETIMEDOUT')) {
        return {
          type: 'TRANSIENT_UPSTREAM',
          message: 'Network error connecting to Anthropic',
          provider: 'anthropic'
        };
      }
      
      return {
        type: 'PERMANENT',
        message: `Anthropic adapter error: ${error.message}`,
        provider: 'anthropic'
      };
    }
    
    return {
      type: 'PERMANENT',
      message: 'Unknown Anthropic error',
      provider: 'anthropic'
    };
  }

  private extractRetryAfter(error: Anthropic.APIError): number | undefined {
    const retryAfterHeader = error.headers?.['retry-after'];
    if (retryAfterHeader) {
      const seconds = parseInt(retryAfterHeader, 10);
      return isNaN(seconds) ? undefined : seconds;
    }
    return undefined;
  }

  private buildSystemPrompt(): string {
    return `You are an AI assistant helping users understand content on their mobile screens. The user will ask questions about what they are currently reading or viewing on their phone, and you will analyze the provided screenshots to give helpful, accurate answers.

Key guidelines:
- Analyze the provided screenshots carefully
- Focus on the specific content visible in the images
- If asked about text, read and summarize what you can see
- If multiple screenshots are provided, consider them as a sequence showing the user's reading progression
- Be specific and reference what you can actually see in the images
- If you cannot clearly see or read something, say so rather than guessing
- Keep responses conversational and helpful
- If the question cannot be answered from the visible content, explain what you can see instead

Remember: You are helping someone understand what they are looking at on their mobile device screen.`;
  }

  private buildUserPrompt(question: string, frameCount: number): string {
    const frameText = frameCount === 1 ? 'screenshot' : `${frameCount} screenshots`;
    return `I'm looking at ${frameText} from my mobile phone screen. ${question}`;
  }
}