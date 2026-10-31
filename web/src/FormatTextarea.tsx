import { useRef, type ComponentProps, type KeyboardEvent } from "react";
import { toggleMark } from "./textFormat";
import type { Mark } from "./softMarks";

// A recipe text box with B / I / U buttons above it (and Ctrl+B / I / U):
// select some words and press one to mark them (see textFormat.ts). Used
// like a plain <textarea>. The buttons come after the box in the page, so
// a <label> around it still belongs to the box, and CSS puts them on top.

const BUTTONS: { mark: Mark; key: string; label: string; text: string }[] = [
  { mark: "bold", key: "b", label: "Bold", text: "B" },
  { mark: "soft", key: "i", label: "Soft italics (greyed out)", text: "I" },
  { mark: "underline", key: "u", label: "Underline", text: "U" },
];

export default function FormatTextarea({ onKeyDown, ...props }: ComponentProps<"textarea">) {
  const box = useRef<HTMLTextAreaElement>(null);

  function apply(mark: Mark) {
    const el = box.current;
    if (!el) return;
    const change = toggleMark(el.value, el.selectionStart, el.selectionEnd, mark);
    if (!change) return;
    el.focus();
    el.setSelectionRange(change.from, change.to);
    // Typing it in the browser's own way keeps Ctrl+Z working; if that's
    // not available, set the text directly (React still hears about it).
    const expected = el.value.slice(0, change.from) + change.text + el.value.slice(change.to);
    if (!document.execCommand("insertText", false, change.text) || el.value !== expected) {
      Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set?.call(el, expected);
      el.dispatchEvent(new Event("input", { bubbles: true }));
    }
    el.setSelectionRange(change.selectStart, change.selectEnd);
  }

  function keyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    const button = BUTTONS.find((b) => b.key === event.key.toLowerCase());
    if (button && (event.ctrlKey || event.metaKey) && !event.altKey && !event.shiftKey) {
      event.preventDefault();
      apply(button.mark);
      return;
    }
    onKeyDown?.(event);
  }

  return (
    <span className="format-field">
      <textarea ref={box} onKeyDown={keyDown} {...props} />
      <span className="format-bar">
        {BUTTONS.map((button) => (
          <button
            key={button.mark}
            type="button"
            className={`format-button format-${button.mark}`}
            aria-label={button.label}
            title={`${button.label} (Ctrl+${button.key.toUpperCase()})`}
            // Keeps the words selected in the box while the button is pressed.
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => apply(button.mark)}
          >
            {button.text}
          </button>
        ))}
      </span>
    </span>
  );
}
