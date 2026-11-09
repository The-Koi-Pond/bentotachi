// The app's own "are you sure?", in place of the browser's grey confirm box:
// a small dialog with the question and two named buttons. Plain DOM, not
// React, so code outside a page (phoneMode.ts) can ask too. Escape,
// Android's back (androidBack.ts) and tapping outside all answer `no`.

export interface AskOptions {
  yes: string;
  no?: string;
  // A one-way action (deleting, replacing everything): the yes button is
  // red, and the safe button has the focus, so a stray Enter backs out.
  danger?: boolean;
}

export function askFirst(question: string, { yes, no = "Cancel", danger = false }: AskOptions): Promise<boolean> {
  return new Promise((resolve) => {
    const dialog = document.createElement("dialog");
    dialog.className = "ask-dialog";
    const text = document.createElement("p");
    text.textContent = question;
    const buttons = document.createElement("div");
    buttons.className = "ask-buttons";
    const noButton = button(no, "button");
    const yesButton = button(yes, danger ? "button danger" : "button primary");
    buttons.append(noButton, yesButton);
    dialog.append(text, buttons);

    let answer = false;
    noButton.onclick = () => dialog.close();
    yesButton.onclick = () => {
      answer = true;
      dialog.close();
    };
    // A tap on the backdrop lands on the dialog itself, outside its box.
    dialog.onclick = (event) => {
      if (event.target === dialog) dialog.close();
    };
    dialog.onclose = () => {
      dialog.remove();
      resolve(answer);
    };

    document.body.append(dialog);
    dialog.showModal();
    (danger ? noButton : yesButton).focus();
  });
}

function button(label: string, className: string): HTMLButtonElement {
  const element = document.createElement("button");
  element.type = "button";
  element.className = className;
  element.textContent = label;
  return element;
}
