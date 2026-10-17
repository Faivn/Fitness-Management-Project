# Mova — Mobbin Research for the Mobile Design System

**Date:** 16 October 2026 · **Platform:** iOS (Mobbin) · **Feeds:** [`DESIGN.md`](../../DESIGN.md)
**Source of truth for product rules:** `docs/PRODUCT_SPECIFICATION.md`. Where a pattern here conflicts with it, the specification wins.

## 1. Goal

Find the fitness and wellness apps that best match Mova's product (a calm, premium, AI-assisted fitness workspace: Overview, Workouts, Meal plan, Fasting, Goals, Settings, Companion chat), then turn what they do well into a mobile-first design system that is not a copy of any one of them.

## 2. Top 20 apps reviewed

Apple Fitness, Bevel, BitePal, Cal AI, Centr, Future Pro, Google Health (Fitbit), Lifesum, MacroFactor, MyFitnessPal, Nike Run Club, Oura, Peloton, pliability, Runna, Strava, Tonal, Ultrahuman, Withings Health Mate, Yazio.

Supporting chat references (not fitness, studied for the composer only): Mindvalley, Cash App, Notion, Beside, Genie.

## 3. The 10 best for Mova

Scored on: calm light interface, fit with Mova's modules, clarity of structure on a phone, and how well the pattern survives without photography or a hardware device.

| # | App | What Mova takes from it | Mova area |
|---|---|---|---|
| 1 | [Bevel](https://mobbin.com/screens/5e9f39ef-11f4-4dac-a75d-1106b70e9f5f) | Soft white cards on a pale page, floating rounded tab bar, restrained charts | Overview, navigation |
| 2 | [Google Health (Fitbit)](https://mobbin.com/screens/59bc2882-bb6b-4964-aaa7-00defb0b42a4) | AI coach grounded in the user's day, "can make mistakes" line under the composer, grouped settings with section labels ([settings](https://mobbin.com/screens/1f16e204-bba0-492c-8ee3-33fec070b5ac), [coach chat](https://mobbin.com/screens/90be174d-061a-450d-b2e1-501d4406c9a3)) | Companion, Settings |
| 3 | [Cal AI](https://mobbin.com/screens/0b3110f9-55d7-4828-94ba-231ba6ad8bfd) | Day strip, large rounded white cards, one dark primary action, one ring per card | Overview, Meal plan |
| 4 | [Future Pro](https://mobbin.com/screens/80b08c96-c384-47f2-adeb-f8c244457c16) | Edit-schedule sheet: weekday rail, rest days, drag handle, close and confirm icons | Routine editing |
| 5 | [Runna](https://mobbin.com/screens/7e17aa1e-5ddb-4327-832b-201fde677aa2) | Week cards with a progress bar and a compact list of sessions; target-goal sheet with a segmented control and chips ([goal sheet](https://mobbin.com/screens/b37d1bdf-41a6-43c8-9b4d-ac803f9e693a)) | Workouts, Goals |
| 6 | [Centr](https://mobbin.com/screens/718c28d7-fa13-491b-8fa1-f695bc360164) | Day selector above meal cards; one "Shopping list" button | Meal plan |
| 7 | [Yazio](https://mobbin.com/screens/20325ba9-819b-422b-9d32-0a72127338d9) | Fasting tracker with Edit on start and end, preset chosen from a list ([presets](https://mobbin.com/screens/c9a8011a-becc-430c-9c55-b07c912e9397)); single-choice goal cards ([goal](https://mobbin.com/screens/eb0886ec-32d2-419c-8142-222574814cc1)) | Fasting, Goals |
| 8 | [MacroFactor](https://mobbin.com/screens/20856478-ff7d-4ee1-861e-f1d825be8932) | Settings as titled groups inside white cards, hairlines between rows | Settings |
| 9 | [Peloton](https://mobbin.com/screens/d539d7ba-721e-49a6-9efe-2e82f649463b) | Schedule list under a day picker; muted "No classes" rows for empty days | Workouts, Meal plan |
| 10 | [Withings Health Mate](https://mobbin.com/screens/4c97ccd0-e50a-4637-9196-17b680a8ed43) | Setting rows with the label on the left and a compact segmented control on the right; a heavy band between groups | Settings (units) |

Also useful, not in the ten: [Me+](https://mobbin.com/screens/e3d6a34a-b9a7-40c2-bee2-04ae1790d8d9) (plan card in chat with add / edit / discard), [Mindvalley](https://mobbin.com/screens/1086af93-5300-41b7-8339-90c8aab9d1cc) (greeting plus option cards plus pill composer), [Cash App](https://mobbin.com/screens/a6267a6a-9a5e-411e-91e8-e7bab15b3456) (composer with a round send arrow), [Nike Run Club](https://mobbin.com/screens/46bc8651-3696-456b-af8d-63ff218e4faf) (week header with a progress bar and a done check), [Oura](https://mobbin.com/screens/60022c00-2dc1-4c09-bce1-a57ddc71bea3) (meal-timing ring).

## 4. Searches used (iOS)

1. Fitness home dashboard with greeting, today's workout card, progress rings and tab bar.
2. AI coach chat with rounded composer, suggestion options and a plan card.
3. Weekly workout plan with days, workout cards and an edit button.
4. Meal plan with day selector, meal cards and macro summary.
5. Fasting timer with a ring, elapsed time, start and end times and a schedule setting.
6. Settings with grouped sections, dividers, toggles and unit selectors.
7. Goal selection with rounded options, selected state and a full-width continue button.

## 5. Patterns that recur, and what Mova does with them

1. **Light, airy pages beat dark dashboards for a calm product.** The dark apps (Apple Fitness, Ladder, Life Reset) read as performance tools; Bevel, Cal AI, Google Health and Yazio read as daily companions. Mova stays light.
2. **One ring, one number.** Apps that put a single ring with a single value on a card (Cal AI, Yazio) are quicker to read than those that stack rings, bars and charts (Meta Quest, Ultrahuman). Mova allows at most one ring per card.
3. **The week is the unit of planning.** Runna, Peloton, Nike Run Club and Future Pro all organise training by a weekday rail or week card, and show rest days as quiet rows, not blanks.
4. **Edit lives on the object.** Future Pro and Runna put a pencil or an "Edit" pill on the card itself and open a short sheet, not a long form. Mova edits one training day at a time.
5. **Settings are grouped and labelled.** MacroFactor and Google Health put a small group label above a white card with hairlines. Withings puts the segmented control on the same row as its label. Mova does both.
6. **AI chat is a conversation plus structured cards.** Me+ answers with a plan card that has add / edit / discard; Google Health adds a "can make mistakes" line. Mova never saves anything from chat until the user approves.
7. **A composer is one rounded container.** Cash App, Mindvalley and Notion put the input and a small round button in one pill. Mova's round button is a star (options) when empty and an arrow (send) when text is present.
8. **Floating tab bar.** Bevel and Crouton use a rounded bar that floats above the content. It frees the screen edge and signals a modern, calm product.

## 6. What Mova deliberately does not copy

- Streaks, flames, coins and rewards (Sweatcoin, Strava, Ladder): they conflict with a calm tone and with the specification's "no shaming" rule.
- Calorie-first nutrition (MyFitnessPal, Lifesum, Cal AI): Mova's Meal plan is a plan, not a diary. No consumption tracking.
- Stock photography (Centr, Gymshark, Peloton): Mova has no photo library; structure and type carry the design.
- Neon accents on black (Apple Fitness, Ultrahuman): wrong mood.
