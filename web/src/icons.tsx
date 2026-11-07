// Icons from Lucide (lucide.dev, ISC licence). Decorative: pair them with
// visible text or an aria-label on the button.

import type { ReactNode } from "react";

function Icon({ children, size = 24 }: { children: ReactNode; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

// Three dots stacked (⋮): "more options", the settings menu.
export function MoreIcon() {
  return (
    <Icon>
      <circle cx="12" cy="5" r="1" />
      <circle cx="12" cy="12" r="1" />
      <circle cx="12" cy="19" r="1" />
    </Icon>
  );
}

export function PencilIcon() {
  return (
    <Icon size={18}>
      <path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z" />
      <path d="m15 5 4 4" />
    </Icon>
  );
}

export function BookIcon() {
  return (
    <Icon>
      <path d="M12 7v14" />
      <path d="M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z" />
    </Icon>
  );
}

// An onigiri: the household's rating (5 of them), filled or empty. Drawn
// for Bentotachi (not Lucide); colours from styles.css (--rice, --nori).
// Website ratings stay ★, so the two are never confused.
export function OnigiriIcon({ size = 14, filled = true }: { size?: number; filled?: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" className={`onigiri ${filled ? "" : "off"}`}>
      <path
        className="onigiri-rice"
        d="M12 2.8c1.2 0 2 .6 2.7 1.7l6.4 10.9c1.4 2.4.2 5.6-3 5.6H5.9c-3.2 0-4.4-3.2-3-5.6L9.3 4.5C10 3.4 10.8 2.8 12 2.8z"
      />
      <rect className="onigiri-nori" x="8.4" y="14.2" width="7.2" height="6.8" rx="1" />
    </svg>
  );
}

// A book with a plus: the top bar's "Add recipe".
export function BookPlusIcon() {
  return (
    <Icon>
      <path d="M12 7v6" />
      <path d="M15 10H9" />
      <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H19a1 1 0 0 1 1 1v18a1 1 0 0 1-1 1H6.5a1 1 0 0 1 0-5H20" />
    </Icon>
  );
}

export function CartIcon({ size = 24 }: { size?: number }) {
  return (
    <Icon size={size}>
      <circle cx="8" cy="21" r="1" />
      <circle cx="19" cy="21" r="1" />
      <path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12" />
    </Icon>
  );
}

export function CompassIcon() {
  return (
    <Icon>
      <circle cx="12" cy="12" r="10" />
      <path d="m16.24 7.76-1.804 5.411a2 2 0 0 1-1.265 1.265L7.76 16.24l1.804-5.411a2 2 0 0 1 1.265-1.265z" />
    </Icon>
  );
}

export function CalendarIcon({ size = 24 }: { size?: number }) {
  return (
    <Icon size={size}>
      <path d="M8 2v4" />
      <path d="M16 2v4" />
      <rect width="18" height="18" x="3" y="4" rx="2" />
      <path d="M3 10h18" />
    </Icon>
  );
}

// Three joined dots: share (Lucide "share-2").
export function ShareIcon({ size = 18 }: { size?: number }) {
  return (
    <Icon size={size}>
      <circle cx="18" cy="5" r="3" />
      <circle cx="6" cy="12" r="3" />
      <circle cx="18" cy="19" r="3" />
      <line x1="8.59" x2="15.42" y1="13.51" y2="17.49" />
      <line x1="15.41" x2="8.59" y1="6.51" y2="10.49" />
    </Icon>
  );
}

// A printer (Lucide "printer").
export function PrintIcon({ size = 18 }: { size?: number }) {
  return (
    <Icon size={size}>
      <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
      <path d="M6 9V3a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v6" />
      <rect x="6" y="14" width="12" height="8" rx="1" />
    </Icon>
  );
}

// A stopwatch: a step's timer (Lucide "timer").
export function TimerIcon({ size = 24 }: { size?: number }) {
  return (
    <Icon size={size}>
      <line x1="10" x2="14" y1="2" y2="2" />
      <line x1="12" x2="15" y1="14" y2="11" />
      <circle cx="12" cy="14" r="8" />
    </Icon>
  );
}

// Chain link: "link to the pantry".
export function LinkIcon() {
  return (
    <Icon size={16}>
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
    </Icon>
  );
}

// Six dots: "drag me".
export function GripIcon() {
  return (
    <Icon size={20}>
      <circle cx="9" cy="12" r="1" />
      <circle cx="9" cy="5" r="1" />
      <circle cx="9" cy="19" r="1" />
      <circle cx="15" cy="12" r="1" />
      <circle cx="15" cy="5" r="1" />
      <circle cx="15" cy="19" r="1" />
    </Icon>
  );
}

export function FridgeIcon() {
  return (
    <Icon>
      <path d="M5 6a4 4 0 0 1 4-4h6a4 4 0 0 1 4 4v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6Z" />
      <path d="M5 10h14" />
      <path d="M15 7v6" />
    </Icon>
  );
}

export function CloseIcon() {
  return (
    <Icon size={18}>
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </Icon>
  );
}

export function PlusIcon() {
  return (
    <Icon>
      <path d="M5 12h14" />
      <path d="M12 5v14" />
    </Icon>
  );
}

// A rubbish bin: "delete".
export function TrashIcon({ size = 24 }: { size?: number }) {
  return (
    <Icon size={size}>
      <path d="M3 6h18" />
      <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
      <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
      <path d="M10 11v6" />
      <path d="M14 11v6" />
    </Icon>
  );
}

export function HeartIcon({ filled = false, size = 20 }: { filled?: boolean; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
    </svg>
  );
}

// Thumbs up: someone's approval of a recipe.
export function ThumbsUpIcon({ filled = false, size = 20 }: { filled?: boolean; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M7 10v12" />
      <path d="M15 5.88 14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2.76a2 2 0 0 0 1.79-1.11L12 2a3.13 3.13 0 0 1 3 3.88Z" />
    </svg>
  );
}

// Thumbs down: someone doesn't like a recipe (see their reasons).
export function ThumbsDownIcon({ filled = false, size = 20 }: { filled?: boolean; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M17 14V2" />
      <path d="M9 18.12 10 14H4.17a2 2 0 0 1-1.92-2.56l2.33-8A2 2 0 0 1 6.5 2H20a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-2.76a2 2 0 0 0-1.79 1.11L12 22a3.13 3.13 0 0 1-3-3.88Z" />
    </svg>
  );
}

// Lightning bolt: "quick".
export function ZapIcon({ filled = false, size = 20 }: { filled?: boolean; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z" />
    </svg>
  );
}

export function TagIcon({ size = 16 }: { size?: number }) {
  return (
    <Icon size={size}>
      <path d="M12.586 2.586A2 2 0 0 0 11.172 2H4a2 2 0 0 0-2 2v7.172a2 2 0 0 0 .586 1.414l8.704 8.704a2.426 2.426 0 0 0 3.42 0l6.58-6.58a2.426 2.426 0 0 0 0-3.42z" />
      <circle cx="7.5" cy="7.5" r=".5" fill="currentColor" />
    </Icon>
  );
}

export function ChevronIcon() {
  return (
    <Icon size={18}>
      <path d="m9 18 6-6-6-6" />
    </Icon>
  );
}

// The recipe timer's Stop, Pause and Resume: filled, like a player's.
export function StopIcon({ size = 14 }: { size?: number }) {
  return (
    <Icon size={size}>
      <rect width="18" height="18" x="3" y="3" rx="2" fill="currentColor" />
    </Icon>
  );
}

export function PauseIcon({ size = 14 }: { size?: number }) {
  return (
    <Icon size={size}>
      <rect x="14" y="3" width="5" height="18" rx="1" fill="currentColor" />
      <rect x="5" y="3" width="5" height="18" rx="1" fill="currentColor" />
    </Icon>
  );
}

export function PlayIcon({ size = 14 }: { size?: number }) {
  return (
    <Icon size={size}>
      <path d="M5 5a2 2 0 0 1 3.008-1.728l11.997 6.998a2 2 0 0 1 .003 3.458l-12 7A2 2 0 0 1 5 19z" fill="currentColor" />
    </Icon>
  );
}

export function CheckIcon({ size = 16 }: { size?: number }) {
  return (
    <Icon size={size}>
      <path d="M20 6 9 17l-5-5" />
    </Icon>
  );
}
