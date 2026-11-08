import { App } from "@capacitor/app";
import { isAndroidApp } from "./pb";

// Android's back gesture/button. Without this, Android closes Bento on the
// first swipe. Instead: close an open pop-up (like the dinner chooser) first,
// otherwise go back a screen like any other app, and only leave from the
// first screen, by sending Bento to the background (what Android expects)
// rather than shutting it.
export function setUpBackGesture() {
  if (!isAndroidApp) return;
  void App.addListener("backButton", ({ canGoBack }) => {
    const openDialog = document.querySelector<HTMLDialogElement>("dialog[open]");
    // As Escape does: the pop-up hears "cancel" first and may refuse (one
    // that's still saving, like "Used anything up?").
    if (openDialog) {
      if (openDialog.dispatchEvent(new Event("cancel", { cancelable: true }))) openDialog.close();
    } else if (canGoBack) window.history.back();
    else void App.minimizeApp();
  });
}
