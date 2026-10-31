import { useEffect, useSyncExternalStore } from "react";
import { pb } from "./pb";
import { browserCountry } from "./country";
import { storesIn, type Store } from "./stores";

// How many accounts this Bento has. With just one, Bento is in single-user
// mode: the parts about other people (who added what, "for everyone", the
// Household page's name in the menu) are hidden, and come back as soon as
// someone is added. Unknown (still loading, or offline) counts as shared,
// which shows everything as before.

let accounts: number | null = null;
let asking = false;
const listeners = new Set<() => void>();

function set(next: number | null) {
  accounts = next;
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

// Asks the server again, e.g. after adding someone on the Household page.
export function refreshHousehold() {
  if (asking || !pb.authStore.isValid) return;
  asking = true;
  pb.collection("users")
    .getList(1, 1, { fields: "id" })
    .then((page) => set(page.totalItems))
    .catch(() => {})
    .finally(() => {
      asking = false;
    });
}

// The household's settings record (household_settings, one per Bento):
// for now its country, which decides the grocery stores offered. null
// until loaded.
let settings: { id: string; country: string } | null = null;
let askingSettings = false;

function setSettings(next: { id: string; country: string } | null) {
  settings = next;
  for (const listener of listeners) listener();
}

function loadSettings() {
  if (askingSettings || !pb.authStore.isValid) return;
  askingSettings = true;
  pb.collection("household_settings")
    .getList(1, 1, { sort: "created" })
    .then(async (page) => {
      const record = page.items[0];
      if (record?.country) return setSettings({ id: record.id, country: record.country });
      // A brand-new Bento: start from this browser's guess, and keep it.
      const country = browserCountry();
      const saved = record
        ? await pb.collection("household_settings").update(record.id, { country })
        : await pb.collection("household_settings").create({ country });
      setSettings({ id: saved.id, country: saved.country });
    })
    .catch(() => {})
    .finally(() => {
      askingSettings = false;
    });
}

// A different login (or server) may be a different household.
pb.authStore.onChange(() => {
  set(null);
  setSettings(null);
});

// The household's country ("AU", "US" or "OTHER"). Until it's loaded (or
// when offline), this browser's guess.
export function useCountry(): [string, (country: string) => Promise<void>] {
  const current = useSyncExternalStore(subscribe, () => settings);
  useEffect(() => {
    if (current === null) loadSettings();
  }, [current]);
  async function change(country: string) {
    const saved = current
      ? await pb.collection("household_settings").update(current.id, { country })
      : await pb.collection("household_settings").create({ country });
    setSettings({ id: saved.id, country: saved.country });
  }
  return [current?.country ?? browserCountry(), change];
}

// The grocery stores to offer, for the household's country.
export function useStores(): Store[] {
  return storesIn(useCountry()[0]);
}

export function useSingleUser(): boolean {
  const count = useSyncExternalStore(subscribe, () => accounts);
  useEffect(() => {
    if (count === null) refreshHousehold();
  }, [count]);
  return count === 1;
}

// " for everyone" in messages, or nothing when it's just you.
export function forEveryone(singleUser: boolean): string {
  return singleUser ? "" : " for everyone";
}
