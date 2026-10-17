# Mova — Mobbin Research: Feminine, Modern Fitness and Wellness Style

**Date:** 17 October 2026 · **Platform:** iOS (Mobbin) · **Feeds:** [`DESIGN.md`](../../DESIGN.md) v2.1

## Goal
Find how modern women-focused fitness and wellness apps use colour and shape, so Mova can have a feminine, premium palette without becoming childish.

## Searches used (iOS)
1. Women's fitness home screen with soft pink and lavender pastels, rounded cards and a friendly greeting.
2. Cycle tracking or women's wellness dashboard with blush and rose tones, circular progress and a calendar strip.
3. Pilates or yoga workout plan with soft neutral and dusty rose colours, rounded class cards and a primary button.

## Pattern clusters

1. **A near-white page with a pastel wash, not a pink page.** [Future Pro](https://mobbin.com/screens/59cde478-2c5b-4097-9f83-4813dc5bd538) sits white cards on a faint lilac fade; [Liven](https://mobbin.com/screens/a73aa6f7-4213-44a5-a28a-ddbd36162d0e) fades a peach-to-lilac glow into white; [Flo](https://mobbin.com/screens/a66f535c-0d6e-472f-90a2-daf56e71fd17) uses a soft teal-to-white header. Mova: blush-white page, lilac glow top right, peach glow bottom left, both under 40% opacity.
2. **One saturated rose does the work.** [Nike Run Club](https://mobbin.com/screens/46bc8651-3696-456b-af8d-63ff218e4faf) marks progress and the completed day with a single orchid-pink; [MacroFactor](https://mobbin.com/screens/9c0971ec-3457-47fc-b117-17f41b6419dc) outlines tracked days in rose; [Clue](https://mobbin.com/screens/9ab494e4-9972-4292-a223-f9c80fdb8577) uses a coral-rose ring against grey. Mova: berry rose `#B03F6B` for the primary action, selection and progress only.
3. **Pink needs a calming partner.** [Apple Health cycle tracking](https://mobbin.com/screens/9710c735-c8a6-46aa-88bd-36edf8b8610b) pairs a blush wash with mint and lavender groups; [Fitbit cycle calendar](https://mobbin.com/screens/6a40d81c-1e79-4c03-9d2e-dfdaa9a40f68) pairs hot pink with sky blue and lilac. Mova: green for success, lilac for the companion, peach for warmth, so rose never has to mean everything.
4. **Very round shapes.** Cards, chips and calendar cells in Flo, Clue and [Google Health (Fitbit)](https://mobbin.com/screens/6778eb0e-b01a-4190-b129-8ff8ec31ec44) use large radii and pill controls. Mova: card 24, input 16, sheet 32, pill 999.
5. **Warm, human tone in the copy and type.** [Finch](https://mobbin.com/screens/2ae59897-7aee-4055-a1c5-53f2e3d69295) and [Gentler Streak](https://mobbin.com/screens/c991401a-cc03-4eb2-9143-e775e8b15865) speak gently about rest and recovery, with a friendly greeting above the content. Mova keeps rest days as part of the plan and uses an italic serif accent word in the greeting, coloured rose-deep.
6. **Dark and neon are the opposite register.** [Stardust](https://mobbin.com/screens/8db4541e-807a-4ba4-ba15-ebfe33104215), [Ultrahuman](https://mobbin.com/screens/193b6e03-7e8d-45f5-b009-b29f826c3ec4) and [Apple Fitness](https://mobbin.com/screens/7b10f5aa-5633-491d-807c-d5f224afc3da) look techy or athletic. Mova stays light.

## What went into the palette

| Role | Token | Value | Why |
|---|---|---|---|
| Page | `page` / `page-top` | `#FAF5F6` / `#FFF9F7` | Blush-white, warm without looking pink |
| Card | `surface` | `#FFFFFF` | White cards read clean and premium |
| Well | `well` | `#F5EAEE` | Soft blush for inputs, tracks and chips |
| Text | `ink` | `#2A2230` | Plum-black is softer than pure black and fits the blush page (14.2:1) |
| Accent | `rose` | `#B03F6B` | Berry, not candy; white text on it is 5.6:1 |
| Companion | `lilac` | `#6552B8` | Keeps AI output visually distinct (6.1:1 on white) |
| Warmth | `peach` | `#F4B8A0` | Decorative glow only |
| Success | `positive` | `#2F6B58` | Calm green, so success never reads as brand |

## What Mova does not do
- No hot pink, glitter, gradients on buttons or pink text on pink.
- No flames, streaks or shaming copy.
- No pink on every element: rose appears on one primary action and the current selection per screen.
