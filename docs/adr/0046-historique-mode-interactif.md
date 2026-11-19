<!-- mesh:contrat=decision-conseil v1 -->

# 0046 — One history entry per chapter visit in interactive mode

- **Status**: Accepted — signed by Gabrielle (human, N2 council) on 2026-11-18, gate 3 of #396
- **Date**: 2026-11-18
- **Deciders**: N2 council of the mesh — P2 (product strategist) · B1 (technical architect) ·
  U7 (guardian) — human decisions at gate 1 (Gabrielle, 2026-11-18) — ticket PL-3 (#396),
  epic #358. Measurements by U6 (gate 2). Drafted by B1; recorded by P3, who does not ratify.
- **Supersedes**: ADR 0032 §4, bullet "Each slide change pushes a history entry…", and the
  matching negative consequence ("Pushing one history entry per slide…").

## Context

**Signal.** PL-3 of the first batch (`docs/mesh/PREMIER-LOT.md`, "dead ends first"), issue
#396. Key task "Back to the chapter list after a slide": today **n + 1** back presses after n
slide changes, target **1**, state **trap**, on a hot route (`/[niveau]/[matiere]/[slug]`).

**Facts (base `2f186c6`, `next@15.5.23`, measured by U6 on desktop and Pixel 7).**

- `naviguer` pushes one entry per slide change (`mode-context.tsx:395`), for every gesture:
  arrows, space, swipe, side strip, drawer, help citations, end-of-chapter summary, in-page
  « Revoir » links. 5 changes take `history.length` from 5 to 10; 6 backs to reach the list.
- Back walks the slides one by one through the provider's `popstate` listener (l. 536-559).
  After a switch to reading mode (which replaces, l. 464), the first back lands on an old
  `?diapo` entry and the listener **reopens the interactive mode** (l. 545-551).
- **Dead back after a full load.** On a full load, the mount effect (l. 521-531) rewrites
  `?diapo` with the **native** `history.replaceState(null, …)`: Next.js patches
  `history.pushState`/`replaceState` in the app router's own mount effect
  (`next/dist/client/components/app-router.js:289-361`), and React runs passive mount effects
  child first, so the provider's effect runs before the patch. `HistoryUpdater` had already
  written `{ __NA, __PRIVATE_NEXTJS_INTERNALS_TREE }` in its insertion effect (l. 89-116); the
  native call replaces it with `null`. Next's `popstate` handler ignores an entry whose state is
  `null` (l. 340-343): after leaving by a link, back changes the address but the page stays.
  Same with a native `#anchor` jump in reading mode (« Sur cette page »,
  `chapter-rail.tsx:29`; « Revoir », `exercice-widget.tsx:663`): each one adds a same-document
  entry with state `null`.
- **"Forward" restores stale props.** A back/forward traversal re-renders the chapter from the
  cache node of the entry's tree (the tree written when the chapter was first rendered): the
  provider remounts with the `initialIndex`/`initialMode` of that first request, and today's
  mount effect overwrites the restored `?diapo` with them. Switching `push` to `replace` alone
  makes "Forward" reopen `debut` (U6, criterion 12).
- **Hidden coupling.** Step-by-step reveal is tied to the push: `pasAPas = options.historique
=== 'push' && cible === depart + 1` (l. 380).
- **Constraints.** U6 vetoes any variant that syncs the URL with `router.replace`/`router.push`
  (one RSC round trip per slide). The patched native `replaceState` costs the same as today's
  `pushState` (one `ACTION_RESTORE`, then `HistoryUpdater` replaces once more; no consumer of
  `useSearchParams` in `app/`, `components/`, `lib/`).

**Human decisions (gate 1).** (1) Back from a slide returns to the previous page, not to the
reading mode of the same chapter. (2) The URL keeps following the current slide, without an
entry: direct links, reload and "Forward" reopen the right slide. (3) No non-linear jump
creates an entry (« Revoir », strip, end summary): one rule, "one back = I leave the chapter".

## Decision

We will keep **exactly one history entry per chapter visit**, whatever the mode and the
number of slides seen, and treat the address as a mirror of the state, never as navigation.

1. **Replace, never push.** Every slide change and every mode switch updates the address with
   `history.replaceState` on the current entry. No gesture creates an entry: arrows, space,
   Shift+space, swipe, strip, drawer, help citations, end summary, « Revoir ». The URL format
   (`?diapo=<id>`, other parameters and hash kept by `urlAvecDiapo`) does not change. Never
   `router.replace`/`router.push` (U6 veto).
2. **One writer that keeps Next's entry healthy.** All address writes go through one helper
   (`remplacerAdresse(url)`, B3). It calls `window.history.replaceState(null, '', url)`: once
   Next has patched history (any gesture, by construction), the patch copies `__NA` and the tree
   into the entry and dispatches `ACTION_RESTORE`, so Next's `canonicalUrl` follows the slide.
   If the call ran on the **native** method (only possible during hydration, before the patch),
   the helper sees that Next's state was lost and writes the previous state object back on the
   same URL. The entry is therefore never `history.state === null`, whatever the effect order.
   The helper never throws: a failure (a browser's rate limit, a `SecurityError`) costs the
   address, never the slide.
3. **Intent and address are decoupled.** `naviguer(cible, { depuisX? })` no longer takes a
   history option. Step-by-step reveal depends on the move only: `pasAPas = cible === depart +
1` (every caller of `naviguer` is a student gesture once the `popstate` path is gone, so the
   behaviour of every gesture is unchanged, including a strip click on the next slide). The
   address is written **after** `setIndex` (and after the `etat` ref), so a write failure can
   no longer stop the slide from changing. `basculer` follows the same order.
4. **The address wins at mount.** A mount-only layout effect reads `window.location.search`
   and the mode cookie on the client, through a pure function in `web/lib/diapos.ts`
   (`etatAuMontage(deck, { mode, index }, search, cookie)`): a `?diapo` in the address sets the
   interactive mode on the slide it resolves to (`indexDiapo`); without `?diapo`, a cookie
   present sets the mode; where the address and the cookie are silent, the server props stay.
   When the result differs from the props (only after a back/forward traversal served from the
   router cache, or a cookie changed since the cached render), the state and the `etat` ref are
   corrected before paint, with every step shown, no transition and **no address write**. On a
   full load the server read the same address and cookie: nothing changes, no hydration
   mismatch (the read happens in an effect, not during render).
5. **Normalisation once, at mount.** The same layout effect, and only it, rewrites an
   un-normalised `?diapo` (absent, or naming a block or section) to the id of the slide shown,
   through the helper, in interactive mode. The passive `[mode]` effect keeps only the
   `motion` preload. "Forward" therefore never overwrites a restored address.
6. **No `popstate` listener in the provider.** The chapter creates no entry of its own, so
   nothing inside a visit is reachable by back/forward: back leaves the chapter (Next's
   traversal), forward remounts it (point 4). Removing the listener also removes the flash of
   the reading mode while leaving (today a back to the list hits the "no `?diapo`" branch and
   switches to reading mode during Next's transition).
7. **In-page anchors are intercepted in both modes.** The provider's existing delegated
   `onClickCapture` (today interactive only) also handles reading mode: a click on
   `a[href^="#"]` whose target is in the chapter is prevented, the target is scrolled into view
   (`scrollIntoView({ block: 'start' })`), the keyboard starting point is kept on the target's
   **heading** (its direct `h1`–`h6`, or the target itself when it has none; `tabindex="-1"` set
   on demand, `focus` with `preventScroll`, the slide titles' focus style), and **the address is
   not written** (the reading position is not in the URL today either). A link to `#` or to an
   id found nowhere in the document is prevented and does nothing; a link to an id outside the
   chapter (a skip link) is left to the browser. React's synthetic events bubble through
   portals, so « Sur cette page » in the mobile tools sheet is covered; the sheet's own
   `onNavigate` still closes it, and `chapter-tools-sheet.tsx` keeps the focus on that heading
   when it closes after such a link (any other close hands focus back to its trigger). Modifier
   clicks (Cmd/Ctrl/Shift/Alt, middle button) keep the browser's behaviour. Neither
   `chapter-rail.tsx` nor `exercice-widget.tsx` changes.
   _Known, pre-existing, out of scope:_ the sections' `scroll-mt-20` computes to `0px`, so the
   heading lands under the sticky header after the jump, as with the native jump before (U7).

## Consequences

### Positive

- One back leaves the chapter on desktop and mobile, after any number of slides and after a
  mode switch; three backs from the chapter walk Explorer → level → subject in reverse
  (criterion 7). `history.length` stays constant inside a visit.
- The dead back after a full load and after an anchor jump disappears: every entry the chapter
  touches keeps Next's state.
- "Forward", reload and direct links reopen the slide of the address, or the reading mode the
  student left in (criterion 12).
- Performance unchanged (U6: same number of patched history calls, no RSC fetch, no long task);
  the slide no longer depends on the address write succeeding.
- A single rule for the student ("one back = I leave the chapter") and for the code (one
  writer, one place that reads the address).

### Negative / trade-offs

- Back no longer walks the slides: a student who wants the previous slide uses ←, the swipe or
  the strip. Decided by the human (decision 1).
- After « Revoir » or a jump, back does not return to the exercise. The visible "back to the
  exercise" belongs to PL-2 (#371), not to the browser history (decision 3).
- An anchor jump in reading mode no longer puts `#section` in the address: reloading after it
  opens the chapter at the top, as after a manual scroll. A shared section link typed by hand
  (`…#section`) still works on load.
- The helper relies on Next's history patch copying `__NA` and the tree (`next@15.5`). A Next
  upgrade that changes it must re-run the e2e of this ADR (they fail on a dead back).
- During hydration the normalising write (point 5) runs on the native method and cannot reach
  Next's router: until the first gesture, Next's `canonicalUrl` keeps the un-normalised
  address. A router state change in between (an HMR refresh in development) puts that address
  back: harmless, it resolves to the same slide.

### Follow-ups

- PL-3 build (B3, #396): `mode-context.tsx`, `lib/diapos.ts`, the history helper, unit tests,
  e2e replacing "the back button goes back one slide at a time".
- When the fake backend serves the catalogue (#373), the criterion-7 e2e moves from
  `/` → `/explorer` → `/ma-classe` to the real Explorer → `/3e` → `/3e/mathematiques` path.
- #374 stays open (hydration race in the test, unrelated): a client-set hydration signal is the
  lead for V3/B5.
- ADR 0032 amended (header line, §4 and the negative consequence point here).

## Alternatives considered

- **`router.replace`/`router.push` to sync the URL** — one RSC round trip per slide; U6 veto.
- **Keep one entry per slide, and leave the chapter on back** (e.g. count the entries and
  `history.go(-n)` on `popstate`) — back cannot be intercepted before it happens: the student
  sees intermediate slides flash, `history.length` still grows, and a reload loses the count.
- **Push for jumps only** (strip, « Revoir », end summary), replace for linear moves — rejected
  by the human (decision 3): two rules nobody can predict, and the trap comes back after a
  jump.
- **`replaceState` with `null` only, nothing else** (U6's simulation) — fixes the back count
  but keeps the dead back after a full load and makes "Forward" reopen `debut`.
- **Always pass `history.state` to `replaceState`** (Next's patch then lets the call through
  untouched) — keeps the entry healthy, but Next's `canonicalUrl` stays on the first slide; the
  next router state change (`router.refresh`, HMR) would rewrite the address to an old slide
  and break reload (criterion 10).
- **Defer the first write until after the patch** (`queueMicrotask`/`setTimeout` from the
  effect) — works only because of React's effect order and Next's mount timing; the
  self-healing helper does not depend on either.
- **Pick the slide on the client only** (no `initialIndex` from the server) — the first paint
  would show the wrong slide, contrary to ADR 0032 §5 ("no flash").
- **Keep a `popstate` listener filtered on the chapter path** — nothing inside a visit is
  reachable by history any more; the listener would only add a code path that can reopen the
  interactive mode (U6 risk 3).
- **Exclude anchors from the criterion** instead of intercepting them — leaves the dead back
  (anchor in reading mode, then a link, then back): S3 fails criterion 7 as soon as it clicks
  « Sur cette page ». **Intercept and write the hash with `replaceState`** — puts a hash next to
  `?diapo` after a switch, and the reading position is not part of the URL contract.

## Council opinions

- **B1 (technical architect)** — agrees. Smallest change that meets the three human decisions
  and U6's six risks; contained in the chapter provider, no backend, no API, no migration;
  reversible by reverting one PR.
- **P2 (product strategist)** — agrees: the ADR applies the needs sheet of #396 and the three
  human decisions of gate 1 as written (back returns to the previous page, the URL follows the
  slide without an entry, no jump creates an entry).
- **U7 (guardian)** — agrees, no veto (gate 5, PR #412): focus on the slide title and the
  `aria-live` announcement kept, no flash on back or forward, reduced motion and 200 % zoom
  fine. Its two reservations (focus on an unnamed section; focus lost in the mobile sheet) were
  fixed in round 1 by sending focus to the section's heading, in both cases.
- **U6 (consulted, performance veto)** — no veto; the veto on `router.replace`/`router.push`
  is honoured (decision 1).
