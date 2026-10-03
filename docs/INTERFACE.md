# Interface

## Four destinations

| Destination | Screens | Purpose |
|---|---|---|
| **Today** (`/`) | Today | The one recommended next step: continue, review, or start a lesson |
| **Learn** | Lessons (`/learn`), Review (`/study`), Practice (`/drill`) | Guided learning, scheduled review and targeted practice |
| **Words** | Lexicon (`/lexicon`), Reference (`/library`) | Search, saved entries and reference notes |
| **Progress** (`/progress`) | Progress | Retention, skills, workload, settings and backups |

Phones show the destinations in the bottom dock, and larger screens in the
sidebar. Learn and Words show their screens as tabs at the top
(`src/components/section-tabs.tsx`; `src/lib/sections.ts` maps a path to its
destination).

## Shared components

| Component | File | Use |
|---|---|---|
| `Button`, `ButtonLink` | `components/ui.tsx` | Actions; `primary` is the one main action of a screen |
| `SpeakButton` | `components/ui.tsx` | Pronunciation with loading, playing and unavailable states, and optional slower playback |
| `PageHeader` | `components/ui.tsx` | Screen title and short explanation |
| `Num`, `Sep` | `components/ui.tsx` | Numbers and separators in the reader's language |
| `GoalRing` | `components/ui.tsx` | Daily goal |
| `ProgressMeter` | `components/feedback.tsx` | Session progress as an accessible progress bar |
| `AnswerFeedback` | `components/feedback.tsx` | The verdict, the explanation and the single way on; announces the result and moves focus to **Next** |
| `Mark`, `WrongRight` | `components/feedback.tsx` | Right and wrong markers that do not depend on colour; a mistake beside its correction |
| `PilotEntryDetail` | `components/pilot-entry.tsx` | Every sense of a word with its teaching notes |
| `RecoveryScreen`, `SaveNotice` | `components/recovery-screen.tsx`, `save-notice.tsx` | Unreadable saves and save failures |
| `useKeepFocus` | `lib/focus.ts` | Puts focus back in the task when the focused control disappears |

## Rules for screens

- **One primary action.** Each learning screen has one filled button. Other
  actions are secondary or text links.
- **Touch targets** are at least 44 × 44 px (`min-h-11`).
- **Mixed direction:** see [ACCESSIBILITY.md](ACCESSIBILITY.md#language-and-direction).
- **No layout shift.** Anything that depends on saved progress or loaded data
  is drawn once it is final, in space held for it, rather than redrawn. Today
  shows a placeholder card until progress, levels and the lesson order are
  loaded.
- **Feedback** always explains, for a right answer as well as a wrong one, and
  leads on with one button.
- **Uncertainty is stated.** Skill accuracy is shown only with at least five
  answers. Until then the screen says there are not enough answers yet.
- **Enlarged text** must reflow, not clip. Prefer wrapping rows over fixed
  widths, and `min-h-*` over fixed heights.
