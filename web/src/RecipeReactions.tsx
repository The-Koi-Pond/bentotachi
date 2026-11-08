import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  averageStars,
  displayName,
  errorMessage,
  pb,
  personStyle,
  recipeRatings,
  useCurrentUser,
  type RecipeRating,
} from "./pb";
import { CloseIcon, HeartIcon, OnigiriIcon, PlusIcon, ThumbsDownIcon, ThumbsUpIcon } from "./icons";
import { addReasons, MAX_REASON_LENGTH, MAX_REASONS, suggestedReasons } from "./dislikeReasons";
import { useSingleUser, useSpell } from "./household";

type Mine = Pick<RecipeRating, "stars" | "favorite" | "approved" | "disliked" | "dislike_reasons">;

// Everyone's ratings for one recipe, plus a way to change your own. The
// recipe page holds this, so the heart on the photo and the "What we think"
// box share it.
export function useRecipeRatings(recipeId: string) {
  const me = useCurrentUser();
  const [ratings, setRatings] = useState<RecipeRating[] | null>(null);
  const [error, setError] = useState("");
  // Making your row, on a recipe you hadn't rated: kept (once it's made
  // too), so a quick second tap waits for it and changes that row, rather
  // than changing a row with no id yet. Forgotten if it fails.
  const creating = useRef<Promise<RecipeRating> | null>(null);

  useEffect(() => {
    creating.current = null;
    if (!recipeId) return;
    recipeRatings()
      .getFullList({ filter: pb.filter("recipe = {:id}", { id: recipeId }), expand: "user" })
      .then(setRatings)
      .catch((err) => setError(errorMessage(err)));
  }, [recipeId]);

  const mine = ratings?.find((r) => r.user === me?.id);

  // Changes your own row, showing the change straight away and undoing it
  // if the server says no.
  async function saveMine(patch: Partial<Mine>) {
    if (!me || !ratings) return;
    setError("");
    const before = ratings;
    const draft = {
      ...(mine ?? {
        id: "",
        recipe: recipeId,
        user: me.id,
        stars: 0,
        favorite: false,
        approved: false,
        disliked: false,
        dislike_reasons: [],
      }),
      ...patch,
      expand: { user: me },
    } as RecipeRating;
    setRatings([...ratings.filter((r) => r.user !== me.id), draft]);
    try {
      // (`mine` may be the shown-straight-away copy, with no id.)
      const id = creating.current ? (await creating.current).id : mine?.id;
      let saved: RecipeRating;
      if (id) {
        saved = await recipeRatings().update(id, patch, { expand: "user" });
      } else {
        const create = recipeRatings().create(
          { recipe: recipeId, user: me.id, stars: 0, favorite: false, approved: false, ...patch },
          { expand: "user" }
        );
        creating.current = create;
        create.catch(() => {
          if (creating.current === create) creating.current = null;
        });
        saved = await create;
      }
      setRatings((current) => [...(current ?? []).filter((r) => r.user !== me.id), saved]);
    } catch (err) {
      setRatings(before);
      setError(errorMessage(err));
    }
  }

  return { ratings, mine, me, error, saveMine };
}

export type RecipeRatingsState = ReturnType<typeof useRecipeRatings>;

// The favorite heart: outline when off, filled pink when on. `onPhoto` gives
// it a round backdrop so it shows up over a picture.
export function FavoriteHeart({ state, onPhoto = false }: { state: RecipeRatingsState; onPhoto?: boolean }) {
  const spell = useSpell();
  const on = state.mine?.favorite ?? false;
  if (!state.ratings) return null;
  return (
    <button
      className={`heart-toggle ${onPhoto ? "on-photo" : ""}`}
      aria-pressed={on}
      aria-label={spell("Favourite")}
      title={spell(on ? "One of your favourites" : "Add to your favourites")}
      onClick={() => void state.saveMine({ favorite: !on })}
    >
      <HeartIcon filled={on} size={24} />
    </button>
  );
}

