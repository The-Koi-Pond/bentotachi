import { hideToast, useToast } from "./toast";

// Shows toast.ts's message at the bottom of the screen; a tap puts it away.
export default function Toaster() {
  const toast = useToast();
  if (!toast) return null;
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
