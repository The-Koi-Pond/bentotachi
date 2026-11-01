// "− 6 servings +" above a recipe's ingredients: scales every amount (see
// scaling.ts). Recipes that say how many they make step by servings (by a
// quarter of the recipe for big batches, "24 cookies" goes up by 6);
// others step through ×½, ×1, ×1½, ×2, ×3, ×4.

import { kitchenFraction, servingsCount, servingsText } from "./scaling";

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

  return (
    <div className="scale-row">
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
          {base ? scaledServings(servings, factor) : `×${kitchenFraction(factor)}`}
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
      {factor !== 1 && (
        <>
          <button className="link-button" onClick={() => onChange(1)}>
            Back to {base ? servings : "×1"}
          </button>
          <p className="muted scale-note">Only the ingredients change: amounts in the method stay as written.</p>
        </>
      )}
    </div>
  );
}
