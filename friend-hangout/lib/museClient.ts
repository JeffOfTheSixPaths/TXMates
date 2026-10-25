import type { DatabaseSync } from 'node:sqlite';
import { activityPolicy } from './activityPolicy';
import { museTimeoutMs } from './serviceTimeouts';
import {
  museCallAllowed,
  readMuseContentCache,
  recordMuseCall,
  tokenUsageFromApi,
  writeMuseContentCache,
} from './museUsage';

export type MuseCompleteResult = {
  content: string | null;
  cached: boolean;
  limited: boolean;
  truncated: boolean;
};

type Message = { role: 'system' | 'user'; content: string };

export async function museComplete(
  db: DatabaseSync,
  input: {
    purpose: string;
    cacheKey: string;
    messages: Message[];
    temperature?: number;
    maxTokens?: number;
    reasoningEffort?: 'minimal' | 'low' | 'medium' | 'high' | 'xhigh';
    cacheContent?: (content: string) => boolean;
    now?: Date;
    ttlMs?: number;
    fetchImpl?: typeof fetch;
  }
): Promise<MuseCompleteResult> {
  const now = input.now ?? new Date();
  const cached = readMuseContentCache(db, input.cacheKey, now);
  if (cached) return { content: cached, cached: true, limited: false, truncated: false };

  const key = process.env.MUSE_API_KEY?.trim();
  if (!key) return { content: null, cached: false, limited: false, truncated: false };
  if (!museCallAllowed(db, now)) return { content: null, cached: false, limited: true, truncated: false };

  const base = (process.env.MUSE_BASE_URL || 'https://api.meta.ai/v1').replace(/\/$/, '');
  const model = process.env.MUSE_MODEL || 'muse-spark-1.3';
  const fetchImpl = input.fetchImpl ?? fetch;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), museTimeoutMs());
  try {
    const response = await fetchImpl(`${base}/chat/completions`, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        model,
        temperature: input.temperature ?? 0.2,
        max_completion_tokens: input.maxTokens ?? 1200,
        ...(input.reasoningEffort ? { reasoning_effort: input.reasoningEffort } : {}),
        messages: input.messages,
      }),
    });
    const payload = (await response.json().catch(() => null)) as {
      choices?: Array<{ finish_reason?: string; message?: { content?: string } }>;
      usage?: unknown;
    } | null;
    const usage = tokenUsageFromApi(payload);
    if (!response.ok) return { content: null, cached: false, limited: false, truncated: false };
    if (!payload) {
      recordMuseCall(db, { purpose: input.purpose, cacheKey: input.cacheKey, model, status: 'error', usage, now });
      return { content: null, cached: false, limited: false, truncated: false };
    }
    const choice = payload.choices?.[0];
    const content = choice?.message?.content?.trim() || '';
    const truncated = choice?.finish_reason === 'length';
    const cacheable = Boolean(content) && !truncated && (input.cacheContent ? input.cacheContent(content) : true);
    recordMuseCall(db, {
      purpose: input.purpose,
      cacheKey: input.cacheKey,
      model,
      status: cacheable ? 'ok' : 'error',
      usage,
      now,
    });
    if (!cacheable) return { content: content || null, cached: false, limited: false, truncated };
    writeMuseContentCache(db, {
      cacheKey: input.cacheKey,
      purpose: input.purpose,
      content,
      now,
      ttlMs: input.ttlMs ?? activityPolicy().museCacheTtlMs,
    });
    return { content, cached: false, limited: false, truncated: false };
  } catch {
    recordMuseCall(db, { purpose: input.purpose, cacheKey: input.cacheKey, model, status: 'error', now });
    return { content: null, cached: false, limited: false, truncated: false };
  } finally {
    clearTimeout(timeout);
  }
}
