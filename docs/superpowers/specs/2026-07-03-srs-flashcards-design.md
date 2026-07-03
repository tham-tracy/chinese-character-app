# SRS Flashcards — Design

**Date:** 2026-07-03
**Status:** Approved

## Goal

Add an Anki-style spaced-repetition flashcard mode so the user learns at least
5 new Chinese words per day. Recognition cards (Hanzi → pinyin + meaning),
scheduled with the classic SM-2 algorithm, with all progress stored in
localStorage so the feature works on the static GitHub Pages deployment.

## Decisions made

| Question | Decision |
|---|---|
| Card content | Words (the ~12k frequency-ranked entries in `word-index.json`) |
| Card direction | Hanzi front → pinyin + meaning back (recognition) |
| New-word source | Automatic, strict frequency order, 5 per calendar day |
| Algorithm | SM-2 (classic Anki), Again / Hard / Good / Easy grading |
| Storage | localStorage, versioned blob; per-browser, no sync |

## User experience

- A **Study** tab/button in the app header with a due-count badge
  (e.g. "Study · 7 due"), toggling between the existing search view and the
  new study view.
- A session presents, in order: all cards due today, then up to 5 new words
  (next unseen words by frequency rank). The 5/day cap is tracked per calendar
  date so refreshing the page does not introduce extras.
- Card front: the word in Hanzi. Flip with a tap/click or Space.
- Card back: pinyin and meaning from the existing word data. Each character in
  the word is clickable and jumps to the existing character-detail view
  (stroke order, composition).
- Grade buttons Again / Hard / Good / Easy, keyboard shortcuts 1–4.
- Cards graded **Again** requeue at the end of the current session until
  graded Good or better.
- End-of-session summary ("12 reviewed, 5 new learned"). When nothing is due
  and the daily new cards are done, show a "done for today" state.

## Scheduling (SM-2, simplified as in Anki)

Per-card state: `ease` (starts 2.5, floor 1.3), `interval` (days),
`due` (ISO date), `reps`, `lapses`, `status` (`new` | `learning` | `review`).

- **New/learning:** Good on a new card → due in 1 day; Good again → 3 days;
  then the card graduates to review status. Again → back to the first step
  (1 day). Hard → repeat the current step. Easy → graduate immediately with a
  4-day interval.
- **Review:**
  - Good → `interval = interval × ease`
  - Hard → `interval = interval × 1.2`, `ease -= 0.15`
  - Easy → `interval = interval × ease × 1.3`, `ease += 0.15`
  - Again → lapse: `ease -= 0.2`, card resets to learning (1 day),
    `lapses += 1`
- Ease never drops below 1.3. Intervals are whole days, minimum 1.
- The grading function receives the current time as an argument (no hidden
  clock) so tests are deterministic.

## Architecture

Follows the existing project pattern: tested pure logic in `src/lib/`,
UI in `src/components/`.

| Unit | Responsibility |
|---|---|
| `src/lib/srs.js` | Pure SM-2 transition: `(cardState, grade, now) → newCardState`. No I/O. |
| `src/lib/deck.js` | Flatten `word-index.json` to a rank-ordered word list; build today's queue (due + up to 5 new); track new-cards-introduced per date; load/save the versioned localStorage blob keyed by word string. |
| `src/components/StudySession.jsx` | Card UI, flip interaction, grade buttons, in-session Again requeue, session summary. |
| `App.jsx` | View toggle (search ↔ study), Study button with due-count badge. |

### Persistence format

```json
{
  "version": 1,
  "cards": { "中国": { "ease": 2.5, "interval": 3, "due": "2026-07-06", "reps": 2, "lapses": 0, "status": "review" } },
  "newIntroduced": { "date": "2026-07-03", "count": 5 }
}
```

Stored under a single key (e.g. `ccl-srs-v1`).

## Error handling

- Missing or corrupt localStorage (or wrong version) → start a fresh deck.
- A stored word no longer present in the word data after a data rebuild →
  skipped from the queue, state left untouched.
- No due cards and daily new cards exhausted → "done for today" empty state,
  never a crash or blank screen.

## Testing

Vitest unit tests, matching the existing `src/lib/*.test.js` pattern:

- `srs.test.js` — grading transitions for each of the four grades in each
  status, interval growth, lapse behavior, ease floor at 1.3, minimum
  1-day interval.
- `deck.test.js` — queue building (due-first ordering, 5-new cap, frequency
  order, skipping studied words), date rollover of the daily cap, persistence
  round-trip with a mocked storage object, corrupt-blob recovery.

UI is verified manually in the running app (flip, grade, badge count,
character-detail navigation).

## Out of scope (YAGNI)

- FSRS or configurable algorithms
- Meaning → Hanzi (production) cards
- Manual "add to deck" buttons
- Cross-device sync / accounts
- Audio, example-sentence cards, deck import/export
