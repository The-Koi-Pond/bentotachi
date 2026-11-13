// The top bar's ‹ before the logo, on every page a step in from a tab (a
// recipe, its editor, Add recipe, the settings pages), so the way back
// shows (a tester didn't know to tap Recipes again). docs/PLAN.md, "Next
// up: from a tester's report".
import { useLocation } from "react-router";
import { BackIcon } from "./icons";
import { isTabPage } from "./pageParents";
import { useGoBack } from "./useGoBack";

export default function BackButton() {
  const { pathname } = useLocation();
  const goBack = useGoBack();
  if (isTabPage(pathname)) return null;
  return (
    <button type="button" className="icon-button back-button" onClick={goBack} aria-label="Back" title="Back">
      <BackIcon />
    </button>
  );
}
