type TimeoutHandle = number;

export const REALTIME_TURN_RESUME_GRACE_MS = 1200;

interface RealtimeTurnAccumulatorOptions {
  graceMs: number;
  onFinalized: (text: string) => void | Promise<void>;
  setTimeout?: (fn: () => void, delayMs: number) => TimeoutHandle;
  clearTimeout?: (handle: TimeoutHandle) => void;
}

function normalizeFragment(text: string): string {
  return text.trim().replace(/\s+/g, " ");
}

export class RealtimeTurnAccumulator {
  private readonly graceMs: number;
  private readonly onFinalized: (text: string) => void | Promise<void>;
  private readonly scheduleTimeout: (fn: () => void, delayMs: number) => TimeoutHandle;
  private readonly cancelTimeout: (handle: TimeoutHandle) => void;

  private speechActive = false;
  private pendingFragments: string[] = [];
  private timeoutHandle: TimeoutHandle | null = null;

  constructor(options: RealtimeTurnAccumulatorOptions) {
    this.graceMs = options.graceMs;
    this.onFinalized = options.onFinalized;
    this.scheduleTimeout = options.setTimeout ?? ((fn, delayMs) => window.setTimeout(fn, delayMs));
    this.cancelTimeout = options.clearTimeout ?? ((handle) => window.clearTimeout(handle));
  }

  handleSpeechStarted() {
    this.speechActive = true;
    this.clearScheduledFinalize();
  }

  handleSpeechStopped() {
    this.speechActive = false;
    this.scheduleFinalize();
  }

  pushTranscriptFragment(text: string) {
    const clean = normalizeFragment(text);
    if (!clean) return;

    if (this.pendingFragments[this.pendingFragments.length - 1] !== clean) {
      this.pendingFragments.push(clean);
    }

    if (!this.speechActive) {
      this.scheduleFinalize();
    }
  }

  reset() {
    this.clearScheduledFinalize();
    this.speechActive = false;
    this.pendingFragments = [];
  }

  flushNow() {
    this.clearScheduledFinalize();
    this.finalizeIfReady();
  }

  private scheduleFinalize() {
    if (this.speechActive || this.pendingFragments.length === 0) return;

    this.clearScheduledFinalize();
    this.timeoutHandle = this.scheduleTimeout(() => {
      this.timeoutHandle = null;
      this.finalizeIfReady();
    }, this.graceMs);
  }

  private clearScheduledFinalize() {
    if (this.timeoutHandle === null) return;
    this.cancelTimeout(this.timeoutHandle);
    this.timeoutHandle = null;
  }

  private finalizeIfReady() {
    if (this.speechActive || this.pendingFragments.length === 0) return;
    const text = this.pendingFragments.join(" ").trim();
    this.pendingFragments = [];
    if (!text) return;
    void this.onFinalized(text);
  }
}
