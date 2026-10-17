# Mova — Mobbin Research: Onboarding

**Date:** 17 October 2026 · **Platform:** iOS (Mobbin) · **Feeds:** the onboarding flow in `apps/mobile/src/app/onboarding.tsx` and `DESIGN.md` §Onboarding

## Goal
Find modern onboarding patterns that are simple, conversational and accessible, for Mova's three short questions: preferred name, "have you used a fitness app before?", and "do you have a routine?".

**Inputs checked:** `DESIGN.md`, the earlier Mobbin research, `docs/PRODUCT_SPECIFICATION.md` (WF-01 asks for onboarding to stay short and not block the workspace) and the wireframe reference pack. The pack in `~/Downloads/mova-wireframes-reference-pack (1)/` contains no onboarding wireframes (only the Schedule redesign image and written decisions for Overview, Workouts, Schedule, Meal Plan and History), so the layout follows the task brief and these references.

## Searches used (iOS)
1. Name capture: "What should we call you?" with one large field, a friendly headline and one primary button.
2. Choice cards: onboarding question with large selectable cards, selected state, short headline, fitness or wellness app.

## Ten strong examples
| # | App | What it does well | Taken for Mova |
|---|---|---|---|
| 1 | [Flo](https://mobbin.com/screens/a8f2b86d-154c-4bcd-835a-069e3cdfe6f1) | One field, a warm lead-in ("Let's get to know each other"), Continue stays inactive until there is input, quiet Skip | Name step: same structure, with "Skip for now" |
| 2 | [Commons](https://mobbin.com/screens/fabf6cee-e5b8-464d-af9b-9fe7aeb034f7) | Big field, short reassurance, button pinned to the bottom | Large field and a pinned Continue |
| 3 | [Insight Timer](https://mobbin.com/screens/7ddb91ac-99e8-456e-a206-7b4254616839) | Plain question, generous space, no clutter | Whitespace and a single question per screen |
| 4 | [ABY Journal](https://mobbin.com/screens/a9534c2b-b039-44a4-bbc5-184f5ae9e985) | Conversational greeting above the question ("Hello, I'm ABY.") | Mascot plus "Hi! What should I call you?" |
| 5 | [Givingli](https://mobbin.com/screens/6a8c5018-8ee7-4aea-9172-b8e26f4181c5) | Back arrow, centred friendly headline, disabled button until valid | Back chevron and a disabled Continue |
| 6 | [Strava](https://mobbin.com/screens/9abe1e4c-91ff-46bd-8304-247f8ff09446) | Full-width stacked cards with a bold title and one line of help; single sticky Continue | Choice card anatomy (title, hint) |
| 7 | [Tonal](https://mobbin.com/screens/a0bb4e2e-0082-4b57-b943-0600d062256d) | Progress bar, card with radio marker, selected card clearly inverted | Progress segments and a radio-style selected state |
| 8 | [pliability](https://mobbin.com/screens/7d71bea4-42e6-4cb3-8a97-e13178064ee5) | Two large cards, each tappable across its whole surface | Whole-surface tap targets for the binary choices |
| 9 | [Liven](https://mobbin.com/screens/0c379643-c33e-4086-948b-a17a3fcf120e) | Selected card gets a coloured ring and a check, not only a colour change | Ring plus check for the selected state |
| 10 | [Oura](https://mobbin.com/screens/de098313-b52d-4e72-a02c-c9e65c958305) | Spacious cards with a one-line explanation; "Continue" disabled until a choice | Hint text under each choice |

## Patterns applied
1. **One question per screen**, with a progress indicator (three segments) and a back chevron.
2. **A friendly lead-in line plus one big headline**, in the person's own words ("Nice to meet you, Ada").
3. **Binary choices as two large cards**, tappable on the whole surface, with a ring and a check when selected, and a visible focus ring for keyboard users.
4. **A pinned Continue** that stays inactive until the step is answered; no auto-advance, so a mis-tap never moves someone on.
5. **Branch early.** Someone new to fitness apps goes straight to the Overview; there are no extra setup questions.
6. **Hand off to conversation.** "Create with Mova" opens Mova Companion, which asks one question at a time, and nothing is saved until the person approves.
