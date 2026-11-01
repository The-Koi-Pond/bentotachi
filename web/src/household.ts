import { useEffect, useSyncExternalStore } from "react";
import { pb } from "./pb";
import { browserCountry } from "./country";
import { storesIn, type Store } from "./stores";
import { plannedMeals, type Meal } from "./meals";

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

// The household's settings record (household_settings, one per Bento): its
// country, which decides the grocery stores offered and the units hints
// use, what its tablespoon holds, and which meals its plan shows. null
// until loaded.
interface Settings {
  id: string;
  country: string;
  tablespoon: number;
  plan_meals: string[];
}
let settings: Settings | null = null;
let askingSettings = false;

function setSettings(next: { id: string; country: string; tablespoon?: number; plan_meals?: string[] } | null) {
  settings = next && {
    id: next.id,
    country: next.country,
    tablespoon: next.tablespoon ?? 0,
    // A server from before meals has no plan_meals: dinner only.
    plan_meals: next.plan_meals ?? [],
  };
  for (const listener of listeners) listener();
}

async function saveSettings(current: Settings | null, patch: Partial<Omit<Settings, "id">>) {
  const saved = current
    ? await pb.collection("household_settings").update(current.id, patch)
    : await pb.collection("household_settings").create(patch);
  setSettings({ id: saved.id, country: saved.country, tablespoon: saved.tablespoon, plan_meals: saved.plan_meals });
}

function loadSettings() {
  if (askingSettings || !pb.authStore.isValid) return;
  askingSettings = true;
  pb.collection("household_settings")
    .getList(1, 1, { sort: "created" })
    .then(async (page) => {
      const record = page.items[0];
      if (record?.country)
        return setSettings({ id: record.id, country: record.country, tablespoon: record.tablespoon, plan_meals: record.plan_meals });
      // A brand-new Bento: start from this browser's guess, and keep it.
      const country = browserCountry();
      const saved = record
        ? await pb.collection("household_settings").update(record.id, { country })
        : await pb.collection("household_settings").create({ country });
      setSettings({ id: saved.id, country: saved.country, tablespoon: saved.tablespoon, plan_meals: saved.plan_meals });
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
  return [current?.country ?? browserCountry(), (country) => saveSettings(current, { country })];
}

// What the household's tablespoon holds, in ml: 15 (most spoons, and until
// someone chooses) or 20 (the Australian standard).
export function useTablespoon(): [number, (ml: number) => Promise<void>] {
  const current = useSyncExternalStore(subscribe, () => settings);
  useEffect(() => {
    if (current === null) loadSettings();
  }, [current]);
  return [current?.tablespoon === 20 ? 20 : 15, (tablespoon) => saveSettings(current, { tablespoon })];
}

// The meals the plan shows, in plan order: just dinner until the household
// chooses more (or until loaded, or offline).
export function usePlanMeals(): [Meal[], (meals: Meal[]) => Promise<void>] {
  const current = useSyncExternalStore(subscribe, () => settings);
  useEffect(() => {
    if (current === null) loadSettings();
  }, [current]);
  return [plannedMeals(current?.plan_meals), (meals) => saveSettings(current, { plan_meals: meals })];
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
