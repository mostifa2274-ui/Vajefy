/**
 * The Worker's optional bindings and settings. Each feature that uses one is
 * off until it is configured (docs/OPERATIONS.md); the app works without any.
 */

interface R2ObjectBodyLike {
  body: ReadableStream;
  httpEtag: string;
  httpMetadata?: { contentType?: string };
  size: number;
}

interface R2BucketLike {
  get(key: string): Promise<R2ObjectBodyLike | null>;
}

interface D1ResultLike<T> {
  results: T[];
}

interface D1PreparedStatementLike {
  bind(...values: unknown[]): D1PreparedStatementLike;
  first<T = Record<string, unknown>>(): Promise<T | null>;
  all<T = Record<string, unknown>>(): Promise<D1ResultLike<T>>;
  run(): Promise<unknown>;
}

interface D1DatabaseLike {
  prepare(query: string): D1PreparedStatementLike;
  batch(statements: D1PreparedStatementLike[]): Promise<unknown[]>;
}

interface RateLimitLike {
  limit(options: { key: string }): Promise<{ success: boolean }>;
}

interface WorkersAiLike {
  run(
    model: string,
    input: {
      messages: { role: "system" | "user" | "assistant"; content: string }[];
      temperature?: number;
      max_tokens?: number;
      response_format?: {
        type: "json_object" | "json_schema";
        json_schema?: Record<string, unknown>;
      };
    },
  ): Promise<unknown>;
}

interface WorkerEnv {
  /** Workers AI binding used by the OIDC-protected semantic judge gateway. */
  AI?: WorkersAiLike;
  /** Pronunciation clips moved out of the static assets into R2. */
  AUDIO?: R2BucketLike;
  /** "on" to log client error reports. */
  TELEMETRY?: string;
  /** The AI coach: an Anthropic API key (a secret), and "on" to enable it after its evaluation passes. */
  ANTHROPIC_API_KEY?: string;
  COACH?: string;
  COACH_MODEL?: string;
  /** A Workers rate limit binding; the coach stays off without one. */
  COACH_LIMITER?: RateLimitLike;
  /** Optional sync: a D1 database, and "on" to enable it. */
  SYNC_DB?: D1DatabaseLike;
  SYNC?: string;
  /** An optional rate limit on sync requests per address. */
  SYNC_LIMITER?: RateLimitLike;
}

declare module "cloudflare:workers" {
  export const env: WorkerEnv;
}
