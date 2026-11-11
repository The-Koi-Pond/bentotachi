// "− 6 servings +" above a recipe's ingredients: scales every amount (see
// scaling.ts). Recipes that say how many they make step by servings (by a
// quarter of the recipe for big batches, "24 cookies" goes up by 6);
// others step through ×½, ×1, ×1½, ×2, ×3, ×4.

import { kitchenFraction, servingsCount, servingsText, servingsWording } from "./scaling";

const FACTORS = [0.5, 1, 1.5, 2, 3, 4];

// How much the recipe is scaled, in words: "6 servings", "×2".
export function scaledServings(servings: string, factor: number): string {
  const base = servingsCount(servings);
  if (base) return servingsText(servings, base * factor);
  if (factor === 1) return servings;
  return servings ? `${servings} (×${kitchenFraction(factor)})` : `×${kitchenFraction(factor)}`;
}

export default function ScaleControl({
  servings,
  factor,
  onChange,
}: {
  servings: string;
  factor: number;
  onChange: (factor: number) => void;
}) {
  const base = servingsCount(servings);
  let fewer: number | null;
  let more: number | null;
  if (base) {
    const step = base > 12 ? Math.round(base / 4) : 1;
    const count = Math.round(base * factor);
    fewer = count - step >= 1 ? (count - step) / base : null;
    more = count + step <= base * 10 ? (count + step) / base : null;
  } else {
    const at = FACTORS.indexOf(factor);
    fewer = at > 0 ? FACTORS[at - 1] : null;
    more = at < FACTORS.length - 1 ? FACTORS[at + 1] : null;
  }

  // A small card (a slider can come later if people ask): "Serves" or "Makes" (servingsWording) with the stepper
  // beside it, then once changed one line saying what it was scaled from, with Reset.
  const shown = servingsWording(scaledServings(servings, factor));
  return (
    <div className="scale-row">
      <div className="scale-top">
        <span className="scale-label">{base ? shown.label : "Batch"}</span>
        <div className="scale-control" role="group" aria-label="Recipe size">
          <button
            className="icon-button small"
            onClick={() => fewer !== null && onChange(fewer)}
            disabled={fewer === null}
            aria-label={base ? "Fewer servings" : "Smaller batch"}
          >
            −
          </button>
          <span className="scale-value" aria-live="polite">
            {/* The label is beside the stepper; said with the number, so a
                change is heard as "Serves 5", not "5". */}
            {base && <span className="screen-reader-only">{shown.label} </span>}
            {base ? shown.amount : `×${kitchenFraction(factor)}`}
          </span>
          <button
            className="icon-button small"
            onClick={() => more !== null && onChange(more)}
            disabled={more === null}
            aria-label={base ? "More servings" : "Bigger batch"}
          >
            +
          </button>
        </div>
      </div>
      {factor !== 1 && (
        <p className="muted scale-note">
          {base ? `Scaled from ${servings}.` : "Scaled from the recipe's amounts."} Amounts in the method stay as written.{" "}
          <button className="link-button" onClick={() => onChange(1)}>
            Reset
          </button>
        </p>
      )}
    </div>
  );
}
