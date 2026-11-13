// Going back a page from inside the app: to where you came from, as
// Android's back does, or, with nothing in the app to go back to (opened
// from a link, or the app started there), up a level (pageParents.ts), in
// place of this page so Back doesn't return to it.
import { useLocation, useNavigate } from "react-router";
import { parentOf } from "./pageParents";

export function useGoBack(): () => void {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  return () => {
    const index = (window.history.state as { idx?: number } | null)?.idx ?? 0;
    if (index > 0) void navigate(-1);
    else void navigate(parentOf(pathname), { replace: true });
  };
}
