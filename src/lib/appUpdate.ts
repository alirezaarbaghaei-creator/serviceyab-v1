/**
 * App self-update: makes a new release visible WITHOUT the user having to
 * "clear cache / clear data".
 *
 * - vite.config.ts bakes a unique BUILD_VERSION into every bundle
 *   (KATEB_BUILD_VERSION env, else git count+hash, else timestamp).
 * - On boot, if the stored version differs → fresh update:
 *     native: drop stale CacheStorage + unregister SWs once, reload once.
 *     web:    record version; the new SW (new CACHE_VERSION) rotates caches,
 *             and polling reloads when a deploy lands mid-session.
 */

declare const __KATEB_BUILD_VERSION__: string | undefined;

const VERSION_KEY = 'kateb_build_version';
const RELOADED_KEY = 'kateb_update_reloaded';

export function getBuildVersion(): string {
  try {
    if (typeof __KATEB_BUILD_VERSION__ !== 'undefined' && __KATEB_BUILD_VERSION__) {
      return __KATEB_BUILD_VERSION__;
    }
  } catch {
    /* define missing in some builds */
  }
  return 'dev';
}

function storedVersion(): string | null {
  try {
    return localStorage.getItem(VERSION_KEY);
  } catch {
    return null;
  }
}

function markVersion(v: string): void {
  try {
    localStorage.setItem(VERSION_KEY, v);
  } catch {
    /* storage blocked — nothing to persist */
  }
}

/**
 * True when this page load already did the one-shot update reload.
 * The flag lives in sessionStorage, so it survives the reload() but not a
 * fresh app start.
 */
function alreadyReloadedThisBoot(): boolean {
  try {
    return sessionStorage.getItem(RELOADED_KEY) === '1';
  } catch {
    return true; // can't track → never auto-reload (avoid loops)
  }
}

function flagReloaded(): void {
  try {
    sessionStorage.setItem(RELOADED_KEY, '1');
  } catch {
    /* ignore */
  }
}

async function clearNativeWebViewCache(): Promise<void> {
  // Capacitor serves the bundle from local assets; stale HTTP/WebView cache
  // can survive an APK update, so wipe it once per new version.
  try {
    if ('caches' in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
    }
  } catch {
    /* ignore */
  }
  try {
    if ('serviceWorker' in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map((r) => r.unregister()));
    }
  } catch {
    /* ignore */
  }
}

/** Call once at startup (before React renders). Returns true if reloading. */
export async function runUpdateCheck(isNative: boolean): Promise<boolean> {
  const current = getBuildVersion();
  if (current === 'dev') return false;
  const prev = storedVersion();
  if (prev === current) return false; // same bundle — nothing to do

  if (isNative) {
    await clearNativeWebViewCache();
    markVersion(current);
    if (!alreadyReloadedThisBoot()) {
      flagReloaded();
      window.location.reload();
      return true;
    }
    return false;
  }

  // Web: the new service worker (new CACHE_VERSION) handles cache rotation.
  markVersion(current);
  return false;
}

/**
 * Web-only: poll version.json; when the server build differs from the running
 * bundle, force the waiting SW to activate and reload once. No-op on native.
 */
export function startWebUpdatePolling(intervalMs = 60_000): void {
  if (typeof window === 'undefined') return;
  try {
    const cap = (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } })
      .Capacitor;
    if (cap?.isNativePlatform?.()) return;
    if (window.location.protocol !== 'http:' && window.location.protocol !== 'https:') return;
  } catch {
    return;
  }

  const running = getBuildVersion();
  if (running === 'dev') return;

  const check = async () => {
    try {
      const res = await fetch('/version.json', { cache: 'no-store' });
      if (!res.ok) return;
      const data = (await res.json()) as { version?: string };
      if (data?.version && data.version !== running && !alreadyReloadedThisBoot()) {
        try {
          if ('serviceWorker' in navigator) {
            const reg = await navigator.serviceWorker.getRegistration();
            await reg?.update().catch(() => {});
            if (reg?.waiting) reg.waiting.postMessage({ type: 'SKIP_WAITING' });
          }
        } catch {
          /* ignore */
        }
        markVersion(data.version);
        flagReloaded();
        window.location.reload();
      }
    } catch {
      /* offline — try next interval */
    }
  };

  window.setInterval(check, intervalMs);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') void check();
  });
}
