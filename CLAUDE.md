# Bible Study App — "Starting with Christ"

A personal devotional web app built for Neptune. Single HTML file, fully offline-capable, with optional cloud sync across devices.

**Live URL:** https://averyscove.github.io/bible-study/
**Repo:** https://github.com/Averyscove/bible-study (public)
**Hosting:** GitHub Pages (free, unlimited static hosting)
**Cost to run:** $0/month

## What it does

A guided 5-phase Bible reading plan focused on Christ:
- Phase 1 — Gospel of John (21 chapters)
- Phase 2 — Romans (16 chapters)
- Phase 3 — Luke (24 chapters)
- Phase 4 — Acts (28 chapters)
- Phase 5 — Selected Old Testament passages (13 entries)
- Plus 8 memory verses with practice mode
- Plus a Core Message + Read Questions checklist

The user reads or listens to chapters, taps a verse to bookmark it, writes reflection notes (4 prompts: about Jesus / what stood out / question / prayer), and the app tracks completion, streaks, time spent, and bookmarks.

After each chapter the app shows a **Reading Companion** card with a Summary, 2-3 Key Lessons, and a "Hold in Tension" counterweight (modeled after Robert Greene's Lesson + Reversal pattern, adapted for scripture).

## Files in this folder

```
Bible Study/
├── index.html      ← the entire app, ~770KB, all chapters & commentary inline
├── sw.js           ← service worker for guaranteed offline
└── CLAUDE.md       ← this file
```

That's it. Everything the app needs is in those two files.

## Architecture decisions

**Single HTML file with inline data.** No build step at runtime, no dependencies, no API calls for Bible text. Loads in <1 second. Works fully offline once cached.

**Service worker for offline.** `sw.js` caches `index.html` and serves from cache when offline. Cache version is bumped on each update; new version triggers an "Update available" banner in the app.

**Firebase for cross-device sync (optional).** Email/password login + Firestore database. Free tier is plenty for this use case (50K reads/day, 20K writes/day, 1GB storage). The app works fully without an account — sync is opt-in via the Sign In screen, with "Continue without account" available as an escape hatch.

**Localstorage as source of truth on each device.** Cloud sync is a *backup and replication layer*, not a remote database. Every change writes to localStorage first; remote save is debounced (1.2s) and runs in the background. Critical actions like marking a chapter complete save immediately. App flushes pending writes on visibilitychange/pagehide.

**Merge, not last-write-wins.** When two devices have different state, sync merges them (union of progress, notes, bookmarks, etc.). This means an empty/fresh device can never erase work from another device — once a chapter is done somewhere, it stays done everywhere. See `mergeStates()` in the code for specifics.

**Bible text source: World English Bible (WEB), public domain.** Fetched once at build time from the `pythonbible-web` Python package. Embedded as a JS object in `index.html`. ~3,900 verses, ~450KB. NLT/ESV/NKJV are copyrighted and would require licensing — the app links out to Bible.is for those.

**No tracking, no analytics, no external requests** other than: (a) Firebase if signed in, (b) the Bible.is "Pro audio" link if the user clicks it.

## Build pipeline

The HTML you upload is generated. Source data lives in Claude's working sandbox (not in this folder):

```
[Claude's outputs/]
├── chapters.json          ← bundled WEB Bible text (110 entries, ~580KB)
├── commentary.json        ← summary/lessons/tension for each chapter (~100KB)
├── build_chapters.py      ← regenerates chapters.json from pythonbible-web
├── build_commentary.py    ← contains all the commentary content as Python data
└── app_template.html      ← the HTML template with __CHAPTERS_JSON__ and __COMMENTARY_JSON__ placeholders
```

To update: ask Claude to make a change. Claude edits `app_template.html` (or the build scripts), runs the merge:

```python
template.replace('__CHAPTERS_JSON__', chapters_json).replace('__COMMENTARY_JSON__', commentary_json)
```

…and writes the result to this folder as `index.html`. Then you upload it to GitHub.

## Deploying changes

1. Claude builds new `index.html` (and `sw.js` if the service worker changed) into this folder
2. Go to https://github.com/Averyscove/bible-study/upload
3. Drag the file(s) into the upload area (multi-select in Finder if there's more than one)
4. Click green **Commit changes** at the bottom
5. GitHub Pages rebuilds in ~30 seconds
6. On user devices: hard-refresh, or wait for the in-app "Update available — Refresh" banner

The repo is public; data in Firestore is protected by user-scoped security rules, not by repo visibility.

## Firebase configuration

**Project:** `bible-study-25f61` (owned by Neptune's Google account)

**What's enabled:**
- Authentication → Email/Password provider
- Cloud Firestore → production mode

**Firestore security rule** (must stay this way):

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{uid} {
      allow read, write: if request.auth != null && request.auth.uid == uid;
    }
  }
}
```

This ensures each authenticated user can only read/write their own document at `/users/{their-uid}`. Anyone else — including the developer — cannot read another user's data through the SDK.

**Public Firebase config** (intentionally public — it identifies the project, not a secret):

```js
{
  apiKey: "AIzaSyAvBfiKbg0HDg6_vVNX50Rl0cB7OK7leFU",
  authDomain: "bible-study-25f61.firebaseapp.com",
  projectId: "bible-study-25f61",
  storageBucket: "bible-study-25f61.firebasestorage.app",
  messagingSenderId: "922895631956",
  appId: "1:922895631956:web:f5a1a8deaca44a67180fc1"
}
```

## State shape (what's in localStorage and Firestore)

Single document at `/users/{uid}` containing:

```js
{
  progress: { [chapterId]: { done: true, doneAt: timestamp } },
  notes: { [chapterId]: { jesus, stood_out, question, prayer } },
  memory: { [memoryVerseId]: boolean },
  bookmarks: { [verseKey]: { id, c, n, ref, text, addedAt } },
  streak: { lastDate, current, max, days: { 'YYYY-MM-DD': true } },
  readTime: { [chapterId]: seconds },
  coreMessage: { [index]: boolean },
  readQ: { [index]: boolean },
  settings: { rate, fontSize, theme, repeatVerse, voice* },
  lastViewed: { phaseId, chapterId },
  updatedAt: timestamp,
  lastSyncedAt: timestamp
}
```

(* `voice` stays per-device — different phones have different voices available.)

LocalStorage key: `biblestudy_v1`. Don't bump the version unless migrating data is intended; the app reads existing v1 data on every load.

## Known limitations / things to watch for

**Deleting notes doesn't sync through merge.** The merge favors data preservation. If a user deletes a note on one device and the other still has it, the next sync brings the deleted note back. To truly clear, use Settings → Reset all progress.

**Service worker update timing.** When a new `index.html` deploys, the service worker enters "waiting" state after detecting it. The user has to either close and reopen the app or tap the "Refresh" banner to activate the new version. They won't see new features until then.

**Firebase auth modules load from gstatic.com.** First load on a device requires internet (~100KB of Firebase SDK). After that, the auth state is persisted in IndexedDB and the Firebase SDK is cached. Truly first-time offline = no login UI, but the app still works in local-only mode.

**iOS storage eviction.** Without the service worker, iOS Safari can evict cached pages after long disuse. The service worker uses a more persistent cache that survives this. Both files (index.html + sw.js) need to be installed for guaranteed offline.

**Cache version must be bumped on every meaningful update.** In `sw.js` change `CACHE_VERSION` to a new string (e.g., add a date suffix). Otherwise users stay on the old cached version forever.

## Common change patterns

**Add a new chapter** to the plan: edit `PLAN` array in `app_template.html`, regenerate the WEB text for that chapter (in `build_chapters.py`), and write a commentary entry (in `build_commentary.py`). Rebuild + upload.

**Edit commentary** for an existing chapter: edit the entry in `build_commentary.py`, run `python3 build_commentary.py`, then merge into the template. Upload.

**Change visual styling**: edit the `<style>` block in `app_template.html`. The CSS uses CSS variables for theming (light/dark). Both themes need to look right — test both.

**Add a feature**: extend the `state` shape in `defaultState()`, add UI in the relevant `render*()` function, add merge logic in `mergeStates()` if it should sync, save via `persist()`. The single-file architecture makes this fast to iterate on.

## When picking this up fresh

If you're a future Claude session or another developer:

1. Read `index.html`. It's the whole app.
2. The major sections are clearly commented: State, TTS, Routing, Helpers, Auth, Render functions, Service Worker, Init.
3. The build script that produces `index.html` is in Claude's session outputs folder (regenerated from `app_template.html` + `chapters.json` + `commentary.json`).
4. Test in mobile viewport (390x844 is iPhone 14 Pro). The desktop view is just the same UI in a wider container.
5. After any change: bump `CACHE_VERSION` in `sw.js`, rebuild `index.html`, upload both files, hard-refresh to test.

## Useful URLs

- Live app: https://averyscove.github.io/bible-study/
- GitHub repo: https://github.com/Averyscove/bible-study
- Firebase console: https://console.firebase.google.com/project/bible-study-25f61
- Pages settings: https://github.com/Averyscove/bible-study/settings/pages
- Firestore data viewer: https://console.firebase.google.com/project/bible-study-25f61/firestore/data
