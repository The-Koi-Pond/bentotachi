// Words people see that the United States spells differently. Bentotachi's
// text is written the Australian way; a US household (Household > Country)
// sees the American word instead. Only the words on screen change: code
// names and stored values (`favorite`, `color`) stay as they are. Text
// with one of these words goes through useSpell()'s spell() (household.ts);
// web/test/spelling.test.ts fails on one that doesn't.

export const US_SPELLING: Record<string, string> = {
  favourite: "favorite",
  favourites: "favorites",
  colour: "color",
  colours: "colors",
  grey: "gray",
  greyed: "grayed",
};

const WORDS = new RegExp(`\\b(${Object.keys(US_SPELLING).join("|")})\\b`, "gi");

// The text in the household's spelling: American for the US, as written
// (Australian, which suits the UK, New Zealand and others) everywhere else.
export function spelled(text: string, country: string): string {
  if (country !== "US") return text;
  return text.replace(WORDS, (word) => {
    const us = US_SPELLING[word.toLowerCase()];
    return word[0] === word[0].toUpperCase() ? us[0].toUpperCase() + us.slice(1) : us;
  });
}
