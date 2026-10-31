import SoftText from "./SoftText";
import { noteBlocks } from "./noteItems";

// Notes shown like the method: each numbered or dashed note in its own box,
// with its number (or a dot) beside it (see noteItems.ts).
export default function NoteList({ text }: { text: string }) {
  return (
    <div className="note-list">
      {noteBlocks(text).map((block, i) => {
        if (block.kind === "heading")
          return (
            <p key={i} className="list-heading">
              <SoftText text={block.text} />
            </p>
          );
        const lines = block.lines.map((line, j) => (
          <p key={j}>
            <SoftText text={line} />
          </p>
        ));
        if (block.kind === "text")
          return (
            <div key={i} className="note-text">
              {lines}
            </div>
          );
        return (
          <div key={i} className="note-item">
            {block.number ? <span className="step-number">{block.number}</span> : <span className="note-bullet" aria-hidden="true" />}
            <div className="note-lines">{lines}</div>
          </div>
        );
      })}
    </div>
  );
}
