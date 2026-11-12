// What a screen reader hears while something is dragged (dnd-kit's
// Announcements). dnd-kit's own words read out the ids ("Draggable item
// jjv4110… was dropped over droppable area 2026-10-28"), so every
// DndContext passes names from here instead.

import type { Announcements } from "@dnd-kit/core";

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
