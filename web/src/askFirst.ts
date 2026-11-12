// The app's own "are you sure?", in place of the browser's grey confirm box:
// a small dialog with the question and two named buttons. Plain DOM, not
// React, so code outside a page (phoneMode.ts) can ask too. Escape,
// Android's back (androidBack.ts) and tapping outside the box all close it
// without an answer: askFirst counts that as `no`, askBetween says so.

export interface AskOptions {
  yes: string;
  no?: string;
  // A one-way action (deleting, throwing work away): the yes button is red,
  // and the safe button has the focus, so a stray Enter backs out.
  danger?: boolean;
}

// Each box's question gets its own id, for when one asks over another.
let asked = 0;

export async function askFirst(question: string, options: AskOptions): Promise<boolean> {
  return (await askBetween(question, options)) === "yes";
}

// For a question where `no` also does something (throwing changes away),
// so closing it without an answer can mean "never mind" instead.
export function askBetween(question: string, { yes, no = "Cancel", danger = false }: AskOptions): Promise<"yes" | "no" | null> {
  return new Promise((resolve) => {
    const dialog = document.createElement("dialog");
    dialog.className = "ask-dialog";
    const text = document.createElement("p");
    text.textContent = question;
    // The question names the box, so a screen reader reads it out with the
    // focused button, not "Delete, button" alone.
    text.id = `ask-question-${++asked}`;
    dialog.setAttribute("role", "alertdialog");
    dialog.setAttribute("aria-labelledby", text.id);
    const buttons = document.createElement("div");
    buttons.className = "ask-buttons";
    const noButton = button(no, "button");
    const yesButton = button(yes, danger ? "button danger" : "button primary");
    buttons.append(noButton, yesButton);
    dialog.append(text, buttons);

    let answer: "yes" | "no" | null = null;
    noButton.onclick = () => {
      answer = "no";
      dialog.close();
    };
    yesButton.onclick = () => {
      answer = "yes";
      dialog.close();
    };
    // A tap on the backdrop lands on the dialog itself, but so does one on
    // the box's own padding (a near miss of a button): only a tap outside
    // the box counts.
    dialog.onclick = (event) => {
      if (event.target !== dialog) return;
      const box = dialog.getBoundingClientRect();
      const inside =
        event.clientX >= box.left && event.clientX <= box.right && event.clientY >= box.top && event.clientY <= box.bottom;
      if (!inside) dialog.close();
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