// The ratings box: your onigiri (stored as `stars`) with your thumbs up and thumbs down beside
// them (and the heart too, when the recipe has no photo to put it on), then
// the average and everyone's pills. The thumbs up is stored as "approved"
// (it used to be shown as a seal of approval). With your thumbs down on, you
// can list why as tags; tapping someone's pill shows theirs.
export default function RecipeReactions({ state, showHeart }: { state: RecipeRatingsState; showHeart: boolean }) {
  const { ratings, mine, me, error, saveMine } = state;
  // Whose thumbs-down reasons are showing (a user id), if anyone's.
  const [showingReasons, setShowingReasons] = useState<string | null>(null);
  // Alone, the pills would only repeat your own stars.
  const singleUser = useSingleUser();
  if (!ratings || !me) return error ? <p className="error">{error}</p> : null;

  const average = averageStars(ratings);
  // Everyone who gave stars or a thumbs up or down: one pill each.
  const reactions = ratings
    .filter((r) => r.stars > 0 || r.approved || r.disliked)
    .sort((a, b) => displayName(a.expand?.user).localeCompare(displayName(b.expand?.user)));
  const nameOf = (r: RecipeRating) => (r.user === me.id ? "You" : displayName(r.expand?.user));
  const reasonsOf = (r: RecipeRating) => (r.disliked ? r.dislike_reasons ?? [] : []);
  // "Sam: 2 stars, thumbs down", for hovering and screen readers.
  const describe = (r: RecipeRating) => {
    const parts: string[] = [];
    if (r.stars > 0) parts.push(`${r.stars} of 5 onigiri`);
    if (r.approved) parts.push("thumbs up");
    if (r.disliked) parts.push("thumbs down");
    return `${nameOf(r)}: ${parts.join(", ")}`;
  };
  const shown = reactions.find((r) => r.user === showingReasons && reasonsOf(r).length > 0);

  return (
    <section className="reactions" aria-label="Ratings">
      <div className="reaction-row">
        <OnigiriPicker value={mine?.stars ?? 0} onChange={(stars) => void saveMine({ stars })} />
        <span className="reaction-toggles">
          {/* Filled in your own color once you've chosen it. Up and down are
              either/or: choosing one takes back the other. */}
          <button
            className="thumb-toggle"
            style={personStyle(me)}
            aria-pressed={mine?.approved ?? false}
            aria-label="Thumbs up"
            title={mine?.approved ? "Take back your thumbs up" : "Give it a thumbs up"}
            onClick={() => void saveMine(mine?.approved ? { approved: false } : { approved: true, disliked: false })}
          >
            <ThumbsUpIcon filled={mine?.approved} size={24} />
          </button>
          <button
            className="thumb-toggle"
            style={personStyle(me)}
            aria-pressed={mine?.disliked ?? false}
            aria-label="Thumbs down"
            title={mine?.disliked ? "Take back your thumbs down" : "Give it a thumbs down"}
            onClick={() => void saveMine(mine?.disliked ? { disliked: false } : { disliked: true, approved: false })}
          >
            <ThumbsDownIcon filled={mine?.disliked} size={24} />
          </button>
          {showHeart && <FavoriteHeart state={state} />}
        </span>
      </div>

      {mine?.disliked && (
        <ReasonsEditor
          userId={me.id}
          reasons={mine.dislike_reasons ?? []}
          onChange={(dislike_reasons) => void saveMine({ dislike_reasons })}
        />
      )}

      <p className="muted rating-summary">
        {average === null ? (
          reactions.length === 0 && "No ratings yet"
        ) : (
          <span>
            <OnigiriIcon /> {average} average
          </span>
        )}
        {/* One pill per person, in their color: their name, their stars,
            plus 👍 or 👎. A pill with thumbs-down reasons can be tapped to
            show them. */}
        {!singleUser && reactions.map((r) => {
          const content = (
            <>
              <span className="rating-pill-name">{nameOf(r)}</span>
              {r.stars > 0 && (
                <span>
                  <OnigiriIcon size={11} /> {r.stars}
                </span>
              )}
              {r.approved && <ThumbsUpIcon filled size={11} />}
              {r.disliked && <ThumbsDownIcon filled size={11} />}
            </>
          );
          if (reasonsOf(r).length === 0) {
            return (
              <span
                key={r.id || "mine"}
                className="rating-pill"
                style={personStyle(r.expand?.user)}
                role="img"
                aria-label={describe(r)}
                title={describe(r)}
              >
                {content}
              </span>
            );
          }
          return (
            <button
              key={r.id || "mine"}
              type="button"
              className="rating-pill has-reasons"
              style={personStyle(r.expand?.user)}
              aria-expanded={showingReasons === r.user}
              aria-label={`${describe(r)}. Show why`}
              title={`${describe(r)}. Tap to see why`}
              onClick={() => setShowingReasons(showingReasons === r.user ? null : r.user)}
            >
              {content}
            </button>
          );
        })}
      </p>

      {shown && (
        <div className="dislike-reasons" style={personStyle(shown.expand?.user)} role="status">
          <span>
            <span className="person-name">
              {shown.user === me.id ? "You don't" : `${displayName(shown.expand?.user)} doesn't`}
            </span>{" "}
            like:
          </span>
          <ul className="reason-tags">
            {reasonsOf(shown).map((reason) => (
              <li key={reason} className="reason-tag">
                {reason}
              </li>
            ))}
          </ul>
        </div>
      )}

      {error && <p className="error">{error}</p>}
    </section>
  );
}

