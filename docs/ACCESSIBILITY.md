# Accessibility

The target is **WCAG 2.2 level AA** in both interface languages, on phones,
tablets and desktop browsers. Automated checks run on every change. Manual
testing with screen readers on real devices is still required before the
target can be claimed (see [Manual checks](#manual-checks)).

## What the automated tests cover

`tests/e2e/mobile-accessibility.spec.ts`, `tests/e2e/a11y.spec.ts` and the
accessibility steps inside the other browser tests check the following.

| Area | Check | WCAG 2.2 |
|---|---|---|
| Automated rules | axe-core (`wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa`, `wcag22aa`) on every screen in Persian and English, on onboarding, in lessons, recovery and storage warnings | many, including 1.4.3 contrast, 2.5.8 target size, 4.1.2 name/role/value |
| Navigation | Four destinations in a labelled navigation landmark; Learn and Words have labelled section tabs; the current page is marked with `aria-current` | 1.3.1, 2.4.8, 4.1.2 |
| Bypass blocks | **Skip to content** is the first Tab stop and moves focus to the main content | 2.4.1 |
| Focus visible | Every control reached with Tab shows a 2 px outline, also on the dark dock and sidebar | 2.4.7 |
| Focus not obscured | No focused control is hidden under the dock (`scroll-padding` keeps it clear) | 2.4.11 |
| Focus order | Answering a lesson question moves focus to **Next**; revealing or grading a review card keeps focus on the card; nothing drops focus to the page body | 2.4.3 |
| Status messages | Answer results, audio states and loading are announced through `role="status"` without moving focus | 4.1.3 |
| Use of colour | Right and wrong answers carry a symbol and screen-reader text, not only green or red | 1.4.1 |
| Reflow | No horizontal scrolling at 320 CSS px on any screen | 1.4.10 |
| Resize text | At 200% text size nothing scrolls sideways and no control clips its label; the dock wraps to two rows | 1.4.4 |
| Text spacing | WCAG's increased line, letter, word and paragraph spacing causes no overflow | 1.4.12 |
| Orientation | Landscape phone, portrait and landscape tablet, and desktop keep navigation and content usable | 1.3.4 |
| Keyboard | A whole lesson and a review can be done with the keyboard alone | 2.1.1 |
| Language of parts and direction | `tests/e2e/bidi.spec.ts` lints every screen, a word's detail, a whole lesson, a Review session and Smart Practice in both interface languages. It fails on Persian marked as English, on English inside Persian that is not marked as English, and on a run whose punctuation would land on the wrong side because it sits in the other language's direction | 3.1.2, 1.3.2 |

The on-screen keyboard is handled too. While a text field has focus on a
narrow screen, the dock steps aside, so the answer field and its **Check**
button stay visible. On Android, `interactive-widget=resizes-content` shrinks
the layout above the keyboard.

## Language and direction

Persian and English share most screens, so direction is handled explicitly:

- Every English word, example or sentence inside Persian text carries
  `lang="en" dir="ltr"`. Every Persian gloss inside English carries
  `lang="fa" dir="rtl"`. Elements with `dir` are isolated by the browser, so
  punctuation stays with its own language.
- Persian content often embeds English ("ضمیر I همیشه با حرف بزرگ نوشته
  می‌شود."). Render it with `<Fa text={…} />` inside a `lang="fa" dir="rtl"`
  element: each English run becomes `<bdi lang="en">`, so it keeps its own
  direction and full stop, and screen readers voice it in English. Text whose
  language varies from item to item, such as a Practice prompt, uses
  `<Varied text={…} />`, which picks the language from the script.
- An interface word placed inside content of the other language, such as the
  screen-reader "Right" or "Your answer" beside a Persian option, carries
  `lang={copy.uiLang}`.
- Level codes such as `B2+` sit in `dir="ltr"`, or the `+` would be drawn
  before the `B` in Persian.
- Items in a line are separated with the Persian comma (`، `) in Persian and a
  middle dot (`·`) in English. Beside Persian digits, a middle dot reads as the
  Persian zero (`۰`). Use `<Sep />` or `sep` from `useFormat()`.
- Numbers are formatted per language with `<Num />` (Persian digits in
  Persian).
- The page tree is rebuilt when the language changes. Chrome can keep the old
  bidirectional layout of text that React rewrites from Persian to English in
  place, which drew "Accuracy: –" as "Accuracy :–".

## Manual checks

These cannot be automated reliably and must be done before claiming
conformance. Record the date, device, browser and assistive technology version
for each.

- [ ] VoiceOver on iPhone with Safari: onboarding, a full lesson, a review, a practice round, Words search and detail, Progress settings and backup
- [ ] TalkBack on Android with Chrome: the same tasks
- [ ] NVDA with Firefox or Chrome on Windows: the same tasks
- [ ] Persian pronunciation by each screen reader of mixed Persian and English lines
- [ ] iOS text size at the largest accessibility setting, and Android font scale at 200%
- [ ] Safari pinch zoom and desktop browser zoom at 200% and 400%
- [ ] Windows high-contrast themes (forced colours)
- [ ] Switch access or a hardware keyboard on a tablet
- [ ] Audio controls: playing, slower playback and failures announced
- [ ] Recovery screen and the save-failure warning with a screen reader

Findings are tracked as issues and fixed before the pilot study.
