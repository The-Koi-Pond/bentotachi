// A date box that opens Bentotachi's own calendar (docs/VISION.md, "Date
// picker"): the chosen date big at the top with a pencil to type it instead,
// then "December 2026 ▾" (tap for the years) with ‹ › for the months, then
// the days. A popover over the page, like the "?" tips (Help.tsx); OK keeps
// the date, Cancel, Escape or tapping elsewhere leaves it as it was.
import { useCallback, useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { addMonths, firstDayFor, formatDay, localToday, monthStart } from "./dates";
import { dateOrder, monthWeeks, orderHint, readTypedDate, typedText, yearsAround } from "./calendar";
import { popoverSpot } from "./popoverSpot";
import { useCountry } from "./household";
import { CalendarIcon, ChevronIcon, PencilIcon } from "./icons";

// Phones whose browser is too old for popovers get the calendar opening
// right under the box instead.
const canPop = typeof HTMLElement !== "undefined" && "popover" in HTMLElement.prototype;

const longDate = (date: string) => formatDay(date, { weekday: "short", day: "numeric", month: "short", year: "numeric" });
// The box's own, without the weekday, to fit half a phone's width.
const boxDate = (date: string) => formatDay(date, { day: "numeric", month: "short", year: "numeric" });

export default function DateField({
  value,
  onChange,
  label,
  required = false,
  empty = "No date",
  quick,
}: {
  // "2026-12-14", or "" for none.
  value: string;
  onChange: (date: string) => void;
  // What the date is ("Use by"), said on the box and atop the calendar.
  label: string;
  // Without it, the calendar offers Clear.
  required?: boolean;
  // What an empty box says, when "No date" doesn't fit ("Not opened").
  empty?: string;
  // A one-tap date joined to the empty box's end ("Today" for Opened).
  quick?: { label: string; date: string };
}) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const anchor = useRef<HTMLButtonElement>(null);
  const pop = useRef<HTMLDivElement>(null);

  const place = useCallback(() => {
    const box = pop.current;
    const button = anchor.current;
    if (!box || !button) return;
    const spot = popoverSpot(button.getBoundingClientRect(), { width: box.offsetWidth, height: box.offsetHeight }, {
      width: document.documentElement.clientWidth,
      height: window.innerHeight,
    });
    box.style.left = `${spot.left}px`;
    // Taller than the room above or below its box: kept on screen anyway,
    // over the box if need be.
    const lowest = window.innerHeight - 8 - box.offsetHeight;
    box.style.top = `${Math.max(8, Math.min(spot.top, lowest))}px`;
  }, []);

  useEffect(() => {
    if (!canPop || !open) return;
    place();
    window.addEventListener("scroll", place, true);
    window.addEventListener("resize", place);
    return () => {
      window.removeEventListener("scroll", place, true);
      window.removeEventListener("resize", place);
    };
  }, [open, place]);

  const close = () => {
    if (canPop) pop.current?.hidePopover();
    setOpen(false);
  };

  const calendar = open && (
    <Calendar
      start={value}
      empty={empty}
      label={label}
      required={required}
      onResize={place}
      onDone={(date) => {
        if (date !== null) onChange(date);
        close();
        anchor.current?.focus();
      }}
    />
  );

  const box = (
    <button
        ref={anchor}
        type="button"
        className="date-field"
        aria-expanded={open}
        aria-controls={id}
        aria-label={`${label}: ${value ? longDate(value) : empty.toLowerCase()}`}
        popoverTarget={canPop ? id : undefined}
        onClick={canPop ? undefined : () => setOpen(!open)}
      >
        <span className={value ? "" : "date-field-empty"}>{value ? boxDate(value) : empty}</span>
        <CalendarIcon size={18} />
      </button>
  );

  return (
    <>
      {quick && !value ? (
        <span className="date-joined">
          {box}
          <button type="button" className="date-quick" onClick={() => onChange(quick.date)} aria-label={`${label}: ${quick.label.toLowerCase()}`}>
            {quick.label}
          </button>
        </span>
      ) : (
        box
      )}
      {canPop ? (
        <div
          ref={pop}
          id={id}
          className="date-pop"
          popover="auto"
          onToggle={(event) => setOpen(event.newState === "open")}
          // It sits inside its box's <label>: a tap on a blank part of the
          // calendar would otherwise go on to the box, which closes it.
          onClick={(event) => event.preventDefault()}
          // Escape closes just the calendar, not a form it sits in.
          onKeyDown={(event) => event.key === "Escape" && event.stopPropagation()}
        >
          {calendar}
        </div>
      ) : (
        open && (
          <div id={id} className="date-pop date-inline" onClick={(event) => event.preventDefault()}>
            {calendar}
          </div>
        )
      )}
    </>
  );
}

