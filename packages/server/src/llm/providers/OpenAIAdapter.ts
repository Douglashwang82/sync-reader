import OpenAI from 'openai';
import type { 
  LLMAdapter, 
  MultimodalRequest, 
  TokenEvent, 
  CostEstimate, 
  LLMError 
} from '../../types/index.js';

export class OpenAIAdapter implements LLMAdapter {
  private client: OpenAI;
  
  // Pricing constants (as of 2024)
  private readonly INPUT_COST_PER_1K_TOKENS = 0.01;  // GPT-4 Vision
  private readonly OUTPUT_COST_PER_1K_TOKENS = 0.03;
  private readonly IMAGE_COST_PER_IMAGE = 0.00765; // GPT-4 Vision high detail
  
  constructor(apiKey: string) {
    this.client = new OpenAI({ apiKey });
  }

  providerName(): string {
    return 'openai';
  }

  async *streamMultimodal(request: MultimodalRequest): AsyncGenerator<TokenEvent> {
    try {
      console.log(`🔵 OpenAI processing: ${request.frames.length} frames`);
      
      // Build messages array
      const messages: OpenAI.ChatCompletionMessageParam[] = [
        {
          role: 'system',
          content: this.buildSystemPrompt()
        }
      ];
      
      // Add user message with images
      const userContent: OpenAI.ChatCompletionContentPart[] = [
        {
          type: 'text',
          text: this.buildUserPrompt(request.question, request.frames.length)
        }
      ];
      
      // Add images
      for (let i = 0; i < request.frames.length; i++) {
        const frame = request.frames[i];
        const base64Image = frame.jpegData.toString('base64');
        
        userContent.push({
          type: 'image_url',
          image_url: {
            url: `data:image/jpeg;base64,${base64Image}`,
            detail: 'high' // Use high detail for better analysis
          }
        });
      }
      
      messages.push({
        role: 'user',
        content: userContent
      });

      // Create streaming completion
      const stream = await this.client.chat.completions.create({
        model: 'gpt-4o',
        messages,
        max_tokens: 1000,
        temperature: 0.7,
        stream: true
      });

      // Stream tokens
      for await (const chunk of stream) {
        const delta = chunk.choices[0]?.delta;
        
        if (delta?.content) {
          yield {
            type: 'token',
            questionId: request.questionId,
            content: delta.content,
            provider: 'openai'
          };
        }
        
        // Check for completion
        if (chunk.choices[0]?.finish_reason) {
          yield {
            type: 'done',
            questionId: request.questionId,
            provider: 'openai'
          };
        }
      }
      
    } catch (error) {
      const normalizedError = this.normalizeError(error);
      yield {
        type: 'error',
        questionId: request.questionId,
        error: normalizedError.message,
        provider: 'openai'
      };
    }
  }

  async estimateCost(request: MultimodalRequest): Promise<CostEstimate> {
    // Estimate input tokens (rough approximation)
    const systemPromptTokens = 200; // Estimated system prompt length
    const userPromptTokens = Math.ceil(request.question.length / 4); // ~4 chars per token
    const imageTokens = request.frames.length * 765; // GPT-4V uses ~765 tokens per high-detail image
    
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
      provider: 'openai'
    };
  }

  normalizeError(error: unknown): LLMError {
    if (error instanceof OpenAI.APIError) {
      // Rate limit error
      if (error.status === 429) {
        return {
          type: 'RATE_LIMIT',
          message: 'OpenAI rate limit exceeded. Please try again later.',
          retryAfter: this.extractRetryAfter(error),
          provider: 'openai'
        };
      }
      
      // Bad request or authentication
      if (error.status === 400 || error.status === 401) {
        return {
          type: 'PERMANENT',
          message: `OpenAI API error: ${error.message}`,
          provider: 'openai'
        };
      }
      
      // Server errors
      if (error.status && error.status >= 500) {
        return {
          type: 'TRANSIENT_UPSTREAM',
          message: 'OpenAI service temporarily unavailable',
          provider: 'openai'
        };
      }
      
      // Other API errors
      return {
        type: 'PERMANENT',
        message: `OpenAI error: ${error.message}`,
        provider: 'openai'
      };
    }
    
    // Network or other errors
    if (error instanceof Error) {
      if (error.message.includes('ECONNRESET') || error.message.includes('ETIMEDOUT')) {
        return {
          type: 'TRANSIENT_UPSTREAM',
          message: 'Network error connecting to OpenAI',
          provider: 'openai'
        };
      }
      
      return {
        type: 'PERMANENT',
        message: `OpenAI adapter error: ${error.message}`,
        provider: 'openai'
      };
    }
    
    return {
      type: 'PERMANENT',
      message: 'Unknown OpenAI error',
      provider: 'openai'
    };
  }

  private extractRetryAfter(error: OpenAI.APIError): number | undefined {
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