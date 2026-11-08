// What the "?" beside a recipe's Ingredients or Method box explains: the
// headings and formatting its lines can have (formatting marks: softMarks.ts).
import { useSpell } from "./household";

export default function FormattingTips({ part }: { part: "ingredients" | "steps" }) {
  const spell = useSpell();
  return (
    <>
      {part === "ingredients" ? (
        <p>Start a line with # for a heading, like “# For the sauce”.</p>
      ) : (
        <p>
          A line starting with # is a heading that starts the step numbers again at 1 (a separate part, like a sauce); ##
          carries on counting.
        </p>
      )}
      <p>{spell("Select words and press B, I or U to make them bold, soft grey italics or underlined.")}</p>
    </>
  );
}
