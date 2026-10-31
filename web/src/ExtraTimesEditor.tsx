import { extraTimes, formatMinutes, type ExtraTime } from "./format";

// The rows of "+ Add a time" on a recipe's editors (Edit page and the ✎ on
// its page): a name like "Cool" and its minutes. Kept as typed until saved.
export interface ExtraTimeRow {
  label: string;
  minutes: string;
}

// Names offered while typing; any other name works too.
const COMMON = ["Marinate", "Rest", "Cool", "Chill", "Release", "Rise", "Soak", "Freeze", "Pressure build"];

export function toRows(recipe: { extra_times?: unknown }): ExtraTimeRow[] {
  return extraTimes(recipe).map((time) => ({ label: time.label, minutes: String(time.minutes) }));
}

// What's saved: rows with a name and some minutes (others are dropped).
export function fromRows(rows: ExtraTimeRow[]): ExtraTime[] {
  return rows
    .map((row) => ({ label: row.label.trim(), minutes: Math.round(Number(row.minutes)) || 0 }))
    .filter((time) => time.label && time.minutes > 0);
}

export default function ExtraTimesEditor({ rows, onChange }: { rows: ExtraTimeRow[]; onChange: (rows: ExtraTimeRow[]) => void }) {
  const change = (index: number, part: Partial<ExtraTimeRow>) =>
    onChange(rows.map((row, i) => (i === index ? { ...row, ...part } : row)));
  return (
    <div className="extra-times">
      {rows.map((row, index) => {
        const minutes = Number(row.minutes);
        return (
          <div className="extra-time" key={index}>
            <input
              aria-label={`Name of extra time ${index + 1}`}
              list="extra-time-names"
              placeholder="Cool, Rest…"
              value={row.label}
              onChange={(e) => change(index, { label: e.target.value })}
              autoFocus={!row.label && !row.minutes}
            />
            <input
              aria-label={`Minutes for ${row.label || `extra time ${index + 1}`}`}
              type="number"
              min={0}
              inputMode="numeric"
              placeholder="min"
              value={row.minutes}
              onChange={(e) => change(index, { minutes: e.target.value })}
            />
            {/* "420" is hard to read at a glance; "= 7 h" isn't. */}
            <span className="muted extra-time-hint">{minutes >= 60 && `= ${formatMinutes(Math.round(minutes))}`}</span>
            <button
              type="button"
              className="icon-button"
              aria-label={`Remove ${row.label || "this time"}`}
              onClick={() => onChange(rows.filter((_, i) => i !== index))}
            >
              ✕
            </button>
          </div>
        );
      })}
      <button type="button" className="link-button" onClick={() => onChange([...rows, { label: "", minutes: "" }])}>
        + Add a time <span className="optional">(like Cool or Release)</span>
      </button>
      <datalist id="extra-time-names">
        {COMMON.map((name) => (
          <option key={name} value={name} />
        ))}
      </datalist>
    </div>
  );
}
