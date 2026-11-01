import { describe, expect, it } from 'vitest';

import { SleepTimer } from '../sleepTimer';

function fakeClock() {
  let now = 0;
  let nextId = 1;
  const timers = new Map<number, { at: number; fn: () => void }>();
  return {
    deps: {
      now: () => now,
      setTimer: (fn: () => void, ms: number) => {
        const id = nextId++;
        timers.set(id, { at: now + ms, fn });
        return id;
      },
      clearTimer: (h: unknown) => void timers.delete(h as number),
    },
    advance(ms: number) {
      const target = now + ms;
      for (;;) {
        const due = [...timers.entries()].filter(([, t]) => t.at <= target).sort((a, b) => a[1].at - b[1].at)[0];
        if (!due) break;
        timers.delete(due[0]);
        now = due[1].at;
        due[1].fn();
      }
      now = target;
    },
  };
}

describe('SleepTimer', () => {
  it('stops the story once, after the chosen minutes', () => {
    const clock = fakeClock();
    let stopped = 0;
    const t = new SleepTimer(() => stopped++, clock.deps);
    t.start(10);
    clock.advance(9 * 60_000);
    expect(stopped).toBe(0);
    expect(t.secondsLeft()).toBe(60);
    clock.advance(60_000);
    expect(stopped).toBe(1);
    expect(t.secondsLeft()).toBeNull();
    clock.advance(60 * 60_000);
    expect(stopped).toBe(1);
  });

  it('can be cancelled', () => {
    const clock = fakeClock();
    let stopped = 0;
    const t = new SleepTimer(() => stopped++, clock.deps);
    t.start(20);
    t.cancel();
    clock.advance(30 * 60_000);
    expect(stopped).toBe(0);
  });

  it('restarting replaces the earlier timer and tells listeners the time left', () => {
    const clock = fakeClock();
    let stopped = 0;
    const seen: (number | null)[] = [];
    const t = new SleepTimer(() => stopped++, clock.deps);
    t.subscribe((s) => seen.push(s));
    t.start(10);
    clock.advance(5 * 60_000);
    t.start(30);
    clock.advance(10 * 60_000);
    expect(stopped).toBe(0);
    clock.advance(20 * 60_000);
    expect(stopped).toBe(1);
    expect(seen[0]).toBeNull();
    expect(seen).toContain(600);
    expect(seen.at(-1)).toBeNull();
  });
});