// The calendar on its own, in the middle of the screen, for a date asked
// for without a box to tap (a scan's "+ Use-by"). Closes with OK (the date)
// or Cancel, Escape or the phone's back (null). `required`: no Clear, for a
// date that can't be left empty (where to move a dish).
export function DateDialog({
  label,
  start = "",
  required = false,
  onDone,
}: {
  label: string;
  start?: string;
  required?: boolean;
  onDone: (date: string | null) => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const box = dialog.current;
    if (box && !box.open) box.showModal();
    // Opening the dialog focuses its first button (the pencil): the day
    // instead, as in a box's calendar.
    if (box) focusDay(box);
  }, []);
  return (
    <dialog
      ref={dialog}
      className="date-pop date-dialog"
      aria-label={label}
      onCancel={(event) => {
        event.preventDefault();
        onDone(null);
      }}
    >
      <Calendar start={start} empty="No date" label={label} required={required} inDialog onResize={() => {}} onDone={onDone} />
    </dialog>
  );
}

// The calendar itself; mounted each time it opens, so it starts from the
// box's date (or today's month). `onDone(null)` is Cancel.
function Calendar({
  start,
  empty,
  label,
  required,
  inDialog = false,
  onResize,
  onDone,
}: {
  start: string;
  empty: string;
  label: string;
  required: boolean;
  // Inside DateDialog's <dialog>, which is the dialog (and carries the
  // name), so a screen reader doesn't hear two.
  inDialog?: boolean;
  onResize: () => void;
  onDone: (date: string | null) => void;
}) {
  const today = localToday();
  const firstDay = firstDayFor(useCountry()[0]);
  const order = useMemo(() => dateOrder(), []);
  const [chosen, setChosen] = useState(start);
  const [month, setMonth] = useState(monthStart(start || today));
  const [view, setView] = useState<"days" | "years" | "typing">("days");
  const [typed, setTyped] = useState(typedText(start, order));
  const typedDate = readTypedDate(typed, order);
  const grid = useRef<HTMLDivElement>(null);

  // Its size changes with the view: placed again, so it stays on screen.
  useEffect(onResize, [view, month, onResize]);

  // Opened with the keyboard in mind: the chosen day (or today) has focus.
  useEffect(() => {
    if (view !== "days") return;
    if (grid.current) focusDay(grid.current);
    // Only on opening and coming back from the years, not every month.
  }, [view]);

  const weekdays = monthWeeks(month, firstDay)[1].map((day) => formatDay(day, { weekday: "narrow" }));
  const monthName = formatDay(month, { month: "long", year: "numeric" });
  const picked = view === "typing" ? typedDate : chosen;

  function ok() {
    if (view === "typing" && typed.trim() && !typedDate) return;
    onDone(view === "typing" ? (typedDate ?? "") : chosen);
  }

  const enterOks = (event: KeyboardEvent) => {
    if (event.key !== "Enter") return;
    event.preventDefault();
    ok();
  };

  return (
    <div className="calendar" role={inDialog ? undefined : "dialog"} aria-label={inDialog ? undefined : label}>
      <p className="calendar-label">{label}</p>
      <div className="calendar-head">
        {view === "typing" ? (
          <input
            className="calendar-typing"
            autoFocus
            inputMode="numeric"
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            onKeyDown={enterOks}
            placeholder={orderHint(order)}
            aria-label="Type the date"
            aria-invalid={!!typed.trim() && !typedDate}
          />
        ) : (
          <strong className="calendar-date">{chosen ? longDate(chosen) : empty}</strong>
        )}
        <button
          type="button"
          className="icon-button"
          onClick={() => {
            if (view === "typing") {
              if (typedDate) {
                setChosen(typedDate);
                setMonth(monthStart(typedDate));
              }
              setView("days");
            } else {
              setTyped(typedText(chosen, order));
              setView("typing");
            }
          }}
          aria-label={view === "typing" ? "Pick on the calendar" : "Type the date"}
          title={view === "typing" ? "Pick on the calendar" : "Type the date"}
        >
          {view === "typing" ? <CalendarIcon size={18} /> : <PencilIcon />}
        </button>
      </div>
      {view === "typing" && typed.trim() && !typedDate && <p className="calendar-error">Type it like {orderHint(order)}.</p>}

      {view !== "typing" && (
        <>
          <div className="calendar-nav">
            <button
              type="button"
              className="calendar-month"
              aria-expanded={view === "years"}
              onClick={() => setView(view === "years" ? "days" : "years")}
            >
              {monthName}
              <span className="calendar-caret" aria-hidden="true">
                <ChevronIcon />
              </span>
            </button>
            {view === "days" && (
              <span className="calendar-arrows">
                <button type="button" className="icon-button calendar-back" onClick={() => setMonth(addMonths(month, -1))} aria-label="Last month">
                  <ChevronIcon />
                </button>
                <button type="button" className="icon-button" onClick={() => setMonth(addMonths(month, 1))} aria-label="Next month">
                  <ChevronIcon />
                </button>
              </span>
            )}
          </div>

          {view === "years" ? (
            <Years
              shown={Number(month.slice(0, 4))}
              thisYear={Number(today.slice(0, 4))}
              onPick={(year) => {
                setMonth(`${year}${month.slice(4)}`);
                setView("days");
              }}
            />
          ) : (
            <div ref={grid} className="calendar-grid" role="group" aria-label={monthName}>
              {weekdays.map((name, i) => (
                <span key={`w${i}`} className="calendar-weekday" aria-hidden="true">
                  {name}
                </span>
              ))}
              {monthWeeks(month, firstDay)
                .flat()
                .map((day, i) =>
                  day ? (
                    <button
                      key={day}
                      type="button"
                      className={day === today ? "calendar-day today" : "calendar-day"}
                      aria-pressed={day === chosen}
                      aria-label={longDate(day)}
                      onClick={() => setChosen(day)}
                    >
                      {Number(day.slice(8))}
                    </button>
                  ) : (
                    <span key={`b${i}`} />
                  )
                )}
            </div>
          )}
        </>
      )}

      <div className="calendar-actions">
        {!required && (picked || chosen) && (
          <button type="button" className="button ghost small calendar-clear" onClick={() => onDone("")}>
            Clear
          </button>
        )}
        <button type="button" className="button ghost small" onClick={() => onDone(null)}>
          Cancel
        </button>
        <button type="button" className="button primary small" onClick={ok} disabled={required && !picked}>
          OK
        </button>
      </div>
    </div>
  );
}

