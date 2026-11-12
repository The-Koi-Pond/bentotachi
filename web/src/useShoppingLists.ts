import { useState } from "react";
import type { ShoppingList } from "./pb";
import { useLiveRecords } from "./useLiveRecords";
import { shoppingListsCopy } from "./offline";
import { mainListId, openList, orderedLists, rememberOpenList } from "./shoppingLists";

// The household's shopping lists, live, main one first (shoppingLists.ts),
// and the one open on this phone: the list page shows it, and adding from a
// recipe, the plan or the pantry goes to it. Picking one anywhere is
// remembered for all of them. Before the lists load (or from a server
// without them) there's just the main list, as "".
export function useShoppingLists() {
  const live = useLiveRecords<ShoppingList>("shopping_lists", { copy: shoppingListsCopy });
  const lists = orderedLists(live.items ?? []);
  const mainId = mainListId(lists);
  const [picked, setPicked] = useState<string | null>(null);
  const open = picked && lists.some((list) => list.id === picked) ? picked : openList(lists);
  return {
    live,
    lists,
    mainId,
    open,
    // Several lists: the menus and "To:" pickers show only then.
    several: lists.length > 1,
    nameOf: (id: string) => lists.find((list) => list.id === (id || mainId))?.name ?? "",
    choose(id: string) {
      setPicked(id);
      rememberOpenList(id, lists);
    },
  };
}
