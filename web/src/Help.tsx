import { useId, useState, type ReactNode } from "react";

// Tips on how to use something sit behind a small "?" beside what they
// explain, opening right underneath it (docs/VISION.md, Voice). What a box
// needs and what just happened stay visible instead.
export function useHelp() {
  const [open, setOpen] = useState(false);
  const id = useId();
  return { open, id, toggle: () => setOpen((value) => !value) };
}

type HelpState = ReturnType<typeof useHelp>;

export function HelpButton({ help, label }: { help: HelpState; label: string }) {
  return (
    <button
      type="button"
      className="help-button"
      aria-expanded={help.open}
      aria-controls={help.id}
      aria-label={label}
      title={label}
      onClick={(event) => {
        // Inside a label, a tap would otherwise also focus its box.
        event.preventDefault();
        help.toggle();
      }}
    >
      ?
    </button>
  );
}

export function HelpBox({ help, children }: { help: HelpState; children: ReactNode }) {
  if (!help.open) return null;
  return (
    <div id={help.id} className="help-box">
      {children}
    </div>
  );
}
