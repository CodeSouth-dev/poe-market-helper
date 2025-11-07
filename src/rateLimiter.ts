/**
 * Rate Limiter to prevent spam and avoid getting blocked
 * Implements token bucket algorithm with exponential backoff
 */

interface RateLimitConfig {
  maxRequests: number;      // Maximum requests per window
  windowMs: number;          // Time window in milliseconds
  minDelay: number;          // Minimum delay between requests (ms)
  maxConcurrent: number;     // Maximum concurrent requests
  retryAttempts: number;     // Number of retry attempts
  retryDelayMs: number;      // Initial retry delay
}

interface QueuedRequest<T> {
  fn: () => Promise<T>;
  resolve: (value: T) => void;
  reject: (error: any) => void;
  domain: string;
  retries: number;
}

export class RateLimiter {
  private requests: Map<string, number[]> = new Map(); // domain -> timestamps
  private queue: QueuedRequest<any>[] = [];
  private processing = false;
  private activeRequests = 0;

  constructor(private config: RateLimitConfig) {}

  /**
   * Execute a request with rate limiting
   * @param domain - Domain to rate limit (e.g., 'poe.ninja', 'pathofexile.com')
   * @param fn - Async function to execute
   */
  async execute<T>(domain: string, fn: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      this.queue.push({ fn, resolve, reject, domain, retries: 0 });
      this.processQueue();
    });
  }

  private async processQueue(): Promise<void> {
    if (this.processing) return;
    this.processing = true;

    while (this.queue.length > 0) {
      // Check if we can process more requests
      if (this.activeRequests >= this.config.maxConcurrent) {
        await this.delay(100); // Wait a bit before checking again
        continue;
      }

      const request = this.queue.shift();
      if (!request) continue;

      // Check rate limit for this domain
      if (!this.canMakeRequest(request.domain)) {
        // Put it back in queue
        this.queue.unshift(request);
        await this.delay(this.config.minDelay);
        continue;
      }

      // Execute the request
      this.activeRequests++;
      this.recordRequest(request.domain);

      this.executeRequest(request);

      // Add minimum delay between requests
      await this.delay(this.config.minDelay);
    }

    this.processing = false;
  }

  private async executeRequest<T>(request: QueuedRequest<T>): Promise<void> {
    try {
      const result = await request.fn();
      request.resolve(result);
    } catch (error: any) {
      // Implement exponential backoff for retries
      if (request.retries < this.config.retryAttempts) {
        const delay = this.config.retryDelayMs * Math.pow(2, request.retries);
        console.log(`Rate limiter: Retry ${request.retries + 1}/${this.config.retryAttempts} for ${request.domain} after ${delay}ms`);

        await this.delay(delay);
        request.retries++;
        this.queue.unshift(request); // Put back at front of queue
      } else {
        console.error(`Rate limiter: Failed after ${this.config.retryAttempts} retries for ${request.domain}`);
        request.reject(error);
      }
    } finally {
      this.activeRequests--;
      this.processQueue(); // Continue processing
    }
  }

  private canMakeRequest(domain: string): boolean {
    const now = Date.now();
    const timestamps = this.requests.get(domain) || [];

    // Remove timestamps outside the window
    const validTimestamps = timestamps.filter(
      ts => now - ts < this.config.windowMs
    );

    // Check if we're under the limit
    return validTimestamps.length < this.config.maxRequests;
  }

  private recordRequest(domain: string): void {
    const now = Date.now();
    const timestamps = this.requests.get(domain) || [];

    // Remove old timestamps
    const validTimestamps = timestamps.filter(
      ts => now - ts < this.config.windowMs
    );

    validTimestamps.push(now);
    this.requests.set(domain, validTimestamps);
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get stats for monitoring
   */
  getStats(): { queueLength: number; activeRequests: number; domains: string[] } {
    return {
      queueLength: this.queue.length,
      activeRequests: this.activeRequests,
      domains: Array.from(this.requests.keys())
    };
  }

  /**
   * Clear all queued requests and reset
   */
  clear(): void {
    this.queue = [];
    this.requests.clear();
    this.activeRequests = 0;
  }
}

// Preset configurations for common sites
export const RateLimitPresets = {
  poeNinja: {
    maxRequests: 20,      // 20 requests per minute
    windowMs: 60000,      // 1 minute
    minDelay: 500,        // 500ms between requests
    maxConcurrent: 3,     // 3 concurrent requests
    retryAttempts: 3,
    retryDelayMs: 1000
  } as RateLimitConfig,

  poeTradeOfficial: {
    maxRequests: 10,      // Very conservative for official trade site
    windowMs: 60000,      // 1 minute
    minDelay: 2000,       // 2 seconds between requests
    maxConcurrent: 1,     // Only 1 concurrent request
    retryAttempts: 5,
    retryDelayMs: 2000
  } as RateLimitConfig,

  poeTrade: {
    maxRequests: 15,      // Moderate for poe.trade
    windowMs: 60000,      // 1 minute
    minDelay: 1000,       // 1 second between requests
    maxConcurrent: 2,     // 2 concurrent requests
    retryAttempts: 4,
    retryDelayMs: 1500
  } as RateLimitConfig
};

// Default rate limiter instance for poe.ninja
export const defaultRateLimiter = new RateLimiter(RateLimitPresets.poeNinja);
