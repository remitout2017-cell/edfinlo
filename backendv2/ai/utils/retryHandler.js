// Exponential Backoff Retry Logic

/**
 * Retry function with exponential backoff
 */
export async function retryWithBackoff(
  fn,
  options = {}
) {
  const {
    maxRetries = 3,
    baseDelay = 2000,
    maxDelay = 30000,
    exponential = true,
    rateLimitDelay = 5000,
    contextLabel = 'Operation',
  } = options;

  let lastError;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      
      console.error(
        `❌ ${contextLabel} - Attempt ${attempt + 1}/${maxRetries} failed:`,
        error.message
      );

      // Don't retry on last attempt
      if (attempt === maxRetries - 1) {
        break;
      }

      // Calculate delay
      let delay = baseDelay;
      
      if (error.status === 429 || error.message?.toLowerCase().includes('rate limit')) {
        // Rate limit specific handling
        delay = rateLimitDelay * Math.pow(2, attempt);
        console.log(`⏳ Rate limited, waiting ${delay}ms...`);
      } else if (exponential) {
        // Exponential backoff
        delay = Math.min(baseDelay * Math.pow(2, attempt), maxDelay);
      }

      // Add jitter to prevent thundering herd
      delay += Math.random() * 1000;

      console.log(`⏳ Retrying in ${Math.round(delay)}ms...`);
      await sleep(delay);
    }
  }

  throw lastError || new Error(`${contextLabel} failed after ${maxRetries} attempts`);
}

/**
 * Sleep utility
 */
export function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Rate limiter class
 */
export class RateLimiter {
  constructor(options = {}) {
    this.minDelay = options.minDelay || 2000;
    this.maxCallsPerMinute = options.maxCallsPerMinute || 15;
    this.lastCallTime = 0;
    this.callHistory = [];
  }

  async waitIfNeeded() {
    const now = Date.now();

    // Remove calls older than 1 minute
    this.callHistory = this.callHistory.filter(time => now - time < 60000);

    // Check if we've hit the rate limit
    if (this.callHistory.length >= this.maxCallsPerMinute) {
      const oldestCall = this.callHistory[0];
      const waitTime = 60000 - (now - oldestCall) + 1000;
      
      if (waitTime > 0) {
        console.log(`⏳ Rate limit protection: waiting ${waitTime}ms...`);
        await sleep(waitTime);
      }
    }

    // Enforce minimum delay between calls
    const timeSinceLastCall = now - this.lastCallTime;
    if (timeSinceLastCall < this.minDelay) {
      const delay = this.minDelay - timeSinceLastCall;
      await sleep(delay);
    }

    this.lastCallTime = Date.now();
    this.callHistory.push(this.lastCallTime);
  }
}