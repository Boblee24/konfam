"use client";
/** Box-mode device helpers: screen wake lock + fullscreen. Both are best-effort. */

type WakeLockSentinelLike = { release(): Promise<void>; released?: boolean };

export function keepAwake(): () => void {
  let lock: WakeLockSentinelLike | null = null;
  let stopped = false;
  const nav = navigator as Navigator & { wakeLock?: { request(t: "screen"): Promise<WakeLockSentinelLike> } };
  const acquire = async () => {
    if (stopped || !nav.wakeLock || document.visibilityState !== "visible") return;
    try {
      lock = await nav.wakeLock.request("screen");
    } catch {
      /* battery saver or unsupported */
    }
  };
  // The lock is dropped whenever the tab is hidden; take it again on return.
  const onVis = () => {
    if (document.visibilityState === "visible" && (!lock || lock.released)) void acquire();
  };
  document.addEventListener("visibilitychange", onVis);
  void acquire();
  return () => {
    stopped = true;
    document.removeEventListener("visibilitychange", onVis);
    void lock?.release().catch(() => {});
  };
}

export function enterFullscreen(): void {
  const el = document.documentElement;
  if (!document.fullscreenElement && el.requestFullscreen) el.requestFullscreen().catch(() => {});
}
