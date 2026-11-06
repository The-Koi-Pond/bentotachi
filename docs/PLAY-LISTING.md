# Google Play store listing

What to put in Play Console's store listing and the forms next to it.
Drafted 2026-11-06 from Google's rules then (the metadata policy and "Add
preview assets"); check Play Console's own wording when filling it in.
The Data safety form has its own file: docs/PLAY-DATA-SAFETY.md.

## Main store listing (Grow users → Store presence → Main store listing)

**App name** (30 characters at most; no "free", "best", emoji or ALL CAPS):

```
Bentotachi: Recipes & Pantry
```

(28 characters. Plain "Bentotachi" works too, but the words after it help
people searching for a recipe app find it.)

**Short description** (80 at most; no emoji, no "download now"):

```
A recipe box, dinner plan, shopping list and pantry for your whole household.
```

**Full description** (4,000 at most; it mustn't repeat the short one):

```
Bentotachi keeps your recipes, the week's dinners, the shopping list and the pantry in one place, starring an onigiri who is fine, actually. He screams a bit. It's fine.

Everything lives on your phone: no sign-up, no cloud, no ads and no tracking, and we never see your recipes. Not even Nonna's prized marinara.

Save recipes from anywhere
Paste a link, share one straight from your browser, or type in Grandma's by hand. Bentotachi skips the blogger's life story and keeps the recipe. Sites that block importing? Open them in Bentotachi's own browser and save the page you're looking at.

Shelves and tags
Desserts, one-pot, "things we make when we're sad": sort recipes onto shelves and tag them however you like.

Plan the week
Plan dinners (and breakfasts and lunches, if you're that organised) and finally settle "didn't we just have that?" Bentotachi remembers what you last had, and when.

One shopping list
Tick a recipe's ingredients and they hop onto one list, sorted by aisle so you're not doubling back for the milk. It even works in the supermarket's no-signal corner.

The pantry
Mark things Have, Low or Out, scan barcodes, keep track of packets if you like, and leave notes like "3 jars, do not buy more". Run out of something and Bentotachi asks whether it should go on the list.

Cook with it
Cooking for six instead of four? The amounts change for you. Tap "10 min" in a step to start a timer, tick off steps as you go, and time how long a recipe really takes.

The fridge door
Leave notes for everyone at home, like an actual fridge, minus the magnets.

Sharing with your household
Bentotachi works on its own on one phone. To share recipes, the plan and the shopping list with the people you live with, run the Bentotachi server on a computer at home (a Raspberry Pi or an old PC will do) and everyone connects to it. The guide on GitHub walks you through it, and your data stays on that computer.

Yours to keep
No subscriptions, no paid features and no ads, ever. Back up whenever you like, or export your recipes to take them elsewhere. Already have recipes in Paprika, Mealie or Tandoor? Bring their export file along.

Made by The Koi Pond, a few friends, for our own households first.
Source code: github.com/The-Koi-Pond/bentotachi
```

The last paragraph names three other recipe apps, only to say their export
files work. Google forbids comparing with other apps, not saying what a
file import reads, but if a reviewer objects, cut that sentence.

## Graphics (all in branding/play/)

| Play Console field | File |
|---|---|
| App icon | `icon-512.png` |
| Feature graphic | `feature-graphic.png` |
| Phone screenshots (upload in this order) | `screenshot-1-recipes.jpg` to `screenshot-8-plan-dark.jpg` |

Feature graphic alt text (140 at most):

```
Ben the onigiri screaming on his chopsticks, beside the Bentotachi title and "Because dinner insists on happening every day."
```

How they're made: `branding/make_play_listing.py` (instructions at its
top). The captions are in Pond Pebbles, like the app's page titles. The screenshots show a made-up household (Sam, Alex and Robin) on a
throwaway server; the recipe photos are public-domain and CC0 photos from
Wikimedia Commons (free to use, no credit needed), the recipes and notes are
invented. No store logos appear anywhere (decided 2026-11-01: logos stay
inside the app). Remake them when the app's look changes noticeably.

## Store settings (Grow users → Store presence → Store settings)

- **Category:** App, Food & Drink.
- **Tags** (up to five, from Google's list): pick the closest to recipes,
  meal planning, shopping list and cooking.
- **Email:** splash@thekoipond.dev
- **Website:** https://thekoipond.dev/bentotachi/
- **Phone:** leave empty.

## App content (Policy and programs → App content)

- **Privacy policy:** https://thekoipond.dev/bentotachi/privacy.html
- **Ads:** No, the app contains no ads.
- **App access:** All functionality is available without special access.
  ("Just me, on this phone" needs no login; connecting to a household
  server is optional and needs the household's own server, which a
  reviewer can't reach anyway.)
- **Target audience:** 18 and over only. The privacy policy says it's a
  household app for adults, not made for children; picking younger ages
  brings Google's Families rules.
- **Content rating questionnaire:** category "Utility, Productivity,
  Communication, or Other". No violence, sexual content, bad language,
  drugs, gambling or the like. Answer **Yes** to users being able to
  interact or share content (people on the same household server share
  recipes, lists and fridge-door notes), and No to sharing location and to
  digital purchases.
- **Data safety:** docs/PLAY-DATA-SAFETY.md.
- **Government apps, financial features, health:** No.
