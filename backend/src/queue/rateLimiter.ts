import { redisConnection } from '../config/redis';

export interface RateLimitCheckResult {
  allowed: boolean;
  currentCount: number;
  limit: number;
  delayMs?: number;
  resumeDate?: Date;
  shouldNotifySlack?: boolean;
}

export class RateLimiter {
  /**
   * Helper to format an hour window string: YYYY-MM-DD:HH (UTC or local)
   */
  public static getHourWindow(date: Date = new Date()): string {
    const y = date.getUTCFullYear();
    const m = String(date.getUTCMonth() + 1).padStart(2, '0');
    const d = String(date.getUTCDate()).padStart(2, '0');
    const h = String(date.getUTCHours()).padStart(2, '0');
    return `${y}-${m}-${d}:${h}`;
  }

  /**
   * Calculates milliseconds remaining until the top of the next UTC hour window
   */
  public static getMillisecondsUntilNextHour(date: Date = new Date()): { delayMs: number; resumeDate: Date } {
    const nextHour = new Date(date);
    nextHour.setUTCHours(nextHour.getUTCHours() + 1, 0, 0, 0);
    // Add a tiny 2-second buffer to ensure the window has flipped
    nextHour.setSeconds(nextHour.getSeconds() + 2);

    const delayMs = Math.max(1000, nextHour.getTime() - date.getTime());
    return { delayMs, resumeDate: nextHour };
  }

  /**
   * Atomically checks and reserves an email send slot for the given sender in Redis.
   * If limit is reached, returns allowed: false and the delay required to shift to the next window.
   */
  public static async checkAndReserveSlot(
    senderEmail: string,
    configuredLimit: number
  ): Promise<RateLimitCheckResult> {
    const now = new Date();
    const hourWindow = this.getHourWindow(now);
    const counterKey = `ratelimit:emails:${senderEmail}:${hourWindow}`;
    const notificationKey = `ratelimit:notified:${senderEmail}:${hourWindow}`;

    // Atomic Lua script: Checks if current count < limit. If so, increments and returns [1, newCount].
    // If limit exceeded, returns [0, currentCount].
    const luaScript = `
      local current = redis.call('GET', KEYS[1])
      local count = tonumber(current or '0')
      local limit = tonumber(ARGV[1])

      if count < limit then
        local newCount = redis.call('INCR', KEYS[1])
        if newCount == 1 then
          redis.call('EXPIRE', KEYS[1], 7200)
        end
        return { 1, newCount }
      else
        return { 0, count }
      end
    `;

    try {
      const result: any = await redisConnection.eval(luaScript, 1, counterKey, configuredLimit);
      const isAllowed = result[0] === 1;
      const count = result[1];

      if (isAllowed) {
        return {
          allowed: true,
          currentCount: count,
          limit: configuredLimit,
        };
      } else {
        const { delayMs, resumeDate } = this.getMillisecondsUntilNextHour(now);

        // Check if Slack should be notified (once per hour window per sender)
        const alreadyNotified = await redisConnection.set(notificationKey, '1', 'EX', 7200, 'NX');
        const shouldNotifySlack = alreadyNotified === 'OK';

        return {
          allowed: false,
          currentCount: count,
          limit: configuredLimit,
          delayMs,
          resumeDate,
          shouldNotifySlack,
        };
      }
    } catch (err) {
      console.error('❌ Redis RateLimiter error:', (err as Error).message);
      // Fail-open with safety or default to allowed
      return {
        allowed: true,
        currentCount: 1,
        limit: configuredLimit,
      };
    }
  }

  /**
   * Get current hour statistics for a sender
   */
  public static async getSenderHourlyStats(senderEmail: string): Promise<{ count: number; window: string }> {
    const hourWindow = this.getHourWindow();
    const counterKey = `ratelimit:emails:${senderEmail}:${hourWindow}`;
    const countStr = await redisConnection.get(counterKey);
    return {
      count: parseInt(countStr || '0', 10),
      window: hourWindow,
    };
  }
}
