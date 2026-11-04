import { Link } from "react-router";
import { pb, type Note } from "./pb";
import { useLiveRecords } from "./useLiveRecords";
import { unreadNotes } from "./fridgeDoor";
import { useFridgeSeen } from "./fridgeSeen";
import { BentoTitle } from "./Brand";
import { NoteIcon } from "./icons";

// The title in the top bar: it opens the fridge door (pages/Fridge.tsx). The
// note beside it says it's a way in, and counts notes someone else left
// since this phone last looked (decided with Xel, 2026-11-04).
export default function FridgeLink() {
  const list = useLiveRecords<Note>("notes");
  const seen = useFridgeSeen();
  const unread = unreadNotes(list.items ?? [], pb.authStore.record?.id, seen);
  const label = unread
    ? `Bentotachi: the fridge door, ${unread} new ${unread === 1 ? "note" : "notes"}`
    : "Bentotachi: the fridge door";

  return (
    <Link to="/fridge" className="brand" aria-label={label} title="The fridge door">
      <BentoTitle className="brand-title" />
      <span className="brand-note" aria-hidden="true">
        <NoteIcon size={18} />
        {unread > 0 && <span className="brand-note-count">{unread > 9 ? "9+" : unread}</span>}
      </span>
    </Link>
  );
}
