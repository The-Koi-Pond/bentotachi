import { ZapIcon } from "./icons";

// ⚡ in the top-left corner of a quick recipe's picture (see isQuick).
export default function QuickBadge({ size = 14 }: { size?: number }) {
  return (
    <span className="quick-badge" role="img" aria-label="Quick" title="Quick">
      <ZapIcon filled size={size} />
    </span>
  );
}
