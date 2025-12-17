// Intelligent Multi-Model Router with Circuit Breaker
import { BaseAgent } from './BaseAgent.js';
import { MODEL_STRATEGIES, FALLBACK_RULES } from '../config/modelPriority.js';

export class MultiModelRouter {
  constructor() {
    this.circuitBreakers = new Map(); // Track provider failures
    this.requestCounts = new Map(); // Track request counts per provider
    
    console.log('🔀 MultiModelRouter initialized');
  }

  /**
   * Route request to best available model
   */
  async route(prompt, images = [], strategy = 'EXTRACTION', context = {}) {
    const models = MODEL_STRATEGIES[strategy] || MODEL_STRATEGIES.EXTRACTION;
    
    console.log(`🔀 Routing request using ${strategy} strategy...`);
    
    for (let i = 0; i < models.length; i++) {
      const modelConfig = models[i];
      const providerKey = `${modelConfig.provider}-${modelConfig.model}`;
      
      // Check circuit breaker
      if (this.isCircuitOpen(providerKey)) {
        console.warn(`⚠️ Circuit breaker open for ${providerKey}, skipping...`);
        continue;
      }

      try {
        console.log(`🔄 Attempting with model ${i + 1}/${models.length}: ${providerKey}`);
        
        const agent = new BaseAgent(modelConfig);
        const result = await agent.invoke(prompt, images);
        
        // Success - reset circuit breaker
        this.recordSuccess(providerKey);
        
        return {
          success: true,
          data: result,
          provider: modelConfig.provider,
          model: modelConfig.model,
          attemptNumber: i + 1,
        };

      } catch (error) {
        console.error(`❌ ${providerKey} failed:`, error.message);
        
        // Record failure
        this.recordFailure(providerKey);
        
        // Check if we should retry or move to next provider
        const shouldFallback = this.shouldFallback(error);
        
        if (!shouldFallback && i < models.length - 1) {
          console.log('⏭️ Trying next provider...');
          continue;
        }
        
        // If last model, throw error
        if (i === models.length - 1) {
          throw new Error(`All models failed. Last error: ${error.message}`);
        }
      }
    }

    throw new Error('No available models to process request');
  }

  /**
   * Check if circuit breaker is open for a provider
   */
  isCircuitOpen(providerKey) {
    const breaker = this.circuitBreakers.get(providerKey);
    
    if (!breaker) return false;
    
    if (breaker.failures >= FALLBACK_RULES.CIRCUIT_BREAKER_THRESHOLD) {
      const timeSinceLastFailure = Date.now() - breaker.lastFailureTime;
      
      if (timeSinceLastFailure < FALLBACK_RULES.CIRCUIT_BREAKER_TIMEOUT) {
        return true; // Circuit is open
      } else {
        // Reset circuit breaker after timeout
        this.circuitBreakers.delete(providerKey);
        return false;
      }
    }
    
    return false;
  }

  /**
   * Record successful request
   */
  recordSuccess(providerKey) {
    this.circuitBreakers.delete(providerKey); // Reset on success
  }

  /**
   * Record failed request
   */
  recordFailure(providerKey) {
    const breaker = this.circuitBreakers.get(providerKey) || {
      failures: 0,
      lastFailureTime: 0,
    };
    
    breaker.failures += 1;
    breaker.lastFailureTime = Date.now();
    
    this.circuitBreakers.set(providerKey, breaker);
  }

  /**
   * Determine if we should fallback based on error type
   */
  shouldFallback(error) {
    const errorMessage = error.message?.toLowerCase() || '';
    
    if (FALLBACK_RULES.RATE_LIMIT && (error.status === 429 || errorMessage.includes('rate limit'))) {
      return true;
    }
    
    if (FALLBACK_RULES.TIMEOUT && errorMessage.includes('timeout')) {
      return true;
    }
    
    if (FALLBACK_RULES.EMPTY_RESPONSE && errorMessage.includes('empty')) {
      return true;
    }
    
    if (FALLBACK_RULES.JSON_PARSE_ERROR && errorMessage.includes('json')) {
      return true;
    }
    
    return false;
  }

  /**
   * Get router statistics
   */
  getStats() {
    const stats = {
      circuitBreakers: {},
      requestCounts: {},
    };

    for (const [key, value] of this.circuitBreakers.entries()) {
      stats.circuitBreakers[key] = {
        failures: value.failures,
        lastFailureTime: new Date(value.lastFailureTime).toISOString(),
        isOpen: this.isCircuitOpen(key),
      };
    }

    for (const [key, value] of this.requestCounts.entries()) {
      stats.requestCounts[key] = value;
    }

    return stats;
  }
}