// The chosen day has focus, else today, else the month's first.
function focusDay(root: HTMLElement) {
  const day =
    root.querySelector<HTMLButtonElement>(".calendar-day[aria-pressed=true]") ??
    root.querySelector<HTMLButtonElement>(".calendar-day.today") ??
    root.querySelector<HTMLButtonElement>(".calendar-day");
  day?.focus({ preventScroll: true });
}

// The years to pick from, the shown one marked and scrolled to.
function Years({ shown, thisYear, onPick }: { shown: number; thisYear: number; onPick: (year: number) => void }) {
  const list = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const box = list.current;
    const current = box?.querySelector<HTMLButtonElement>("[aria-pressed=true]");
    // Scrolled within the list only, never the page behind.
    if (box && current) box.scrollTop = current.offsetTop - box.clientHeight / 2 + current.offsetHeight / 2;
    current?.focus({ preventScroll: true });
  }, []);
  return (
    <div ref={list} className="calendar-years" role="group" aria-label="Years">
      {yearsAround(shown, thisYear).map((year) => (
        <button
          key={year}
          type="button"
          className={year === thisYear ? "calendar-year this-year" : "calendar-year"}
          aria-pressed={year === shown}
          onClick={() => onPick(year)}
        >
          {year}
        </button>
      ))}
    </div>
  );
}
