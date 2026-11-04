import { Link, useLocation } from "react-router";
import type { ReactNode } from "react";
import { BookIcon, CalendarIcon, CartIcon, CompassIcon, FridgeIcon } from "./icons";

const TABS: { to: string; label: string; icon: ReactNode }[] = [
  { to: "/", label: "Recipes", icon: <BookIcon /> },
  { to: "/browse", label: "Browse", icon: <CompassIcon /> },
  { to: "/plan", label: "Plan", icon: <CalendarIcon /> },
  { to: "/shopping", label: "Shopping", icon: <CartIcon /> },
  { to: "/pantry", label: "Pantry", icon: <FridgeIcon /> },
];

// The recipe pages besides the list, which count as the Recipes tab: a
// recipe, adding one, and the shelves.
const RECIPE_PAGES = ["/recipes", "/add", "/new", "/categories"];

// Bottom bar for switching between the app's main sections. A tab's own
// pages light it up; the rest (the fridge door, profile, household,
// backups, import and export, opened from the title or the ⋮ menu) belong
// to no tab.
export default function TabBar() {
  const { pathname } = useLocation();
  const current =
    pathname === "/" || RECIPE_PAGES.some((page) => pathname.startsWith(page))
      ? "/"
      : (TABS.find((tab) => tab.to !== "/" && pathname.startsWith(tab.to))?.to ?? "");

  return (
    <nav className="tabbar" aria-label="Sections">
      {TABS.map((tab) => (
        <Link
          key={tab.to}
          to={tab.to}
          className={current === tab.to ? "active" : ""}
          aria-current={current === tab.to ? "page" : undefined}
        >
          {tab.icon}
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}
