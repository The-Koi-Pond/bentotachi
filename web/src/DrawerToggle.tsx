import type { ReactNode } from "react";
import { ChevronIcon } from "./icons";

// The heading button of a drawer that opens and closes (Pantry places,
// Recipes shelves): a chevron that turns when open, then its contents.
export default function DrawerToggle({
  open,
  onToggle,
  className,
  children,
}: {
  open: boolean;
  onToggle: () => void;
  className: string;
  children: ReactNode;
}) {
  return (
    <button className={`drawer-toggle ${className}`} aria-expanded={open} onClick={onToggle}>
      <span className="chevron" aria-hidden="true">
        <ChevronIcon />
      </span>
      {children}
    </button>
  );
}
