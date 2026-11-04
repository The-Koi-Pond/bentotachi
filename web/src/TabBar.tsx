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

// Bottom bar for switching between the app's main sections. Anything that
// isn't another tab's page (a recipe, the add page...) counts as Recipes,
// except the fridge door (the title opens it), which belongs to no tab.
export default function TabBar() {
  const { pathname } = useLocation();
  const current = pathname.startsWith("/fridge")
    ? ""
    : (TABS.find((tab) => tab.to !== "/" && pathname.startsWith(tab.to))?.to ?? "/");

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
