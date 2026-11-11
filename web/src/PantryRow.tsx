// One pantry item in its place's card, in either layout:
// - Simple: one line, the name (with an expiry warning if it's soon or past)
//   and how much we have.
// - Detailed: the photo (or a tile with its first letter), the name, its
//   brand and note on one muted line, then Opened and the store links.
//   With packets in stock, a counter per kind ("In stock: − 3 × 400 g +").
// Both show the shopping list as an icon beside the level: a cart when it's
// on the list, a dashed "+ cart" button when it's low or out and isn't.
import { pantryPhotoUrl, type PantryItem, type PantryPacket, type PantryStatus } from "./pb";
import StockLabels from "./StockLabels";
import { CartIcon, LevelJar } from "./icons";
import { describeExpiry, shortExpiry } from "./expiry";
import { itemExpiry } from "./pantryGroups";
import { brandBesideName, storeLinksOf } from "./pantryItem";
import StoreLink from "./StoreLink";
import { useKeptPhoto } from "./KeptPhotos";

export type PantryLayout = "simple" | "detailed";

const STATUS_WORDS: Record<PantryStatus, string> = { have: "Have", low: "Low", out: "Out" };

export default function PantryRow({
  item,
  layout,
  onList,
  packets = [],
  onFinishPacket,
  onSavePacket,
  expanded,
  onEdit,
  onStatus,
  onAddToList,
}: {
  item: PantryItem;
  layout: PantryLayout;
  onList: boolean;
  // Its packets in stock, oldest first (pantryPackets.ts).
  packets?: PantryPacket[];
  onFinishPacket: (packet: PantryPacket) => void;
  onSavePacket: (packet: PantryPacket, changes: Partial<PantryPacket>) => Promise<boolean>;
  // Tapping the name: the pantry page opens its card (PantryCard.tsx), a
  // scan result its full form. `expanded`: its card is open (said to screen
  // readers).
  expanded?: boolean;
  onEdit: () => void;
  onStatus: (status: PantryStatus) => void;
  onAddToList: () => void;
}) {
  const detailed = layout === "detailed";
  const photo = pantryPhotoUrl(item);
  // A photo that won't load (no connection, and none kept on the phone):
  // its letter tile instead, until the server answers again.
  const shownPhoto = useKeptPhoto(photo);
  const expiry = itemExpiry(item);
  // Simple only warns: a date weeks away isn't news.
  const showExpiry = expiry && (detailed || expiry !== "later");
  const brand = brandBesideName(item);
  const note = item.note?.trim() ?? "";
  // The name button's label says everything the name block shows.
  const label = [`Open ${item.name}`, detailed && brand, detailed && note, showExpiry && describeExpiry(item.expires)]
    .filter(Boolean)
    .join(", ");

  const name = (
    <button className="pantry-name" onClick={onEdit} aria-label={label} aria-expanded={expanded}>
      <span className="pantry-name-line">
        <span className="pantry-name-text">{item.name}</span>
        {showExpiry && (
          <span className={`badge expiry-badge expiry-badge-${expiry}`} title={describeExpiry(item.expires)}>
            {shortExpiry(item.expires)}
          </span>
        )}
      </span>
      {detailed && (brand || note) && <span className="pantry-sub">{[brand, note].filter(Boolean).join(" · ")}</span>}
    </button>
  );

  const end = (
    <span className="pantry-end">
      {item.status !== "have" &&
        (onList ? (
          <span className="pantry-on-list" role="img" aria-label="On the shopping list" title="On the shopping list">
            <CartIcon size={18} />
          </span>
        ) : (
          <button
            className="pantry-add-to-list"
            onClick={onAddToList}
            aria-label={`Add ${item.name} to the shopping list`}
            title="Add to the shopping list"
          >
            +<CartIcon size={15} />
          </button>
        ))}
      <StatusMeter name={item.name} status={item.status} onChange={onStatus} />
    </span>
  );

  if (!detailed)
    return (
      <div className="pantry-row simple">
        {name}
        {end}
      </div>
    );

  const storeLinks = storeLinksOf(item);
  return (
    <div className="pantry-row detailed">
      {photo && !shownPhoto.gaveUp ? (
        <img key={photo} className="pantry-thumb" src={shownPhoto.src} alt="" loading="lazy" onError={shownPhoto.onError} />
      ) : (
        <span className="pantry-thumb pantry-tile" aria-hidden="true">
          {item.name.trim().charAt(0).toUpperCase()}
        </span>
      )}
      <div className="pantry-top">
        {name}
        {end}
      </div>
      {/* Across the whole row, under the photo too. */}
      {packets.length > 0 && (
        <div className="pantry-stock" role="group" aria-label={`${item.name} in stock`}>
          <StockLabels packets={packets} onUsed={onFinishPacket} onSave={onSavePacket} />
        </div>
      )}
      {storeLinks.length > 0 && (
        <span className="pantry-extra">
          {storeLinks.map((link) => (
            <StoreLink key={link} url={link} itemName={item.name} />
          ))}
        </span>
      )}
    </div>
  );
}

// How much we have, as a level (a jar: full and green for Have, a little
// amber for Low, empty and red for Out) with the word. Have is quiet (no
// outline) so Low and Out stand out. Tapping it opens the phone's own list
// of the three: a real dropdown underneath, laid over the level and
// see-through, so it works with every screen reader and keyboard.
function StatusMeter({
  name,
  status,
  onChange,
}: {
  name: string;
  status: PantryStatus;
  onChange: (status: PantryStatus) => void;
}) {
  return (
    <span className={`status-meter status-meter-${status}`}>
      <LevelJar level={status} />
      <span aria-hidden="true">{STATUS_WORDS[status]}</span>
      <span className="meter-caret" aria-hidden="true">
        ▾
      </span>
      <select
        value={status}
        aria-label={`How much ${name} we have`}
        onChange={(e) => onChange(e.target.value as PantryStatus)}
      >
        {(Object.keys(STATUS_WORDS) as PantryStatus[]).map((value) => (
          <option key={value} value={value}>
            {STATUS_WORDS[value]}
          </option>
        ))}
      </select>
    </span>
  );
}
