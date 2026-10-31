import { useEffect } from "react";
import { createHashRouter, Link, Navigate, Route, RouterProvider, Routes } from "react-router";
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
import SettingsMenu from "./SettingsMenu";
import { PlusIcon } from "./icons";
import TabBar from "./TabBar";
import { BentoTitle } from "./Brand";
import { ShareReceiver } from "./shareReceiver";
import { forgetOfflineCopy } from "./offline";
import UpdateBanner from "./UpdateBanner";
import { UnsavedChangesGuard } from "./unsavedChanges";

export default function App() {
  const user = useCurrentUser();

  // Each time the app opens, renew the login so nobody gets signed out while
  // they use it regularly. Only a definite "not allowed" signs them out; a
  // network error (e.g. offline) keeps them logged in.
  useEffect(() => {
    if (!pb.authStore.isValid) return;
    pb.collection("users")
      .authRefresh()
      .catch((err) => {
        if (err.status === 401 || err.status === 403) {
          forgetOfflineCopy();
          pb.authStore.clear();
        }
      });
  }, []);

  if (!user) return <Login />;

  return <RouterProvider router={router} />;
}

// Pages are still listed with <Routes> below; the router around them is the
// kind that can stop a page change, so editors can ask before unsaved
// changes are lost (see unsavedChanges.ts).
const router = createHashRouter([{ path: "*", element: <Screens /> }]);

function Screens() {
  return (
    <>
      <ShareReceiver />
      <UnsavedChangesGuard />
      <header className="topbar">
        <Link to="/" className="brand" aria-label="Bento: back to the recipes">
          <BentoTitle className="brand-title" />
        </Link>
        <nav>
          {/* Manage only applies to the recipe list. */}
          <Routes>
            <Route path="/" element={<ManageButton />} />
            <Route path="*" element={null} />
          </Routes>
          <Link to="/add" className="icon-button primary" aria-label="Add recipe" title="Add recipe">
            <PlusIcon />
          </Link>
          <SettingsMenu />
        </nav>
      </header>
      <main>
        <UpdateBanner />
        <Routes>
          <Route path="/" element={<RecipeList />} />
          <Route path="/add" element={<AddRecipe />} />
          <Route path="/new" element={<RecipeEdit />} />
          <Route path="/recipes/:id" element={<RecipeView />} />
          <Route path="/recipes/:id/edit" element={<RecipeEdit />} />
          <Route path="/browse" element={<Browse />} />
          <Route path="/plan" element={<MealPlan />} />
          <Route path="/shopping" element={<ShoppingList />} />
          <Route path="/pantry" element={<Pantry />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/household" element={<Household />} />
          <Route path="/categories" element={<Categories />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
      <TabBar />
    </>
  );
}
