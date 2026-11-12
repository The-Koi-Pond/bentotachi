import { useId } from "react";
import type { ShoppingList } from "./pb";

// "To: Party ⌄" in the sheets that add to the shopping list (a recipe's
// ingredients, the plan's, the pantry's), when the household has several.
export default function ShoppingListChoice({
  lists,
  value,
  onChange,
}: {
  lists: Pick<ShoppingList, "id" | "name">[];
  value: string;
  onChange: (id: string) => void;
}) {
  const id = useId();
  if (lists.length < 2) return null;
  return (
    <span className="list-choice">
      <label htmlFor={id}>To</label>
      <select id={id} value={value} onChange={(e) => onChange(e.target.value)}>
        {lists.map((list) => (
          <option key={list.id} value={list.id}>
            {list.name}
          </option>
        ))}
      </select>
    </span>
  );
}
