import type { 
  MultimodalRequest, 
  TokenEvent, 
  LLMAdapter, 
  LLMError 
} from '../types/index.js';
import type { ContextSelector } from './ContextSelector.js';

export class LLMOrchestrator {
  constructor(
    private providers: LLMAdapter[],
    private contextSelector: ContextSelector
  ) {
    console.log(`🧠 LLM Orchestrator initialized with ${providers.length} providers`);
  }

  /**
   * Process a user question with selected context frames
   */
  async *processQuestion(request: MultimodalRequest): AsyncGenerator<TokenEvent> {
    try {
      console.log(`🤖 Processing question: "${request.question.substring(0, 50)}..." with ${request.frames.length} frames`);
      
      // Select most relevant frames for context
      const contextFrames = await this.contextSelector.selectRelevantFrames(
        request.frames, 
        request.question
      );
      
      const contextRequest: MultimodalRequest = {
        ...request,
        frames: contextFrames
      };

      // Try primary provider first
      const primaryProvider = this.providers[0];
      if (!primaryProvider) {
        yield {
          type: 'error',
          questionId: request.questionId,
          error: 'No LLM providers available'
        };
        return;
      }

      try {
        yield* this.streamFromProvider(primaryProvider, contextRequest);
        return;
        
      } catch (error) {
        console.warn(`⚠️ Primary provider (${primaryProvider.providerName()}) failed:`, error);
        
        const normalizedError = primaryProvider.normalizeError(error);
        
        // Try fallback provider if error is retryable
        if ((normalizedError.type === 'RATE_LIMIT' || normalizedError.type === 'TRANSIENT_UPSTREAM') 
            && this.providers.length > 1) {
          
          console.log(`🔄 Falling back to secondary provider...`);
          const fallbackProvider = this.providers[1];
          
          try {
            yield* this.streamFromProvider(fallbackProvider, contextRequest);
            return;
            
          } catch (fallbackError) {
            console.error(`❌ Fallback provider (${fallbackProvider.providerName()}) also failed:`, fallbackError);
            const fallbackNormalizedError = fallbackProvider.normalizeError(fallbackError);
            
            yield {
              type: 'error',
              questionId: request.questionId,
              error: `All providers failed. Last error: ${fallbackNormalizedError.message}`,
              provider: fallbackProvider.providerName()
            };
            return;
          }
        }
        
        // No fallback available or error not retryable
        yield {
          type: 'error',
          questionId: request.questionId,
          error: normalizedError.message,
          provider: primaryProvider.providerName()
        };
        return;
      }
      
    } catch (error) {
      console.error('❌ LLM Orchestrator error:', error);
      yield {
        type: 'error',
        questionId: request.questionId,
        error: error instanceof Error ? error.message : 'Unknown orchestration error'
      };
    }
  }

  /**
   * Stream tokens from a specific provider with error handling
   */
  private async *streamFromProvider(
    provider: LLMAdapter, 
    request: MultimodalRequest
  ): AsyncGenerator<TokenEvent> {
    console.log(`🔄 Using provider: ${provider.providerName()}`);
    
    try {
      // Get cost estimate before processing
      const costEstimate = await provider.estimateCost(request);
      console.log(`💰 Estimated cost: $${costEstimate.totalCost.toFixed(4)} (${costEstimate.provider})`);
      
      let tokenCount = 0;
      const startTime = Date.now();
      
      // Stream tokens from provider
      for await (const token of provider.streamMultimodal(request)) {
        if (token.type === 'token') {
          tokenCount++;
        }
        
        // Add provider info to token
        yield {
          ...token,
          provider: provider.providerName()
        };
        
        if (token.type === 'done') {
          const duration = Date.now() - startTime;
          console.log(`✅ Response completed: ${tokenCount} tokens in ${duration}ms (${provider.providerName()})`);
        }
        
        if (token.type === 'error') {
          console.error(`❌ Provider error: ${token.error} (${provider.providerName()})`);
          throw new Error(token.error || 'Provider stream error');
        }
      }
      
    } catch (error) {
      // Re-throw so orchestrator can handle fallbacks
      throw error;
    }
  }

  /**
   * Get available providers
   */
  getProviders(): string[] {
    return this.providers.map(p => p.providerName());
  }

  /**
   * Get provider health status
   */
  async getProviderHealth(): Promise<Record<string, 'healthy' | 'error' | 'unknown'>> {
    const health: Record<string, 'healthy' | 'error' | 'unknown'> = {};
    
    for (const provider of this.providers) {
      try {
        // Try a minimal request to test provider health
        const testRequest: MultimodalRequest = {
          question: 'test',
          frames: [],
          sessionId: 'health-check',
          questionId: 'health-check'
        };
        
        const cost = await provider.estimateCost(testRequest);
        health[provider.providerName()] = cost ? 'healthy' : 'error';
        
      } catch (error) {
        const normalizedError = provider.normalizeError(error);
        health[provider.providerName()] = 
          normalizedError.type === 'RATE_LIMIT' ? 'healthy' : 'error';
      }
    }
    
    return health;
  }

  /**
   * Estimate total cost for a request across providers
   */
  async estimateTotalCost(request: MultimodalRequest): Promise<{
    primary: number;
    fallback: number;
    currency: string;
  }> {
    const costs = await Promise.all(
      this.providers.slice(0, 2).map(async provider => {
        try {
          const estimate = await provider.estimateCost(request);
          return estimate.totalCost;
        } catch {
          return 0; // If estimation fails, assume no cost
        }
      })
    );
    
    return {
      primary: costs[0] || 0,
      fallback: costs[1] || 0,
      currency: 'USD'
    };
  }

  /**
   * Get orchestrator statistics
   */
  getStats() {
    return {
      providersCount: this.providers.length,
      providers: this.providers.map(p => p.providerName()),
      contextSelectorEnabled: !!this.contextSelector
    };
  }
}