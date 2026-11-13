// A page's title as a picker: the pantry's places ("Fridge ▾", docs/VISION.md,
// "Pantry places") and the shopping lists ("Party ▾"). Tapping it lists the
// options by name, then "Edit …": each name to change, 🗑 to delete it, a
// grip to drag it into another spot (when the page keeps an order), and
// "+ Add". A popover over the page, like the "?" tips (Help.tsx).
import { useCallback, useEffect, useId, useRef, useState, type FormEvent, type ReactNode } from "react";
import { closestCenter, DndContext, KeyboardSensor, PointerSensor, useDraggable, useDroppable, useSensor, useSensors } from "@dnd-kit/core";
import { dragAnnouncements, gripInstructions, gripKeys } from "./dragWords";
import { popoverSpot } from "./popoverSpot";
import { TitleWithHelp } from "./Help";
import { ChevronIcon, TrashIcon } from "./icons";
import GripMenu from "./GripMenu";
import { upDownMoves, type GripMove } from "./listOrder";

const canPop = typeof HTMLElement !== "undefined" && "popover" in HTMLElement.prototype;

export interface TitleOption {
  key: string;
  label: string;
  // Beside its name in the menu ("4 to buy").
  note?: string;
  // Left out of "Edit …" (the pantry's "Other").
  editable?: boolean;
  // Renamed but never deleted (the main shopping list).
  deletable?: boolean;
}

// What the menu says, for each page.
export interface TitleWords {
  // The title when no option is picked ("Pantry").
  title: string;
  // "choose a place", after the title, for screen readers.
  choose: string;
  // "Edit places…", and its group's name "Edit places".
  edit: string;
  // "New place", the new name's placeholder.
  newName: string;
  // "All places", offered first when picking none is allowed.
  all?: string;
  // The longest name the server keeps.
  maxLength: number;
}

export default function TitlePicker({
  options,
  current,
  words,
  onPick,
  onAdd,
  onRename,
  onDelete,
  onMove,
  help,
}: {
  options: TitleOption[];
  // The picked option's key; null: none ("All places").
  current: string | null;
  words: TitleWords;
  onPick: (key: string | null) => void;
  onAdd: (label: string) => void;
  // Done when it's renamed, or a merge it would be was turned down.
  onRename: (key: string, label: string) => Promise<void>;
  // Done when it's deleted, or its question was answered no.
  onDelete: (key: string) => Promise<void>;
  // One dragged to where another is (their keys); without it, no grips.
  onMove?: (fromKey: string, toKey: string) => void;
  // A "?" after the title, inside its heading (Help.tsx's HelpButton).
  help?: ReactNode;
}) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const anchor = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  // Dragged by the grip (a small move starts it, so a tap in the name box
  // isn't a drag), or with the keyboard (Space, arrows, Space), like the
  // recipe shelves.
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { keyboardCodes: gripKeys })
  );

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
  }, [open, editing, options.length, position]);

  function pick(chosen: string | null) {
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

  const editable = options.filter((o) => o.editable !== false);
  const picked = options.find((o) => o.key === current);
  const order = editable.map((o) => o.key);
  const rows = editable.map((o) => (
    <OptionRow
      key={o.key}
      option={o}
      draggable={!!onMove}
      moves={upDownMoves(order, o.key, (toKey) => onMove?.(o.key, toKey))}
      maxLength={words.maxLength}
      onRename={(label) => stillEditing(() => onRename(o.key, label))}
      onDelete={o.deletable === false ? undefined : () => void stillEditing(() => onDelete(o.key))}
    />
  ));

  const items = editing ? (
    <div className="place-edit" role="group" aria-label={words.edit.replace(/…$/, "")}>
      {onMove ? (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          accessibility={{
            screenReaderInstructions: gripInstructions,
            announcements: dragAnnouncements((key) => options.find((o) => o.key === key)?.label ?? "it"),
          }}
          onDragEnd={(event) => {
            if (event.over && event.over.id !== event.active.id) onMove(String(event.active.id), String(event.over.id));
          }}
        >
          {rows}
        </DndContext>
      ) : (
        rows
      )}
      <NewOption placeholder={words.newName} maxLength={words.maxLength} onAdd={onAdd} />
      <button type="button" className="button primary small place-edit-done" onClick={() => setEditing(false)}>
        Done
      </button>
    </div>
  ) : (
    <>
      {words.all && (
        <>
          <button type="button" aria-current={current === null} onClick={() => pick(null)}>
            {words.all}
          </button>
          <hr />
        </>
      )}
      {options.map((o) => (
        <button key={o.key} type="button" aria-current={current === o.key} onClick={() => pick(o.key)}>
          {o.label}
          {o.note && <span className="place-menu-note">{o.note}</span>}
        </button>
      ))}
      <hr />
      <button type="button" className="place-edit-button" onClick={() => setEditing(true)}>
        {words.edit}
      </button>
    </>
  );

  const title = picked ? picked.label : words.title;
  return (
    <>
      <TitleWithHelp help={help}>
        <h1 className="place-title">
          <button
            ref={anchor}
            type="button"
            aria-expanded={open}
            aria-controls={id}
            aria-label={`${title}: ${words.choose}`}
            popoverTarget={canPop ? id : undefined}
            onClick={canPop ? undefined : () => setOpen(!open)}
          >
            {title}
            <span className="place-title-caret" aria-hidden="true">
              <ChevronIcon />
            </span>
          </button>
        </h1>
      </TitleWithHelp>
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
          {items}
        </div>
      ) : (
        open && (
          <div id={id} className="place-menu place-menu-inline">
            {items}
          </div>
        )
      )}
    </>
  );
}

