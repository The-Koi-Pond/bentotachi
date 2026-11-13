// The ⠿ on something you can drag to move it (a shelf, a pantry place, a
// dish): dragging works as before, and a plain tap (or Enter) opens a small
// menu of moves, for anyone who can't drag (TalkBack, a shaky hand).
// docs/PLAN.md, "Moving things without dragging".
import type { HTMLAttributes } from "react";
import { useDndMonitor } from "@dnd-kit/core";
import { GripIcon } from "./icons";
import type { GripMove } from "./listOrder";
import { usePopMenu } from "./usePopMenu";

export default function GripMenu({
  label,
  heading,
  className = "",
  drag,
  moves,
}: {
  // "Move the Mains shelf": the grip's name for screen readers.
  label: string;
  // What the menu moves, above its moves ("The Mains shelf").
  heading: string;
  className?: string;
  // dnd-kit's attributes and listeners for the grip, so it still drags.
  drag: HTMLAttributes<HTMLButtonElement>;
  moves: GripMove[];
}) {
  const { open, place, menuRef, buttonRef, close, toggle } = usePopMenu<HTMLSpanElement>({ align: "left" });
  // Dragging from a grip whose menu is open: the menu would cover the drop.
  useDndMonitor({ onDragStart: close });
  return (
    <span className="menu grip-menu" ref={menuRef}>
      <button
        ref={buttonRef}
        type="button"
        className={`drag-handle ${className}`}
        title="Drag to move, or tap for moves"
        {...drag}
        // A button that opens a menu, not dnd-kit's "draggable": TalkBack
        // says what it is, and the hint below says it also drags.
        aria-roledescription={undefined}
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={toggle}
      >
        <GripIcon />
      </button>
      {open && (
        <div className="menu-panel pop-menu" role="menu" aria-label={heading} style={place}>
          <p className="menu-heading" aria-hidden="true">
            {heading}
          </p>
          {moves.map((move) => (
            <button
              key={move.label}
              type="button"
              role="menuitem"
              disabled={move.disabled}
              onClick={() => {
                close();
                move.run();
                // Back on the grip, to move it again (a shelf or place stays
                // where it is in the page; a dish moved to another day is
                // drawn afresh, so it can't).
                buttonRef.current?.focus();
              }}
            >
              {move.label}
            </button>
          ))}
        </div>
      )}
    </span>
  );
}
