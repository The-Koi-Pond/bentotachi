// Temperatures in recipes, converted for the household as a soft hint:
// "preheat to 425°F *(220°C)*" in Australia (and anywhere else that uses
// Celsius), "bake at 200°C *(400°F)*" in the US. Oven temperatures are
// rounded like oven dials (to 10°C, or 25°F); cooking temperatures under
// 100°C, like "cook chicken to 165°F", stay exact (74°C). A line that already
// gives both gets no hint.

// A number, maybe a range ("350-375"), then the scale. A plain "C" or "F"
// with no degree sign only counts for oven-sized numbers, as some recipes
// write "1 C" for a cup.
const AMOUNT = String.raw`(?<![\d.])(\d{2,3})(?:\s*(?:-|–|to)\s*(\d{2,3}))?`;
const DEGREES = String.raw`\s*(?:°|º|˚|\s?degrees?|\s?deg\.?)\s*`;
const FAHRENHEIT = new RegExp(String.raw`${AMOUNT}(?:${DEGREES}(?:F|fahrenheit)|\s*℉|\s*(F)(?=$|[^a-z]))(?![a-z])`, "gi");
const CELSIUS = new RegExp(String.raw`${AMOUNT}(?:${DEGREES}(?:C|celsius|centigrade)|\s*℃|\s*(C)(?=$|[^a-z]))(?![a-z])`, "gi");

// A plain letter (group 3) needs an oven-sized number.
const isTemperature = (match: RegExpMatchArray, low: number, high: number) =>
  !match[3] || (Number(match[1]) >= low && Number(match[1]) <= high);

const round = (n: number, step: number) => Math.round(n / step) * step;
const toCelsius = (f: number) => {
  const c = ((f - 32) * 5) / 9;
  return c >= 100 ? round(c, 10) : Math.round(c);
};
const toFahrenheit = (c: number) => {
  const f = (c * 9) / 5 + 32;
  return f >= 212 ? round(f, 25) : Math.round(f);
};

export function withTemperatureHint(line: string, country: string): string {
  const toC = country !== "US";
  const found = (pattern: RegExp, low: number, high: number) =>
    [...line.matchAll(pattern)].filter((match) => isTemperature(match, low, high));
  const fahrenheit = found(FAHRENHEIT, 200, 550);
  const celsius = found(CELSIUS, 100, 300);
  // Already in the household's scale: nothing to add.
  if (toC ? celsius.length : fahrenheit.length) return line;
  let result = "";
  let at = 0;
  for (const match of toC ? fahrenheit : celsius) {
    const convert = toC ? toCelsius : toFahrenheit;
    const scale = toC ? "°C" : "°F";
    const low = convert(Number(match[1]));
    const shown = match[2] ? `${low}–${convert(Number(match[2]))}${scale}` : `${low}${scale}`;
    const end = match.index + match[0].length;
    result += `${line.slice(at, end)} *(${shown})*`;
    at = end;
  }
  return at ? result + line.slice(at) : line;
}
