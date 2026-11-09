import { hideToast, useToast } from "./toast";

// Shows toast.ts's message at the bottom of the screen; a tap puts it away.
// One with a button ("Undo") looks like the Undo bar: the button does its
// job and puts it away, and the message itself doesn't (it's a smaller
// target than a mis-tap).
export default function Toaster() {
  const toast = useToast();
  if (!toast) return null;
  const { action } = toast;
  if (action)
    return (
      <p key={toast.id} className="toast notice-toast undo-toast" role="status">
        <span>{toast.text}</span>
        <button
          className="link-button"
          onClick={() => {
            hideToast();
            action.run();
          }}
        >
          {action.label}
        </button>
      </p>
    );
  return (
    <p
      key={toast.id}
      className={toast.error ? "toast notice-toast toast-error" : "toast notice-toast"}
      role={toast.error ? "alert" : "status"}
      onClick={hideToast}
    >
      {toast.text}
    </p>
  );
}
