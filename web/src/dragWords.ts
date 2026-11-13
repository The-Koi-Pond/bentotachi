// What a screen reader hears while something is dragged (dnd-kit's
// Announcements). dnd-kit's own words read out the ids ("Draggable item
// jjv4110… was dropped over droppable area 2026-10-28"), so every
// DndContext passes names from here instead.

import type { Announcements, KeyboardCodes, ScreenReaderInstructions } from "@dnd-kit/core";

// Where a grip opens a menu of moves (GripMenu.tsx), Enter opens it (a
// button's own click) and only Space picks the thing up to drag: dnd-kit
// would otherwise take both. Its KeyboardSensor's `keyboardCodes`.
export const gripKeys: KeyboardCodes = { start: ["Space"], cancel: ["Escape"], end: ["Space", "Enter", "Tab"] };

// What a screen reader hears on such a grip, in place of dnd-kit's own
// hint, which says nothing of the menu. TalkBack reads it on a phone too,
// so the menu comes first and the keys after.
export const gripInstructions: ScreenReaderInstructions = {
  draggable: "Opens a menu of moves. With a keyboard, Space picks it up, the arrow keys move it, and Space drops it.",
};

type Id = string | number;

// `name` says what's dragged, `place` where it would land (by default the
// same: a shelf dropped on another shelf takes its place).
export function dragAnnouncements(name: (id: string) => string, place: (id: string) => string = name): Announcements {
  const what = (id: Id) => name(String(id));
  const where = (id: Id) => place(String(id));
  return {
    onDragStart: ({ active }) => `Picked up ${what(active.id)}.`,
    onDragOver: ({ active, over }) => (over ? `Over ${where(over.id)}.` : `${what(active.id)} isn't over anywhere to drop it.`),
    onDragEnd: ({ active, over }) => (over ? `Dropped ${what(active.id)} on ${where(over.id)}.` : `Put ${what(active.id)} back.`),
    onDragCancel: ({ active }) => `Put ${what(active.id)} back.`,
  };
}
