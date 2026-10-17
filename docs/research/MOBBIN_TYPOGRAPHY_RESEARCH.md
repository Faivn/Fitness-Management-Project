# Mova — Mobbin Research: Typography

**Date:** 17 October 2026 · **Platform:** iOS (Mobbin) · **Feeds:** [`DESIGN.md`](../../DESIGN.md) §4 Typography

## Goal
Find how modern fitness and wellness apps set greetings, card titles, body text, labels and numerals, then choose a typeface and scale for Mova's calm, premium, feminine tone, with no slanted text.

## Searches used (iOS)
1. Home screen with a large friendly greeting headline in a rounded geometric sans, bold numerals and card titles.
2. Health screen with big stat numbers, small uppercase labels, medium-weight card titles and readable body text on white cards.

Typefaces below are identified by eye from the screenshots (Mobbin does not name them), so treat them as impressions, not facts.

## What the references do
| Pattern | Seen in |
|---|---|
| **Greeting at about 28–32px, one weight, plain.** "Morning, Alex", "Hi Alex", "What will you accomplish today?" | [Future Pro](https://mobbin.com/screens/7381582a-b1e7-4598-a33c-d167466de0c2), [Centr](https://mobbin.com/screens/908bf553-beaf-413d-824b-384589764c0f), [Equinox+](https://mobbin.com/screens/a11854df-7179-446b-9270-5a1522914279) |
| **Soft geometric or rounded sans for friendliness** (open round letters, generous x-height) | [Yazio](https://mobbin.com/screens/22483abe-2db8-41c9-8244-9bee267e7386), [MacroFactor](https://mobbin.com/screens/b745d030-38ff-4cb2-bc6d-98fc3c8e4b27), [Withings Health Mate](https://mobbin.com/screens/72f11245-eb96-405a-be2a-91b05ce7b01c), [Gentler Streak](https://mobbin.com/screens/3fcf1d49-aa90-450b-9d2d-c0cd7dba3244) |
| **Big numerals 28–48px with a small unit beside them** ("78 bpm", "1,000 ml", "2 yrs younger") | [Withings](https://mobbin.com/screens/72f11245-eb96-405a-be2a-91b05ce7b01c), [MyFitnessPal](https://mobbin.com/screens/e7196f3f-6dcf-4b3b-a86e-ac1ca0310326), [Google Health (Fitbit)](https://mobbin.com/screens/7aa64874-832e-467e-afcc-7e7ee6f11f0d), [Oura](https://mobbin.com/screens/22fd45f7-030e-47f7-8dab-e15ab6c5b2b3) |
| **Card titles 15–18px in medium weight, secondary grey line at 12–14px** | [MacroFactor](https://mobbin.com/screens/b745d030-38ff-4cb2-bc6d-98fc3c8e4b27), [Google Health (Fitbit)](https://mobbin.com/screens/7aa64874-832e-467e-afcc-7e7ee6f11f0d), [Bevel](https://mobbin.com/screens/36231197-1ba8-4f80-8b82-e56b30ee3dd1) |
| **Tiny uppercase labels with letter-spacing** for section names | [Tonal](https://mobbin.com/screens/74e51c99-0993-4408-9ef7-fcd0a2ebd96c), [Centr](https://mobbin.com/screens/908bf553-beaf-413d-824b-384589764c0f), [Garmin Connect](https://mobbin.com/screens/b2b24a7f-7fa7-4e7f-8889-b3105b2d5ab3) |
| **Serif or italic accents are the exception**, used by luxury or editorial brands ([Oura](https://mobbin.com/screens/b4bc9e73-f29d-495e-8ff1-9cb625020ac3), [Lifesum](https://mobbin.com/screens/c6f3a3a1-1027-4b6e-b106-f4dba5cebfa7)); the friendly, daily-use apps keep one sans | — |

## Choosing the typeface
Brief: **modern and clean**. Candidates compared (all free on Google Fonts with 400–700 weights):

| Typeface | Character | Verdict |
|---|---|---|
| **Inter** | The cleanest, most neutral screen sans; crisp numerals, excellent at 12–16px | **Chosen** |
| DM Sans | Clean geometric, a touch warmer | Strong runner-up |
| Plus Jakarta Sans | Soft geometric, more personality (tried first, set aside as less clean) | Not used |
| Figtree | Friendly and open, a little casual | Less refined |
| Manrope | Modern, technical feel | Cooler than Mova's tone |

**Why Inter:** the references that read cleanest (MacroFactor, Withings, Google Health, Bevel) use plain, even sans-serifs, and let colour and shape carry personality. Inter gives Mova that clean, modern base while the blush palette, round shapes and mascot supply the warmth. One family in four weights keeps the app consistent and light to load.

## Scale (from the references)
Display 30/38 · Title 24/30 · Heading 20/26 · Heading small 18/24 · Figure 32/36 · Body 16/24 · Small 14/21 · Label 14/20 · Caption 12/16 · Eyebrow 12/16 uppercase, +0.8 tracking. Full table in `DESIGN.md`.

## Rules taken
1. One typeface everywhere; hierarchy from weight and size.
2. No italics or slanted text (the greeting is plain: "Good morning, Faith").
3. Big numbers carry a small unit beside them.
4. 700 weight is not used in the interface; 600 is the strongest.
