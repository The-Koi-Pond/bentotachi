import { ZapIcon } from "./icons";

// A quick recipe's time (see isQuick): "⚡ 15 min" in jade, on recipe cards
// and the recipe page's Total. Plain text, not a badge on the photo, so it
// can't be mistaken for a button like the heart.
export default function QuickTime({ quick, children }: { quick: boolean; children: string }) {
  if (!quick) return <span>{children}</span>;
  return (
    <span className="quick-time" title="Quick">
      <span role="img" aria-label="Quick," className="quick-time-icon">
        <ZapIcon filled size={12} />
      </span>
      {children}
    </span>
  );
}