// One option in "Edit …": its grip (when there's an order), its name to
// change (saved when you leave the box or press Enter), and 🗑 (when it can
// be deleted). Dropped on another, it takes that one's spot.
function OptionRow({
  option,
  draggable,
  maxLength,
  onRename,
  onDelete,
  moves,
}: {
  option: TitleOption;
  draggable: boolean;
  // Its grip's menu: "Move up", "Move down".
  moves: GripMove[];
  maxLength: number;
  onRename: (label: string) => Promise<void>;
  onDelete?: () => void;
}) {
  const [name, setName] = useState(option.label);
  const drag = useDraggable({ id: option.key, disabled: !draggable });
  const drop = useDroppable({ id: option.key, disabled: !draggable });
  // Enter renames, and the merge question it can ask takes the focus, so
  // leaving the box would rename (and ask) again.
  const renaming = useRef(false);
  // Its name now: a rename that only changes capitals keeps this row, so
  // the box follows it rather than the name from before.
  const latest = useRef(option.label);
  useEffect(() => {
    latest.current = option.label;
    setName(option.label);
  }, [option.label]);
  const commit = () => {
    if (renaming.current) return;
    const label = name.trim();
    if (label && label !== option.label) {
      renaming.current = true;
      void onRename(label).finally(() => {
        renaming.current = false;
        // Not renamed (refused, or the merge turned down): its name again.
        setName(latest.current);
      });
    } else setName(option.label);
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
      {draggable && (
        <GripMenu
          className="place-handle"
          label={`Move ${option.label}`}
          heading={option.label}
          drag={{ ...drag.attributes, ...drag.listeners }}
          moves={moves}
        />
      )}
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
        maxLength={maxLength}
        aria-label={`Rename ${option.label}`}
      />
      {onDelete ? (
        <button type="button" className="icon-button place-delete" onClick={onDelete} aria-label={`Delete ${option.label}`} title={`Delete ${option.label}`}>
          <TrashIcon size={18} />
        </button>
      ) : (
        // Keeps the boxes lined up with the rows that have 🗑.
        <span className="place-delete" aria-hidden="true" />
      )}
    </span>
  );
}

// "+ Add" one, by name.
function NewOption({ placeholder, maxLength, onAdd }: { placeholder: string; maxLength: number; onAdd: (label: string) => void }) {
  const [name, setName] = useState("");
  function add(event: FormEvent) {
    event.preventDefault();
    if (!name.trim()) return;
    onAdd(name.trim());
    setName("");
  }
  return (
    <form className="place-row" onSubmit={add}>
      <input value={name} onChange={(e) => setName(e.target.value)} maxLength={maxLength} placeholder={placeholder} aria-label={`${placeholder}'s name`} />
      <button className="button small" disabled={!name.trim()}>
        + Add
      </button>
    </form>
  );
}
