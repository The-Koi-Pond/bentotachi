// Shows a <dialog> sheet as a modal while it's mounted (or while `show`),
// and closes it on unmount. Give the dialog's onClose the handler this
// returns: it skips a close event that lands while the sheet is open again.
// React's development mode mounts twice, and the first unmount's close event
// arrives after the second showModal, which read as the person closing it.
import { useEffect, type RefObject } from "react";

export function useModalSheet(ref: RefObject<HTMLDialogElement | null>, onClose: () => void, { show = true } = {}) {
  useEffect(() => {
    const dialog = ref.current;
    if (show && dialog && !dialog.open) dialog.showModal();
    return () => dialog?.close();
  }, [ref, show]);
  return () => {
    if (!ref.current?.open) onClose();
  };
}
