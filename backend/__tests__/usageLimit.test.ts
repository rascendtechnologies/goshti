import { describe, expect, it, vi } from 'vitest';

import { handleGenerateStory } from '../handler';
import { checkUsage, MemoryUsageLimiter, SupabaseUsageLimiter, usageKindFor, validDeviceId } from '../usageLimit';

const env = { USAGE_STORY_DEVICE_DAY: '2' };
const day = new Date('2026-10-31T10:00:00Z');

describe('usageKindFor', () => {
  it('counts a new story, a voice chunk and a voice sample — not the steps of a story in progress', () => {
    expect(usageKindFor({ request: {} })).toBe('story');
    expect(usageKindFor({ continuation: 'x' })).toBeNull();
    expect(usageKindFor({ action: 'tts-render' })).toBe('voice');
    expect(usageKindFor({ action: 'personal-render' })).toBe('voice');
    expect(usageKindFor({ action: 'personal-plan' })).toBeNull();
    expect(usageKindFor({ action: 'tts-audition' })).toBe('audition');
    expect(usageKindFor({ action: 'tts-voices' })).toBeNull();
    expect(usageKindFor({ action: 'library-voice' })).toBeNull();
  });
});

describe('checkUsage', () => {
  it('stops a device after its daily allowance, but not another device', async () => {
    const limiter = new MemoryUsageLimiter();
    const a = { deviceId: 'a'.repeat(32), ip: '1.2.3.4' };
    expect((await checkUsage(limiter, env, a, 'story', day)).ok).toBe(true);
    expect((await checkUsage(limiter, env, a, 'story', day)).ok).toBe(true);
    const third = await checkUsage(limiter, env, a, 'story', day);
    expect(third).toEqual({ ok: false, limit: 'device/day' });
    expect((await checkUsage(limiter, env, { deviceId: 'b'.repeat(32), ip: '5.6.7.8' }, 'story', day)).ok).toBe(true);
  });

  it('starts again the next day', async () => {
    const limiter = new MemoryUsageLimiter();
    const a = { deviceId: 'a'.repeat(32) };
    await checkUsage(limiter, env, a, 'story', day);
    await checkUsage(limiter, env, a, 'story', day);
    expect((await checkUsage(limiter, env, a, 'story', day)).ok).toBe(false);
    expect((await checkUsage(limiter, env, a, 'story', new Date('2026-11-01T10:00:00Z'))).ok).toBe(true);
  });

  it('limits a network address that keeps changing its device id', async () => {
    const limiter = new MemoryUsageLimiter();
    const e = { USAGE_STORY_IP_DAY: '3' };
    let last;
    for (let i = 0; i < 4; i++) last = await checkUsage(limiter, e, { deviceId: `${i}`.repeat(32), ip: '9.9.9.9' }, 'story', day);
    expect(last).toEqual({ ok: false, limit: 'ip/day' });
  });

  it('has a global ceiling', async () => {
    const limiter = new MemoryUsageLimiter();
    const e = { USAGE_STORY_GLOBAL_DAY: '1' };
    expect((await checkUsage(limiter, e, {}, 'story', day)).ok).toBe(true);
    expect(await checkUsage(limiter, e, {}, 'story', day)).toEqual({ ok: false, limit: 'global/day' });
  });

  it('never stores the raw device id or address', async () => {
    const limiter = new MemoryUsageLimiter();
    await checkUsage(limiter, {}, { deviceId: 'secretdeviceid1234567890', ip: '203.0.113.7' }, 'story', day);
    const keys = [...limiter.counts.keys()].join(' ');
    expect(keys).not.toContain('secretdeviceid');
    expect(keys).not.toContain('203.0.113.7');
  });
});

describe('validDeviceId', () => {
  it('accepts the app id and rejects junk', () => {
    expect(validDeviceId('0123456789abcdef0123456789abcdef')).toBeDefined();
    expect(validDeviceId('short')).toBeUndefined();
    expect(validDeviceId({})).toBeUndefined();
    expect(validDeviceId("x'; drop table".padEnd(20, 'a'))).toBeUndefined();
  });
});

describe('SupabaseUsageLimiter', () => {
  const ok = (n: number) => vi.fn(async () => new Response(JSON.stringify(n), { status: 200 })) as unknown as typeof fetch;
  it('reads -1 as "limit reached"', async () => {
    expect(await new SupabaseUsageLimiter('https://x.supabase.co', 'k', ok(-1)).take('s', 'story', '2026-10-31', 5)).toBe(false);
    expect(await new SupabaseUsageLimiter('https://x.supabase.co', 'k', ok(3)).take('s', 'story', '2026-10-31', 5)).toBe(true);
  });
  it('allows the request if the counter store is down (and says so)', async () => {
    const log = vi.fn();
    const down = vi.fn(async () => {
      throw new Error('offline');
    }) as unknown as typeof fetch;
    expect(await new SupabaseUsageLimiter('https://x.supabase.co', 'k', down, log).take('s', 'story', 'p', 5)).toBe(true);
    expect(log).toHaveBeenCalled();
  });
});

describe('handler', () => {
  it('answers 429 RATE_LIMITED once the allowance is used, and the child-safe FAILED shape', async () => {
    const limiter = new MemoryUsageLimiter();
    const body = { request: { age: 5, category: 'ANIMALS', mode: 'RANDOM' }, deviceId: 'c'.repeat(32) };
    const e = { USAGE_STORY_DEVICE_DAY: '1' };
    const first = await handleGenerateStory(body, e, { limiter });
    expect(first.status).not.toBe(429);
    const second = await handleGenerateStory(body, e, { limiter });
    expect(second.status).toBe(429);
    expect(second.body).toMatchObject({ status: 'FAILED', reason: 'RATE_LIMITED' });
  });

  it('does not count the steps of a story already in progress', async () => {
    const limiter = new MemoryUsageLimiter();
    const res = await handleGenerateStory({ continuation: 'bad', deviceId: 'c'.repeat(32) }, { USAGE_STORY_DEVICE_DAY: '1' }, { limiter });
    expect(res.status).toBe(400);
    expect(limiter.counts.size).toBe(0);
  });
});
