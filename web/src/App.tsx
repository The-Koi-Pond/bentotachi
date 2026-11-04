import { useEffect } from "react";
import { createHashRouter, Link, Navigate, Route, RouterProvider, Routes, useParams } from "react-router";
import { pb, useCurrentUser } from "./pb";
import Login from "./pages/Login";
import RecipeList, { ManageButton } from "./pages/RecipeList";
import RecipeView from "./pages/RecipeView";
import RecipeEdit from "./pages/RecipeEdit";
import AddRecipe from "./pages/AddRecipe";
import ShoppingList from "./pages/ShoppingList";
import Pantry from "./pages/Pantry";
import Browse from "./pages/Browse";
import MealPlan from "./pages/MealPlan";
import Profile from "./pages/Profile";
import Household from "./pages/Household";
import Categories from "./pages/Categories";
import Backups from "./pages/Backups";
import Export from "./pages/Export";
import SettingsMenu from "./SettingsMenu";
import { PlusIcon } from "./icons";
import TabBar from "./TabBar";
import StepTimerTray from "./StepTimerTray";
import { BentoTitle } from "./Brand";
import { ShareReceiver } from "./shareReceiver";
import { RestoredSaveReceiver } from "./bentoBrowser";
import UpdateBanner from "./UpdateBanner";
import { UnsavedChangesGuard } from "./unsavedChanges";
import { ensureLogin } from "./session";

export default function App() {
  const user = useCurrentUser();

  // Each time the app opens, renew the login so nobody gets signed out while
  // they use it regularly. Only a definite "not allowed" signs them out; a
  // network error (e.g. offline) keeps them logged in (see session.ts).
  useEffect(() => {
    if (!pb.authStore.isValid) return;
    void ensureLogin();
  }, []);

  if (!user) return <Login />;

  return <RouterProvider router={router} />;
}

// Pages are still listed with <Routes> below; the router around them is the
// kind that can stop a page change, so editors can ask before unsaved
// changes are lost (see unsavedChanges.ts).
const router = createHashRouter([{ path: "*", element: <Screens /> }]);

// A recipe's page, fresh for each recipe: going from one recipe straight to
// another (like a step timer in the tray) would otherwise keep the first
// one's ticks, open editor and errors, and the editor's Save would then
// write the first recipe's text into the second.
function OneRecipe({ page: Page }: { page: () => React.JSX.Element | null }) {
  const { id } = useParams();
  return <Page key={id} />;
}

// The top bar's orange +.
function PlusButton({ to, label }: { to: string; label: string }) {
  return (
    <Link to={to} className="icon-button primary" aria-label={label} title={label}>
      <PlusIcon />
    </Link>
  );
}

function Screens() {
  return (
    <>
      <ShareReceiver />
      <RestoredSaveReceiver />
      <UnsavedChangesGuard />
      <header className="topbar">
        <Link to="/" className="brand" aria-label="Bentotachi: back to the recipes">
          <BentoTitle className="brand-title" />
        </Link>
        <nav>
          {/* Manage only applies to the recipe list. */}
          <Routes>
            <Route path="/" element={<ManageButton />} />
            <Route path="*" element={null} />
          </Routes>
          {/* The + adds to the page you're on (Xel, 2026-11-02): a pantry
              item on the pantry, the shopping list's box there, else a recipe. */}
          <Routes>
            <Route path="/pantry" element={<PlusButton to="/pantry?new=1" label="Add a pantry item" />} />
            <Route path="/shopping" element={<PlusButton to="/shopping?new=1" label="Add to the shopping list" />} />
            <Route path="*" element={<PlusButton to="/add" label="Add recipe" />} />
          </Routes>
          <SettingsMenu />
        </nav>
      </header>
      <main>
        <UpdateBanner />
        <Routes>
          <Route path="/" element={<RecipeList />} />
          <Route path="/add" element={<AddRecipe />} />
          <Route path="/new" element={<RecipeEdit />} />
          <Route path="/recipes/:id" element={<OneRecipe page={RecipeView} />} />
          <Route path="/recipes/:id/edit" element={<OneRecipe page={RecipeEdit} />} />
          <Route path="/browse" element={<Browse />} />
          <Route path="/plan" element={<MealPlan />} />
          <Route path="/shopping" element={<ShoppingList />} />
          <Route path="/pantry" element={<Pantry />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/household" element={<Household />} />
          <Route path="/categories" element={<Categories />} />
          <Route path="/backups" element={<Backups />} />
          <Route path="/export" element={<Export />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
      <StepTimerTray />
      <TabBar />
    </>
  );
}