// "What don't you like about it?": your reasons as tags, with ✕ to remove
// one and a + at the end to add more. The + turns into a small box right in
// the row (Enter or a comma adds a tag and keeps it open for another; Escape
// or tapping elsewhere closes it), with one-tap suggestions from reasons
// you've given on other recipes while it's open. Saved as you go.
function ReasonsEditor({
  userId,
  reasons,
  onChange,
}: {
  userId: string;
  reasons: string[];
  onChange: (reasons: string[]) => void;
}) {
  const [text, setText] = useState("");
  const [adding, setAdding] = useState(false);
  const [usedBefore, setUsedBefore] = useState<string[][]>([]);

  useEffect(() => {
    // Suggestions are a bonus; the editor works without them.
    recipeRatings()
      .getFullList({ filter: pb.filter("user = {:id} && disliked = true", { id: userId }), fields: "dislike_reasons" })
      .then((list) => setUsedBefore(list.map((r) => r.dislike_reasons ?? [])))
      .catch(() => {});
  }, [userId]);

  function add(typed: string) {
    const next = addReasons(reasons, typed);
    setText("");
    if (next.length !== reasons.length) onChange(next);
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    add(text);
  }

  // Closing the box keeps whatever was typed.
  function finish() {
    if (text.trim()) add(text);
    setAdding(false);
  }

  const suggestions = suggestedReasons(usedBefore, reasons);
  const full = reasons.length >= MAX_REASONS;

  return (
    <div className="reasons-editor">
      <span className="reasons-question">What don't you like about it?</span>
      <ul className="reason-tags">
        {reasons.map((reason) => (
          <li key={reason} className="reason-tag">
            {reason}
            <button
              type="button"
              aria-label={`Remove “${reason}”`}
              onClick={() => onChange(reasons.filter((r) => r !== reason))}
            >
              <CloseIcon />
            </button>
          </li>
        ))}
        {!full && !adding && (
          <li>
            <button
              type="button"
              className={`reason-add ${reasons.length ? "" : "with-text"}`}
              onClick={() => setAdding(true)}
              aria-label="Add a reason"
              title="Add a reason"
            >
              <PlusIcon />
              {reasons.length === 0 && <span>Add a reason</span>}
            </button>
          </li>
        )}
        {!full && adding && (
          <li className="reason-tag reason-typing">
            <form onSubmit={submit}>
              <input
                value={text}
                onChange={(e) => {
                  // A comma finishes a tag, like pressing Enter.
                  if (e.target.value.includes(",")) add(e.target.value);
                  else setText(e.target.value);
                }}
                onBlur={finish}
                onKeyDown={(e) => {
                  if (e.key === "Escape") {
                    e.preventDefault();
                    finish();
                  }
                }}
                maxLength={MAX_REASON_LENGTH}
                placeholder="baked pineapple"
                aria-label="Add a reason you don't like it"
                enterKeyHint="done"
                autoFocus
              />
            </form>
          </li>
        )}
      </ul>
      {adding && suggestions.length > 0 && (
        <div className="filter-chips" role="group" aria-label="Reasons you've used before">
          {suggestions.map((reason) => (
            <button
              key={reason}
              type="button"
              // Keep the typing box focused (and open) while tapping these.
              onPointerDown={(e) => e.preventDefault()}
              onClick={() => add(reason)}
            >
              + {reason}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// Five tappable onigiri (the household's rating; a website's is ★).
// Tapping the one you already chose clears it. Stored as `stars`, 0 to 5.
function OnigiriPicker({ value, onChange }: { value: number; onChange: (stars: number) => void }) {
  return (
    <div className="onigiri-picker" role="group" aria-label="Your rating">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          aria-label={`${n} of 5 onigiri`}
          aria-pressed={value === n}
          onClick={() => onChange(value === n ? 0 : n)}
        >
          <OnigiriIcon size={28} filled={n <= value} />
        </button>
      ))}
    </div>
  );
}
