import { App } from "@capacitor/app";
import { isAndroidApp } from "./pb";

// Android's back gesture/button. Without this, Android closes Bento on the
// first swipe. Instead: close an open pop-up (like the dinner chooser) first,
// otherwise go back a screen like any other app, and only leave from the
// first screen, by sending Bento to the background (what Android expects)
// rather than shutting it.
// A screen with steps of its own that the address doesn't know about (the
// login screen's "How will you use Bentotachi?" and the step after it) can
// take Back first: return true to say it went back a step.
let stepBack: (() => boolean) | null = null;
export function handleBackHere(handler: (() => boolean) | null) {
  stepBack = handler;
}

export function setUpBackGesture() {
  if (!isAndroidApp) return;
  void App.addListener("backButton", ({ canGoBack }) => {
    // An open "?" tip closes first, as Escape would. (A browser too old for
    // popovers doesn't know :popover-open, and would throw on it.)
    const tip = "popover" in HTMLElement.prototype ? document.querySelector<HTMLElement>(":popover-open") : null;
    // The top one, when one opened over another (a question over the photo
    // viewer): it's the last opened, so the last in the page.
    const openDialog = [...document.querySelectorAll<HTMLDialogElement>("dialog[open]")].at(-1);
    if (tip) tip.hidePopover();
    // As Escape does: the pop-up hears "cancel" first and may refuse (one
    // that's still saving, like "Used anything up?").
    else if (openDialog) {
      if (openDialog.dispatchEvent(new Event("cancel", { cancelable: true }))) openDialog.close();
    } else if (stepBack?.()) {
      // That screen went back a step itself.
    } else if (canGoBack) window.history.back();
    else void App.minimizeApp();
  });
}
