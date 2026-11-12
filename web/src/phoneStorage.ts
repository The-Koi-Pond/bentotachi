// Small things remembered on this device (localStorage), read and written
// one safe way. Storage can be full or blocked (private browsing, some
// phones), and then a read gives null and a write is skipped, so each caller
// falls back to its own default. { thisVisit: true } keeps it only until
// the app or tab closes (sessionStorage).

interface Where {
  thisVisit?: boolean;
}

const storage = ({ thisVisit = false }: Where) => (thisVisit ? sessionStorage : localStorage);

export function remembered(key: string, where: Where = {}): string | null {
  try {
    return storage(where).getItem(key);
  } catch {
    // Storage blocked: the caller's default holds.
    return null;
  }
}

// What was remembered as JSON, or null if nothing (or unreadable). The
// caller checks its shape: an older app version may have saved another.
export function rememberedJson(key: string, where: Where = {}): unknown {
  const saved = remembered(key, where);
  if (saved === null) return null;
  try {
    return JSON.parse(saved);
  } catch {
    // Not JSON (cut off, or from something else): as if nothing was saved.
    return null;
  }
}

// Forgets everything remembered under keys starting with `prefix`, for good
// and for this visit: "Delete everything" leaves nothing of Bentotachi's on
// the phone (the saved server address, timers, settings).
export function forgetAll(prefix: string) {
  for (const thisVisit of [false, true]) {
    try {
      const kept = storage({ thisVisit });
      const keys = Array.from({ length: kept.length }, (_, i) => kept.key(i)).filter((key): key is string => !!key?.startsWith(prefix));
      for (const key of keys) kept.removeItem(key);
    } catch {
      // Storage blocked: there's nothing in it to forget.
    }
  }
}

// null forgets it.
export function remember(key: string, value: string | null, where: Where = {}) {
  try {
    if (value === null) storage(where).removeItem(key);
    else storage(where).setItem(key, value);
  } catch {
    // Storage full or blocked: not remembered, so the default holds next time.
  }
}
