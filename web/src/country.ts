// The household's country decides which grocery stores Bento offers (see
// stores.ts). It's one setting for the whole household, on the Household
// page; a new Bento starts from a guess made in the browser.

export const COUNTRIES = [
  { code: "AU", name: "Australia" },
  { code: "US", name: "United States" },
  { code: "NL", name: "Netherlands" },
] as const;

// Anywhere Bento doesn't know stores for yet: no store search or logos.
export const OTHER_COUNTRY = "OTHER";

const US_TIME_ZONES = /^(America\/(New_York|Chicago|Denver|Los_Angeles|Phoenix|Anchorage|Detroit|Boise|Indiana\/.+|Kentucky\/.+)|Pacific\/Honolulu)$/;

// A guess from the browser: its time zone (many Australians' and Dutch
// people's browsers say "en-US"), else the region in its language ("en-US"
// -> US), else Other.
export function guessCountry(languages: readonly string[], timeZone: string): string {
  if (timeZone.startsWith("Australia/")) return "AU";
  if (timeZone === "Europe/Amsterdam") return "NL";
  for (const tag of languages) {
    const region = tag.split(/[-_]/)[1]?.toUpperCase();
    if (region) return COUNTRIES.some((country) => country.code === region) ? region : OTHER_COUNTRY;
  }
  return US_TIME_ZONES.test(timeZone) ? "US" : OTHER_COUNTRY;
}

export function browserCountry(): string {
  try {
    return guessCountry(navigator.languages ?? [navigator.language], Intl.DateTimeFormat().resolvedOptions().timeZone ?? "");
  } catch {
    return OTHER_COUNTRY;
  }
}
