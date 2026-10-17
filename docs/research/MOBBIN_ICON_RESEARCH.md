# Mova — Mobbin Research: Icon Consistency

**Date:** 17 October 2026 · **Platform:** iOS (Mobbin) · **Feeds:** [`DESIGN.md`](../../DESIGN.md) §Icons

## Goal
See how the reference apps keep icons consistent across pages (family, weight, size, containers, colour, active states), then audit Mova against that.

## Searches used (iOS)
1. List rows with leading icons in rounded tiles, chevrons on the right, grouped sections (health and fitness style).
2. Header with round icon buttons top right, filled tab-bar icons, small outlined icons inside cards on one screen.
Plus the tab bar and header screens gathered in earlier research ([Alan](https://mobbin.com/screens/1d8e8577-abc5-4234-8d8e-ebdfd43eae92), [Bevel](https://mobbin.com/screens/5e9f39ef-11f4-4dac-a75d-1106b70e9f5f), [Future Pro](https://mobbin.com/screens/d8f2e00a-c4e6-4d2d-8af4-edcff4f5e25d), [Superpower](https://mobbin.com/screens/e161ce23-7a66-4f9f-ba68-0c8621498ddd)).

## What the references do
1. **One family, one stroke on every page.** [Alan](https://mobbin.com/screens/4d3cc896-6618-43fd-843d-af4113902a68), [Bumble](https://mobbin.com/screens/9179b779-9f46-482a-bd56-d6d62253ef2c), [State Farm](https://mobbin.com/screens/9a7016fe-a7dd-4f4b-aec1-4660595e5b1e) and [Klarna](https://mobbin.com/screens/f363dff4-92cd-424c-97c2-9bb8a0e8eb3c) draw every row icon in the same outline family at the same weight; none mixes a thick filled glyph with a thin outline one.
2. **A small, fixed size ladder.** Row and tab icons sit at about 24, header and button icons at about 20–24, inline meta icons at 16, empty-state glyphs larger (see [Calm](https://mobbin.com/screens/28636a9e-a222-42a0-9570-1310d6245a9e)). Sizes are not improvised per screen.
3. **Containers are consistent by role.** Round 40–44 buttons for header actions ([Mesh](https://mobbin.com/screens/b288c1ea-de74-4436-a1a8-73b178674b13), [GitHub](https://mobbin.com/screens/54dc6bea-3fdc-4779-a21b-d496470b2ff1), [komoot](https://mobbin.com/screens/97f2d174-a803-4f1c-a994-288943f8b1c7)); soft rounded tiles for list-row leading icons ([Freeform](https://mobbin.com/screens/c387049f-6477-4a79-8bfe-b4e57e504eeb), [Monzo](https://mobbin.com/screens/ca8b2ea4-b00f-414f-a126-ea29dbae4643), [MoonPay](https://mobbin.com/screens/f0367201-1f23-46b2-a0d9-7fb6fc049fae)); bare glyphs for text-adjacent use.
4. **Colour follows meaning.** Ink for actions, a muted grey for decoration and chevrons, one accent for the active item ([Octopus Energy](https://mobbin.com/screens/097b12ec-66f3-4f80-ab66-f96b1986bf5e), [Kitchen Stories](https://mobbin.com/screens/fceaf215-75b6-48c8-8f3e-abdb1200eab5)).
5. **Tab bars carry the one filled style.** Apps that use filled glyphs keep them for navigation and the active state only; everything inside the page stays outline.

## Mova audit (before)
| Finding | Where |
|---|---|
| **Two icon families**: Rune (2px stroke) and Ionicons (different weight and shapes) | Rune in nav, header, buttons; Ionicons in list tiles, status helper, timeline, set-logging, routine editor |
| Ionicons "outline/filled" name variants mixed (`-outline`, `checkmark-circle`) | Session log, change timeline, routine editor |
| Off-scale sizes: 14, 18, 22, 26 | Status badge, inline icons, tab icons, set logging |
| Header round buttons at 20 inside 44 | Overview and Workouts headers |

## Mova after
- **Single family:** every icon is Rune, plus four custom icons drawn on the same 24px grid and 2px round stroke where Rune has none (dumbbell, footprints, utensils, droplet) and a chat-plus. The Ionicons dependency is no longer used in the app.
- **Size scale:** 16 (inline, badges), 20 (buttons, small controls), 24 (navigation, header buttons, row tiles, set logging), 28+ (empty states).
- **Roles:** round 44 header buttons hold 24 icons, 36 sheet controls hold 20, 32 card actions hold 20.
