import { useLayoutEffect, useRef, type RefObject } from "react";
import { hideToast, useToast } from "./toast";

// Shows toast.ts's message at the bottom of the screen; a tap puts it away.
// One with a button ("Undo") looks like the Undo bar: the button does its
// job and puts it away, and the message itself doesn't (it's a smaller
// target than a mis-tap).
export default function Toaster() {
  const toast = useToast();
  const ref = useRef<HTMLParagraphElement>(null);
  useAboveBars(ref, toast?.id);
  if (!toast) return null;
  const { action, extra } = toast;
  if (action)
    return (
      <p key={toast.id} ref={ref} className="toast notice-toast undo-toast" role="status">
        <span>{toast.text}</span>
        {[extra, action].map(
          (button) =>
            button && (
              <button
                key={button.label}
                className="link-button"
                onClick={() => {
                  hideToast();
                  button.run();
                }}
              >
                {button.label}
              </button>
            )
        )}
      </p>
    );
  return (
    <p
      key={toast.id}
      ref={ref}
      className={toast.error ? "toast notice-toast toast-error" : "toast notice-toast"}
      role={toast.error ? "alert" : "status"}
      onClick={hideToast}
    >
      {toast.text}
    </p>
  );
}

// A page's own bars (its Undo, the pantry's "X is out") stay where they are;
// the message sits just above the highest one, however many there are and
// however tall they wrap. Followed while the message shows: bars coming and
// going, changing size, or moving with the step-timer tray or the screen.
function useAboveBars(ref: RefObject<HTMLElement | null>, id: number | undefined) {
  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    const bars = () => document.querySelectorAll(".toast:not(.notice-toast)");
    const place = () => {
      let lift = 0;
      for (const bar of bars()) {
        const box = bar.getBoundingClientRect();
        if (box.height) lift = Math.max(lift, window.innerHeight - box.top);
      }
      element.style.bottom = lift > 0 ? `${lift + 8}px` : "";
    };
    const resized = new ResizeObserver(place);
    const follow = () => {
      resized.disconnect();
      for (const bar of bars()) resized.observe(bar);
      place();
    };
    const changed = new MutationObserver(follow);
    changed.observe(document.body, { childList: true, subtree: true });
    changed.observe(document.documentElement, { attributes: true, attributeFilter: ["style"] });
    window.addEventListener("resize", place);
    follow();
    return () => {
      changed.disconnect();
      resized.disconnect();
      window.removeEventListener("resize", place);
    };
  }, [ref, id]);
}
