// The pantry page's title as a picker (docs/VISION.md, "Pantry places"):
// "Pantry ▾" for every place, or one place ("Fridge ▾") so the page shows
// just that. Tapping it lists the places by name, then "Edit places…": each
// name to change (renaming it), its grip to drag it into another spot, 🗑
// to delete it, and "+ Add". A popover over the page, like the "?" tips
// (Help.tsx).
import { useCallback, useEffect, useId, useRef, useState, type FormEvent } from "react";
import { closestCenter, DndContext, KeyboardSensor, PointerSensor, useDraggable, useDroppable, useSensor, useSensors } from "@dnd-kit/core";
import { popoverSpot } from "./popoverSpot";
import { ChevronIcon, GripIcon, TrashIcon } from "./icons";
import type { Place } from "./pantryGroups";

const canPop = typeof HTMLElement !== "undefined" && "popover" in HTMLElement.prototype;

export default function PlacePicker({
  places,
  current,
  onPick,
  onAdd,
  onRename,
  onDelete,
  onMove,
}: {
  places: Place[];
  // null: all places.
  current: Place | null;
  onPick: (place: Place | null) => void;
  onAdd: (label: string) => void;
  // Renames a place for every item in it.
  // Done when it's renamed, or the merge it would be was turned down.
  onRename: (place: Place, label: string) => Promise<void>;
  // Done when it's deleted, or its question was answered no.
  onDelete: (place: Place) => Promise<void>;
  // One place dragged to where another is (their keys).
  onMove: (fromKey: string, toKey: string) => void;
}) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const anchor = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  // Dragged by the grip (a small move starts it, so a tap in the name box
  // isn't a drag), or with the keyboard (Space, arrows, Space), like the
  // recipe shelves.
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }), useSensor(KeyboardSensor));

  const position = useCallback(() => {
    const box = menu.current;
    const button = anchor.current;
    if (!box || !button) return;
    const spot = popoverSpot(button.getBoundingClientRect(), { width: box.offsetWidth, height: box.offsetHeight }, {
      width: document.documentElement.clientWidth,
      height: window.innerHeight,
    });
    box.style.left = `${spot.left}px`;
    box.style.top = `${spot.top}px`;
  }, []);

  useEffect(() => {
    if (!canPop || !open) return;
    position();
    window.addEventListener("resize", position);
    return () => window.removeEventListener("resize", position);
  }, [open, editing, places.length, position]);

  function pick(chosen: Place | null) {
    onPick(chosen);
    if (canPop) menu.current?.hidePopover();
    setOpen(false);
  }

  // A merge or a delete can ask first, and its question (a dialog) closes
  // this menu: open again, still editing, once it's answered.
  async function stillEditing(change: () => Promise<void>) {
    const box = menu.current;
    const wasOpen = !!box && canPop && box.matches(":popover-open");
    await change();
    if (!box || !wasOpen || !box.isConnected || box.matches(":popover-open")) return;
    box.showPopover();
    setEditing(true);
  }

  // A tap on the message at the bottom (a rename's or delete's Undo) is
  // outside this menu, so the browser closes it: open it again, still
  // editing, as stillEditing does after a question.
  const tappedToast = useRef(false);
  useEffect(() => {
    if (!editing) return;
    const note = (event: PointerEvent) => {
      tappedToast.current = event.target instanceof Element && !!event.target.closest(".notice-toast");
    };
    // A touch that turns into a scroll closes nothing: forget it, or a
    // later Escape or Back would open the menu again instead of closing it.
    const forget = () => {
      tappedToast.current = false;
    };
    document.addEventListener("pointerdown", note, true);
    document.addEventListener("pointercancel", forget, true);
    return () => {
      document.removeEventListener("pointerdown", note, true);
      document.removeEventListener("pointercancel", forget, true);
      forget();
    };
  }, [editing]);

  // "Other" is items with no place: nothing to rename or delete.
  const editable = places.filter((p) => p.key !== "");

  const options = editing ? (
    <div className="place-edit" role="group" aria-label="Edit places">
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={(event) => {
          if (event.over && event.over.id !== event.active.id) onMove(String(event.active.id), String(event.over.id));
        }}
      >
        {editable.map((p) => (
          <PlaceRow
            key={p.key}
            place={p}
            onRename={(label) => stillEditing(() => onRename(p, label))}
            onDelete={() => void stillEditing(() => onDelete(p))}
          />
        ))}
      </DndContext>
      <NewPlace onAdd={onAdd} />
      <button type="button" className="button primary small place-edit-done" onClick={() => setEditing(false)}>
        Done
      </button>
    </div>
  ) : (
    <>
      <button type="button" aria-current={current === null} onClick={() => pick(null)}>
        All places
      </button>
      <hr />
      {places.map((p) => (
        <button key={p.key} type="button" aria-current={current?.key === p.key} onClick={() => pick(p)}>
          {p.label}
        </button>
      ))}
      <hr />
      <button type="button" className="place-edit-button" onClick={() => setEditing(true)}>
        Edit places…
      </button>
    </>
  );

  return (
    <>
      <h1 className="place-title">
        <button
          ref={anchor}
          type="button"
          aria-expanded={open}
          aria-controls={id}
          aria-label={`${current ? current.label : "Pantry"}: choose a place`}
          popoverTarget={canPop ? id : undefined}
          onClick={canPop ? undefined : () => setOpen(!open)}
        >
          {current ? current.label : "Pantry"}
          <span className="place-title-caret" aria-hidden="true">
            <ChevronIcon />
          </span>
        </button>
      </h1>
      {canPop ? (
        <div
          ref={menu}
          id={id}
          className="place-menu"
          popover="auto"
          onToggle={(event) => {
            if (event.newState === "closed" && tappedToast.current) {
              tappedToast.current = false;
              menu.current?.showPopover();
              return;
            }
            setOpen(event.newState === "open");
            if (event.newState === "closed") setEditing(false);
          }}
        >
          {options}
        </div>
      ) : (
        open && (
          <div id={id} className="place-menu place-menu-inline">
            {options}
          </div>
        )
      )}
    </>
  );
}

