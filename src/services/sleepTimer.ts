/**
 * Bedtime sleep timer: after the chosen minutes it asks the player to stop, so a child can fall
 * asleep to a story without it carrying on all night. Pure logic — the clock and timers are
 * injectable so it can be tested without waiting.
 */
export const SLEEP_TIMER_OPTIONS_MINUTES = [10, 20, 30] as const;

export interface SleepTimerDeps {
  now?: () => number;
  setTimer?: (fn: () => void, ms: number) => unknown;
  clearTimer?: (handle: unknown) => void;
}

export type SleepTimerListener = (secondsLeft: number | null) => void;

export class SleepTimer {
  private endsAt: number | null = null;
  private handle: unknown = null;
  private tick: unknown = null;
  private readonly listeners = new Set<SleepTimerListener>();
  private readonly now: () => number;
  private readonly setTimer: (fn: () => void, ms: number) => unknown;
  private readonly clearTimer: (handle: unknown) => void;

  constructor(
    private readonly onElapsed: () => void,
    deps: SleepTimerDeps = {},
  ) {
    this.now = deps.now ?? Date.now;
    this.setTimer = deps.setTimer ?? ((fn, ms) => setTimeout(fn, ms));
    this.clearTimer = deps.clearTimer ?? ((h) => clearTimeout(h as ReturnType<typeof setTimeout>));
  }

  /** Start (or restart) the timer. */
  start(minutes: number): void {
    this.stopTimers();
    this.endsAt = this.now() + minutes * 60_000;
    this.handle = this.setTimer(() => this.finish(), minutes * 60_000);
    this.tick = this.setTimer(() => this.heartbeat(), 1000);
    this.emit();
  }

  cancel(): void {
    this.stopTimers();
    this.endsAt = null;
    this.emit();
  }

  secondsLeft(): number | null {
    return this.endsAt === null ? null : Math.max(0, Math.ceil((this.endsAt - this.now()) / 1000));
  }

  subscribe(listener: SleepTimerListener): () => void {
    this.listeners.add(listener);
    listener(this.secondsLeft());
    return () => void this.listeners.delete(listener);
  }

  private heartbeat(): void {
    if (this.endsAt === null) return;
    this.emit();
    this.tick = this.setTimer(() => this.heartbeat(), 1000);
  }

  private finish(): void {
    this.stopTimers();
    this.endsAt = null;
    this.emit();
    this.onElapsed();
  }

  private stopTimers(): void {
    if (this.handle !== null) this.clearTimer(this.handle);
    if (this.tick !== null) this.clearTimer(this.tick);
    this.handle = null;
    this.tick = null;
  }

  private emit(): void {
    const left = this.secondsLeft();
    this.listeners.forEach((l) => l(left));
  }
}
