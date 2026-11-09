import { useEffect } from "react";
import { createHashRouter, Link, Navigate, Route, RouterProvider, Routes, useLocation, useParams } from "react-router";
import { pb, useCurrentUser } from "./pb";
import Login from "./pages/Login";
import RecipeList from "./pages/RecipeList";
import RecipeView from "./pages/RecipeView";
import RecipeEdit from "./pages/RecipeEdit";
import AddRecipe from "./pages/AddRecipe";
import ShoppingList from "./pages/ShoppingList";
import Pantry from "./pages/Pantry";
import Browse from "./pages/Browse";
import MealPlan from "./pages/MealPlan";
import Profile from "./pages/Profile";
import Household from "./pages/Household";
import Shelves from "./pages/Shelves";
import Backups from "./pages/Backups";
import Export from "./pages/Export";
import Fridge from "./pages/Fridge";
import Settings from "./pages/Settings";
import FridgeLink from "./FridgeLink";
import SettingsMenu from "./SettingsMenu";
import { BookPlusIcon } from "./icons";
import TabBar from "./TabBar";
import StepTimerTray from "./StepTimerTray";
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

// The top bar's plum book-with-a-plus: adds a recipe. It used to add to the
// page you were on, but Pantry and the shopping list have their own add box
// at the top, and one button meaning three things was harder to trust than
// one that always means "recipe". Only on the Recipes
// and Browse pages, though: people expected it to add a pantry item on
// the Pantry page.
const ADD_RECIPE_PAGES = ["/", "/browse"];

function AddRecipeButton() {
  const { pathname } = useLocation();
  if (!ADD_RECIPE_PAGES.includes(pathname)) return null;
  return (
    <Link to="/add" className="icon-button primary" aria-label="Add recipe" title="Add recipe">
      <BookPlusIcon />
    </Link>
  );
}

function Screens() {
  return (
    <>
      <ShareReceiver />
      <RestoredSaveReceiver />
      <UnsavedChangesGuard />
      {/* The top bar, then the scrolling part, all above the tab bar
          (pageScroll.ts). */}
      <div className="app-frame">
      <header className="topbar">
        <FridgeLink />
        <nav>
          <AddRecipeButton />
          <SettingsMenu />
        </nav>
      </header>
      <div className="page-scroll">
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
          <Route path="/settings" element={<Settings />} />
          <Route path="/household" element={<Household />} />
          <Route path="/shelves" element={<Shelves />} />
          {/* Its old name, before shelves were called shelves everywhere. */}
          <Route path="/categories" element={<Navigate to="/shelves" replace />} />
          <Route path="/backups" element={<Backups />} />
          <Route path="/export" element={<Export />} />
          <Route path="/fridge" element={<Fridge />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
      </div>
      </div>
      <StepTimerTray />
      <TabBar />
    </>
  );
}
