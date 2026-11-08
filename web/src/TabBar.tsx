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
const RECIPE_PAGES = ["/recipes", "/add", "/new", "/shelves"];

// Bottom bar for switching between the app's main sections. A tab's own
// pages light it up; the rest (the fridge door, profile, household,
// backups, import and export, opened from the title or the ⋮ menu) belong
// to no tab.
// Where you last were in the Recipes tab (a recipe, or the list with its
// filters), so leaving for Shopping and tapping Recipes again goes back
// there (Xel, 2026-11-08). Tapping Recipes while in it goes to the list.
let lastRecipesPlace = "/";

export default function TabBar() {
  const { pathname, search } = useLocation();
  const current =
    pathname === "/" || RECIPE_PAGES.some((page) => pathname.startsWith(page))
      ? "/"
      : (TABS.find((tab) => tab.to !== "/" && pathname.startsWith(tab.to))?.to ?? "");
  if (current === "/") lastRecipesPlace = pathname + search;
  const target = (tab: string) => (tab === "/" && current !== "/" ? lastRecipesPlace : tab);

  return (
    <nav className="tabbar" aria-label="Sections">
      {TABS.map((tab) => (
        <Link
          key={tab.to}
          to={target(tab.to)}
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
