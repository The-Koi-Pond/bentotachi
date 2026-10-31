import { Fragment, type ReactNode } from "react";
import { softParts } from "./softMarks";

// Recipe text with its *soft* words as grey italics, **bold** words bold and
// __underlined__ words underlined (or a mix). One <span> around it all, so a
// flex row (like an ingredient's checkbox and text) keeps the text together
// instead of splitting it into columns.
export default function SoftText({ text }: { text: string }) {
  return (
    <span>
      {softParts(text).map((part, i) => {
        let node: ReactNode = part.text;
        if (part.marks.includes("underline")) node = <u>{node}</u>;
        if (part.marks.includes("bold")) node = <strong>{node}</strong>;
        if (part.marks.includes("soft")) node = <em className="soft">{node}</em>;
        return <Fragment key={i}>{node}</Fragment>;
      })}
    </span>
  );
}
