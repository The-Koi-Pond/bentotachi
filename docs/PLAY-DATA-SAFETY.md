# Google Play's Data safety form: Bentotachi's answers

Play Console → your app → **Policy and programs → App content → Data
safety**. The answers below follow the form's screens in order. When the app
starts doing something new with people's data, update the
[privacy policy](https://thekoipond.dev/bentotachi/privacy.html) and this
file, then the form.

Drafted 2026-11-06 from Google's help page "Provide information for Google
Play's Data safety section" (support.google.com/googleplay/android-developer/answer/10787469)
and ML Kit's data disclosure page (developers.google.com/ml-kit/android-data-disclosure).
Check the wording in Play Console when you fill it in; Google changes it.

## The reasoning, in short

- **Google's "collect" means "transmitting data from your app off a user's
  device"**, to anyone, not just to the developer. Phone-only mode sends
  nothing off the phone (exempt: "only processed locally on the user's
  device"). With a household server, the app sends names, recipes, photos
  and so on to that server. Google has no exception for a server the user
  runs themselves, so that counts as collected, even though The Koi Pond
  never sees it. Every type is marked **optional**, since people can use
  Bentotachi on their phone only.
- **Not "shared"**: logging in to a household server is the user's own
  choice, which Google exempts ("a specific user-initiated action, where
  the user reasonably expects the data to be shared").
- **Google's barcode scanner** (play-services-code-scanner, with auto zoom
  on) sends Google some data about the scanner: device and app details, a
  scanning-session ID, performance and error codes, zoom and where the
  barcode was. Google says the app must declare what its libraries collect.
  Not shared (Google doesn't pass it on), sent over HTTPS.
- **Not declared, as it isn't data about the user**: the barcode number
  sent to Open Food Facts, and the web pages Bentotachi fetches (a recipe
  link, a store's product page) when asked to. Opening a website in the
  browser is exempt too.
- **Encrypted in transit: No.** Google only allows "Yes" if *all* collected
  data is encrypted. Household servers on home Wi-Fi use plain http (see
  docs/REVIEW.md, "plain http"). If Bentotachi ever requires https, this
  can become Yes.
- Backups saved to Google Drive (or anywhere) through Android's file picker
  aren't collection: Google exempts a user uploading to their own cloud
  storage when the app never sees it.

## Screen 1: Data collection and security

| Question | Answer |
|---|---|
| Does your app collect or share any of the required user data types? | **Yes** |
| Is all of the user data collected by your app encrypted in transit? | **No** |
| Which of the following methods of account creation does your app support? | **Username and password** |
| Delete account URL | `https://thekoipond.dev/bentotachi/delete-account.html` |
| Do you provide a way for users to request that some or all of their data is deleted, without requiring them to delete their account? | **Yes** (recipes, notes, lists and photos can each be deleted in the app). If it asks for a URL, the same deletion page. |

## Screen 2: Data types

Tick only these:

- **Personal info:** Name, Email address, User IDs
- **Messages:** Other in-app messages (fridge-door notes: household members
  writing to each other; added 2026-11-07 when filling in the form)
- **Photos and videos:** Photos
- **Files and docs:** Files and docs (a saved web page to import a recipe from)
- **App activity:** Other user-generated content (recipes, ratings, the plan, lists, the pantry)
- **App info and performance:** Diagnostics (Google's scanner)
- **Device or other IDs:** Device or other IDs (Google's scanner)

Leave everything else unticked: location, contacts, messages, audio,
health, financial info, calendar, web browsing, installed apps, and the
rest of the types under the ticked groups.

## Screen 3: Data usage and handling (one card per ticked type)

Every card: **Collected** yes, **Shared** no, **Is this data processed
ephemerally?** No, **Is this data required for your app, or can users
choose whether it's collected?** Users can choose whether this data is
collected (optional).

| Type | Why is this user data collected? (purposes) |
|---|---|
| Name | App functionality, Account management |
| Email address | Account management |
| User IDs | App functionality, Account management |
| Other in-app messages | App functionality |
| Photos | App functionality |
| Files and docs | App functionality |
| Other user-generated content | App functionality |
| Diagnostics | Analytics (Google's scanner, "for diagnostics and usage analytics") |
| Device or other IDs | Analytics (the same) |

## What the store listing will then show

Roughly: "No data shared with third parties", "This app may collect these
data types: Personal info, Messages, Photos and videos, Files and docs, App activity,
App info and performance, Device or other IDs", "Data isn't encrypted",
"You can request that data be deleted". The store description can explain
that "collect" here means "sends to your own household server".