// One place in "Edit places": its grip, its name to change (saved when you
// leave the box or press Enter), and 🗑. Dropped on another, it takes that
// one's spot.
function PlaceRow({ place, onRename, onDelete }: { place: Place; onRename: (label: string) => Promise<void>; onDelete: () => void }) {
  const [name, setName] = useState(place.label);
  const drag = useDraggable({ id: place.key });
  const drop = useDroppable({ id: place.key });
  // Enter renames, and the merge question it can ask takes the focus, so
  // leaving the box would rename (and ask) again.
  const renaming = useRef(false);
  // Its name now: a rename that only changes capitals keeps this row, so
  // the box follows it rather than the name from before.
  const latest = useRef(place.label);
  useEffect(() => {
    latest.current = place.label;
    setName(place.label);
  }, [place.label]);
  const commit = () => {
    if (renaming.current) return;
    const label = name.trim();
    if (label && label !== place.label) {
      renaming.current = true;
      void onRename(label).finally(() => {
        renaming.current = false;
        // Not renamed (refused, or the merge turned down): its name again.
        setName(latest.current);
      });
    } else setName(place.label);
  };
  const classes = ["place-row", drag.isDragging ? "dragging" : "", drop.isOver && !drag.isDragging ? "drop-here" : ""];
  return (
    <span
      ref={(node) => {
        drag.setNodeRef(node);
        drop.setNodeRef(node);
      }}
      className={classes.join(" ")}
      // Follows the finger up and down only.
      style={drag.transform ? { transform: `translate3d(0, ${drag.transform.y}px, 0)` } : undefined}
    >
      <button type="button" className="drag-handle place-handle" aria-label={`Move ${place.label}`} title="Drag to move" {...drag.attributes} {...drag.listeners}>
        <GripIcon />
      </button>
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            commit();
          }
        }}
        maxLength={100}
        aria-label={`Rename ${place.label}`}
      />
      <button type="button" className="icon-button place-delete" onClick={onDelete} aria-label={`Delete ${place.label}`} title={`Delete ${place.label}`}>
        <TrashIcon size={18} />
      </button>
    </span>
  );
}

// "+ Add" a place, by name.
function NewPlace({ onAdd }: { onAdd: (label: string) => void }) {
  const [name, setName] = useState("");
  function add(event: FormEvent) {
    event.preventDefault();
    if (!name.trim()) return;
    onAdd(name.trim());
    setName("");
  }
  return (
    <form className="place-row" onSubmit={add}>
      <input value={name} onChange={(e) => setName(e.target.value)} maxLength={100} placeholder="New place" aria-label="New place's name" />
      <button className="button small" disabled={!name.trim()}>
        + Add
      </button>
    </form>
  );
}
