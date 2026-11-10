import { useEffect, useSyncExternalStore } from "react";
import { pb, users } from "./pb";
import { browserCountry } from "./country";
import { spelled } from "./spelling";
import { storesIn, type Store } from "./stores";
import { plannedMeals, type Meal } from "./meals";

// How many accounts this Bento has. With just one, Bento is in single-user
// mode: the parts about other people (who added what, "for everyone", the
// Household link's name on Profile) are hidden, and come back as soon as
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
  users()
    .getList(1, 1, { fields: "id" })
    .then((page) => set(page.totalItems))
    .catch(() => {})
    .finally(() => {
      asking = false;
    });
}

// The household's settings record (household_settings, one per Bento): its
// country, which decides the grocery stores offered and the units hints
// use, what its tablespoon holds, which meals its plan shows, and its
// pantry places. null until loaded.
interface Settings {
  id: string;
  country: string;
  tablespoon: number;
  plan_meals: string[];
  pantry_places: string[];
}
let settings: Settings | null = null;
let askingSettings = false;

type SavedSettings = { id: string; country: string; tablespoon?: number; plan_meals?: string[]; pantry_places?: unknown };

function settingsFrom(saved: SavedSettings): Settings {
  return {
    id: saved.id,
    country: saved.country,
    tablespoon: saved.tablespoon ?? 0,
    // A server from before meals has no plan_meals: dinner only.
    plan_meals: saved.plan_meals ?? [],
    // A server from before it: none listed, so the places items are in.
    pantry_places: Array.isArray(saved.pantry_places) ? saved.pantry_places.filter((p): p is string => typeof p === "string") : [],
  };
}

function setSettings(next: SavedSettings | null) {
  settings = next && settingsFrom(next);
  for (const listener of listeners) listener();
}

// The household's one settings record as the server has it now, or null.
async function freshSettings(): Promise<Settings | null> {
  const page = await pb.collection("household_settings").getList(1, 1, { sort: "created" });
  return page.items[0] ? settingsFrom(page.items[0] as unknown as SavedSettings) : null;
}

// Not loaded yet (or loading failed, then the connection came back): the
// record is looked for first, as a second one would never be read.
async function saveSettings(current: Settings | null, patch: Partial<Omit<Settings, "id">>) {
  const target = current ?? (await freshSettings());
  const saved = target
    ? await pb.collection("household_settings").update(target.id, patch)
    : await pb.collection("household_settings").create({ country: browserCountry(), ...patch });
  setSettings(saved as unknown as SavedSettings);
}

function loadSettings() {
  if (askingSettings || !pb.authStore.isValid) return;
  askingSettings = true;
  pb.collection("household_settings")
    .getList(1, 1, { sort: "created" })
    .then(async (page) => {
      const record = page.items[0];
      if (record?.country) return setSettings(record as unknown as SavedSettings);
      // A brand-new Bento: start from this browser's guess, and keep it.
      const country = browserCountry();
      const saved = record
        ? await pb.collection("household_settings").update(record.id, { country })
        : await pb.collection("household_settings").create({ country });
      setSettings(saved as unknown as SavedSettings);
    })
    .catch(() => {})
    .finally(() => {
      askingSettings = false;
    });
}

// A different login (or server) may be a different household. The login
// also "changes" when it's renewed or you save your own profile: that's the
// same person on the same server, so what's loaded stays, or pages would
// flash back to the defaults and a settings save just then would make a
// second settings record. (Logging out counts as a change: no one.)
const whoseHousehold = () => `${pb.baseURL} ${pb.authStore.record?.id ?? ""}`;
let household = whoseHousehold();
pb.authStore.onChange(() => {
  const now = whoseHousehold();
  if (now === household) return;
  household = now;
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

// spell("My favourites"): text in the household's spelling (spelling.ts).
export function useSpell(): (text: string) => string {
  const [country] = useCountry();
  return (text) => spelled(text, country);
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

// The pantry places the household keeps, in its order, even while empty
// ("Edit places", PlacePicker.tsx); [] until someone edits them. A change
// is made to the list as the server has it at that moment: this copy is
// loaded once, and a phone open since the morning would otherwise save over
// another phone's new (empty) place or order.
export function usePantryPlaces(): [string[], (change: (places: string[]) => string[]) => Promise<void>] {
  const current = useSyncExternalStore(subscribe, () => settings);
  useEffect(() => {
    if (current === null) loadSettings();
  }, [current]);
  return [current?.pantry_places ?? [], (change) => changeInTurn("pantry_places", change)];
}

// A list setting changed by tapping (places, meals on the plan): shown at
// once (a dragged place stays where it was dropped), put back if the server
// says no, and made to the list as the server has it at that moment. The
// saves go one after another: two quick taps both reading the list before
// either saved would keep only the second.
let settingSaves: Promise<void> = Promise.resolve();
async function changeInTurn<K extends "pantry_places" | "plan_meals">(field: K, change: (list: string[]) => string[]) {
  // What's on screen now (a change a moment ago included), not a render's
  // copy.
  const shown = settings;
  if (shown) setSettings({ ...shown, [field]: change(shown[field]) });
  const saving = settingSaves.then(async () => {
    const fresh = await freshSettings();
    await saveSettings(fresh, { [field]: change(fresh?.[field] ?? []) } as Partial<Omit<Settings, "id">>);
  });
  settingSaves = saving.catch(() => {
    // Its own caller shows the error; the next change still goes ahead.
  });
  try {
    await saving;
  } catch (err) {
    setSettings(shown);
    throw err;
  }
}

// The meals the plan shows, in plan order: just dinner until the household
// chooses more (or until loaded, or offline). `change` turns the meals as
// they are into the ones wanted.
export function usePlanMeals(): [Meal[], (change: (meals: Meal[]) => Meal[]) => Promise<void>] {
  const current = useSyncExternalStore(subscribe, () => settings);
  useEffect(() => {
    if (current === null) loadSettings();
  }, [current]);
  return [plannedMeals(current?.plan_meals), (change) => changeInTurn("plan_meals", (saved) => change(plannedMeals(saved)))];
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
