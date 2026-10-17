---
name: Mova
description: >
  Mobile-first design system for Mova, a calm, premium, AI-assisted fitness workspace
  with a modern feminine voice: blush-white pages, white cards, a berry-rose accent,
  lilac for the companion, soft peach warmth, plum-black text, very round shapes,
  and a floating tab bar. Built for a phone held in one hand.
version: 2.1
platform: ios, android, web (responsive, phone first)
research: docs/research/MOBBIN_DESIGN_SYSTEM_RESEARCH.md, docs/research/MOBBIN_FEMININE_PALETTE_RESEARCH.md

colors:
  # Blush ladder: the page is a warm blush-white, cards are white, wells sit one step down in soft pink.
  page: "#FAF5F6"          # app background
  page-top: "#FFF9F7"      # top of the page gradient
  surface: "#FFFFFF"       # cards, sheets, tab bar
  well: "#F2E6EB"          # inputs, tracks, inactive chips, grouped rows on cards
  hairline: "#EFE1E5"      # 1px dividers
  ink: "#2A2230"           # plum-black: all primary text
  ink-secondary: "#5A4F5F"
  ink-tertiary: "#73677A"  # meets 4.5:1 on page and surface
  ink-disabled: "#B5ABB8"
  on-ink: "#FFFFFF"        # text and icons on rose or ink fills
  # The one accent: berry rose. Primary buttons, selected states, progress, the thing that matters.
  rose: "#B03F6B"          # white text on it is 5.6:1
  rose-deep: "#8E2F55"     # text and icons that sit on rose-wash
  rose-wash: "#FBE7EE"     # tinted fills behind rose content
  blush: "#F6C9D6"         # decorative only: ring tracks, illustrations, glows (never text)
  # Companion voice: lilac, so AI output never looks like saved data.
  lilac: "#6552B8"         # star, "Draft" tags, proposal accents (text-safe on white and lilac-wash)
  lilac-wash: "#EFEBFA"
  lilac-soft: "#D9D0F2"    # decorative only
  # Warmth
  peach: "#F4B8A0"         # decorative only: gradient glow, empty-state art
  peach-wash: "#FFF0E8"
  # Status (always paired with words or an icon, never colour alone)
  positive: "#2F6B58"      # a calm green so success never reads as pink
  positive-wash: "#E3EFE9"
  caution: "#9A5A2E"
  caution-wash: "#FDEBDD"
  negative: "#B3261E"      # a true red, clearly different from rose
  negative-wash: "#FBE4E1"
  scrim: "rgba(42, 34, 48, 0.45)"

typography:
  family: "Inter (400, 500, 600, 700), three subset files in apps/mobile/assets/fonts (about 45 KB each); the page draws in the platform sans first on the web and swaps to Inter when it arrives"
  scale:
    display:  { size: 30, line: 38, weight: 600, tracking: -0.3, use: "Greeting on Overview and onboarding headlines" }
    title:    { size: 24, line: 30, weight: 600, use: "Tab titles and sheet titles (22 in sheets)" }
    heading:  { size: 20, line: 26, weight: 600, use: "Card titles" }
    heading-sm: { size: 18, line: 24, weight: 600, use: "Dense list headings (weekdays, More options)" }
    figure:   { size: 32, line: 36, weight: 600, tracking: -0.5, use: "Big numbers in rings and stats, with a small unit beside them" }
    body:     { size: 16, line: 24, weight: 400, use: "Reading text, inputs" }
    body-medium: { size: 16, line: 24, weight: 500, use: "Item names (meals, exercises)" }
    body-strong: { size: 16, line: 24, weight: 600, use: "Names and buttons" }
    small:    { size: 14, line: 21, weight: 400, use: "Descriptions and secondary lines" }
    label:    { size: 14, line: 20, weight: 500, use: "Field labels, small buttons, chips" }
    caption:  { size: 12, line: 16, weight: 500, use: "Meta, units, helper text" }
    eyebrow:  { size: 12, line: 16, weight: 600, tracking: 0.8, case: upper, use: "Section labels" }
  rules:
    - "One typeface everywhere. Hierarchy comes from weight and size, never from italics or a second family."
    - "No italic or slanted text anywhere, including greetings."
    - "Weight carries hierarchy, not size jumps. Labels are medium (500); 700 is not used in the interface."
    - "Numbers that change (timers, totals) sit next to a small unit in caption or label size."
    - "Minimum text size is 12; anything a person must read to act is 14 or larger."

spacing:
  unit: 4                 # everything is a multiple of 4; layout rhythm is 8
  scale: { xxs: 2, xs: 4, sm: 8, md: 12, base: 16, lg: 24, xl: 32, 2xl: 48, 3xl: 64 }
  screen-gutter: 16       # left and right margin on a 390-wide phone
  card-padding: 20        # inside cards; 16 for dense list cards
  card-inner-gap: 8       # between text lines inside a card (4 between a title and its summary)
  card-block-gap: 12      # between blocks inside a card (text, ring, button, list)
  card-gap: 12            # between cards in a stack
  group-gap: 24           # between two unrelated groups of cards
  section-gap: 32         # between titled sections, with a centred hairline
  section-title-gap: 12   # eyebrow to its first card
  header-height: 64
  touch-target: 44
  control-height: { input: 48, button: 48, button-sm: 40, chip: 36, row: 56, nav: 64 }

grid:
  columns: 4              # phone content grid (390): 4 columns, 16 gutter margins, 12 column gap
  column-gap: 12
  content-width: "device width minus 32"
  max-content-width: 560  # tablets and desktop: centred, same rules
  patterns:
    full: "1 column, one card per row (default)"
    two-up: "2 equal columns, 12 gap: paired tiles and quick actions"
    three-up: "3 equal columns, 8 gap: compact stats (macros, summary figures)"
    week-strip: "7 equal columns, 4 gap: weekday or date rail"
    split-row: "label flex + control fixed (216 for segmented, 36 to 44 for icon buttons), 12 gap"
  breakpoints: { phone: "< 600: 4 columns", tablet: ">= 600: content capped at 560, centred" }

radii:
  input: 16
  card: 24
  sheet: 32
  pill: 999

elevation:
  card: "none (a white card on the page needs no shadow)"
  floating: "0 8px 28px rgba(176, 63, 107, 0.14)"   # tab bar, FAB-like controls
  sheet: "0 -8px 32px rgba(42, 34, 48, 0.12)"

motion:
  fast: 120ms
  base: 200ms
  slow: 320ms
  easing: "cubic-bezier(0.2, 0, 0, 1)"
  reduced-motion: "Replace slides and fades with instant state changes; keep progress values updating."
---

# Mova Design System

## 1. Character

Mova is a quiet, encouraging place to plan training and eating. The interface should feel like soft morning light on a vanity table: blush-white, warm, uncluttered, with one berry-rose accent that says "this is yours, this is progress" and gentle lilac when the companion speaks.

Four words guide every decision: **calm**, **clear**, **yours**, **kind**.

- **Calm.** Few colours, very round shapes, generous space, no streaks, flames, confetti or red badges.
- **Clear.** One idea per card, one primary action per screen, text that says what will happen.
- **Yours.** Everything shown is the person's own plan. AI output is always labelled a draft until they approve it.
- **Kind.** Warm wording, no shaming, rest days treated as part of the plan. Colour is feminine and modern, never childish: no glitter, no cartoon pinks, no pastel overload.

This system is **mobile-first**: it is designed at 390 × 844 and scales up. Nothing depends on hover.

### Why this palette
Research on women-focused and wellness apps ([see note](docs/research/MOBBIN_FEMININE_PALETTE_RESEARCH.md)) shows the apps that feel modern, not saccharine, keep the page nearly white and let one saturated rose carry meaning, adding lilac and peach only as soft washes. Mova follows that: blush-white and white do the work; berry rose is used sparingly and always at accessible contrast; lilac belongs to the companion; peach is atmosphere.

## 2. Principles

1. **One thing at a time.** Each card answers one question (What is today's workout? How far into my fast am I?). If a card needs two answers, it is two cards.
2. **One ring per card, one number per ring.** Progress is a ring or a bar, never both, never stacked.
3. **Edit on the object.** A pencil on a card edits that card in a short sheet. Long forms are a last resort.
4. **Labels, not colour.** Status always has a word or icon. Rose means progress or selected, never "good"; success is a separate green.
5. **Draft until approved.** Anything the companion produces is marked as a proposal and changes nothing until the person approves.
6. **Honest empty states.** Say what is missing and offer one next step. Never fill space with invented data.
7. **Thumb-first.** Primary actions live in the lower half of the screen. Nothing important sits only in a corner that needs a stretch.

## 3. Colour

### Surfaces (back to front)
`page` (a faint `page-top` → `page` fade with a soft lilac glow at the top right and a peach glow at the bottom left, each under 40% opacity) → `surface` (cards, sheets, tab bar) → `well` (inputs, tracks, segmented controls, grouped rows on a card).

- Cards are white on the page. They have **no border and no shadow**; the contrast between `surface` and `page` is the edge.
- Inputs are `surface` with **no outline**. When an input sits on a white card it uses `well` instead so it stays visible.
- Inside a white card, secondary groups use `well`, not another white card.

### Accent and meaning
| Token | Use |
|---|---|
| `ink` (plum-black) | All primary text and icons on light surfaces |
| `rose` | Primary button, selected tab pill, selected segment and chip, checked checkbox, send button, progress rings and bars, positive-state toggle |
| `rose-wash` | Soft fill behind rose icons and "Active" tags, selected rows |
| `rose-deep` | Text and icons on `rose-wash` |
| `blush` | Decoration only: ring tracks, glows, illustration fills. Never carries text |
| `lilac` / `lilac-wash` | Companion only: the star button, "Draft" and "Proposal" tags, proposal cards |
| `peach` / `peach-wash` | Warm atmosphere: page glow, empty-state art, rest-day notes |
| `positive`, `caution`, `negative` | Status text and tags, always with a word. Success is green so it never reads as brand |

Rose is used on **one primary action and the current selection per screen**. If three things on a screen are rose, two of them should not be.

### Contrast
Body text on `page` and `surface` is at least 7:1 (`ink`) and secondary text at least 4.5:1 (`ink-tertiary`). White on `rose` is 5.6:1, `rose-deep` on `rose-wash` is 6.6:1, `lilac` on white is 6.1:1 and on `lilac-wash` 5.2:1; every pair above clears 4.5:1. Disabled text is exempt but still readable.

## 4. Typography

**Typeface: Inter.** A modern, clean, highly legible sans designed for screens: even letter shapes, clear numerals and a wide weight range, so hierarchy comes from weight and size alone. It is neutral enough to let the blush palette and rounded shapes carry the feminine warmth, stays crisp at 12–14px, and feels at home next to the iOS and Android system fonts. It is loaded from three Latin-subset files (400, 500, 600; about 45 KB each, `apps/mobile/assets/fonts`) so the first load stays small. On the web the first screen draws straight away in the platform sans and swaps to Inter when the font arrives; on phones the fonts are bundled. Researched in [`docs/research/MOBBIN_TYPOGRAPHY_RESEARCH.md`](docs/research/MOBBIN_TYPOGRAPHY_RESEARCH.md).

Custom fonts carry their weight in the family name, so `Text` turns a weight into a family (400 → Regular, 500 → Medium, 600 → SemiBold, 700 → Bold) and never fakes bold. Inputs and headers set their family explicitly.

| Role | Size / line | Weight | Used for |
|---|---|---|---|
| Display | 28 / 36 | 600, -0.3 tracking | Onboarding headlines |
| Title | 22 / 28 | 600 | Tab titles, sheet titles; Overview status headline is 24 / 30 |
| Heading | 18 / 24 | 600 | Card titles ("Needs an update", "On the Menu") |
| Heading small | 16 / 22 | 600 | Weekday cards, "More options" |
| Figure | 30 / 34 | 600, -0.5 tracking | Big numbers in rings and stats |
| Body | 14 / 22 | 400 (names 500, buttons 600) | Reading text, inputs, meal and exercise names |
| Small | 14 / 21 | 400 | Descriptions, secondary lines |
| Label | 14 / 20 | 500 | Field labels, small buttons, chips |
| Caption | 12 / 16 | 500 | Meta, units, helper text |
| Eyebrow | 12 / 16 | 600, +0.8, uppercase | Section labels such as `YOUR ROUTINES` |

**Greeting:** the Overview has no greeting line; the header shows the name and long date beside the avatar. No italic, no coloured word anywhere.
**Numerals:** large figures use the 600 weight with a small unit beside them (for example `32` with `ml`), the pattern seen in the reference health apps.

## 5. Layout, spacing and grid

Measured against the reference apps ([Alan](https://mobbin.com/screens/65cf48fa-1754-405a-a945-68d640373445), [Bevel](https://mobbin.com/screens/5e9f39ef-11f4-4dac-a75d-1106b70e9f5f), [Cal AI](https://mobbin.com/screens/0b3110f9-55d7-4828-94ba-231ba6ad8bfd), [Future Pro](https://mobbin.com/screens/d8f2e00a-c4e6-4d2d-8af4-edcff4f5e25d), [Runna](https://mobbin.com/screens/7e17aa1e-5ddb-4327-832b-201fde677aa2), [Centr](https://mobbin.com/screens/718c28d7-fa13-491b-8fa1-f695bc360164)): they keep a 16 side margin, about 12 between cards, 20 inside a card, and lay paired content out as 2-up or 3-up tiles rather than ever-longer single columns.

### The 4-point base, 8-point rhythm
Every size, padding and gap is a multiple of 4. Layout rhythm (gaps between things) uses 8, 12, 16, 24, 32. Odd values such as 6, 10, 14, 18 are not used; tight optical nudges may use 2.

### Margins and gutters
- **Screen gutter:** 16 left and right on a 390-wide phone. Cards run the full width inside it.
- **Column grid:** 4 columns with a 12 column gap for card layouts. Content spans all 4 by default.

### Vertical rhythm
| Between | Space |
|---|---|
| Text lines inside a card | 8 (4 between a title and its summary) |
| Blocks inside a card (text, ring, button, list) | 12 |
| Cards in a stack | 12 |
| Two unrelated groups of cards | 24 |
| Titled sections | 32, with a 1px `hairline` centred in the gap |
| Section eyebrow and its first card | 12 |
| Header (64) and first content | 8 |
| Last item and the nav | `nav height (64) + 12 + bottom inset + 16` of scroll padding |

### Card internals
Padding 20 on all sides (16 for dense list cards such as weekday and routine rows). Text lines are 8 apart (4 between a title and its one-line summary); separate blocks such as a ring, a button or a list are 12 apart. Rows inside a card are at least 56 tall and are separated by a hairline, with the row's own padding doing the spacing, so no extra gaps are added.

### Grid patterns
| Pattern | Columns | Gap | Use in Mova |
|---|---|---|---|
| Full | 1 | 12 | Overview cards, routines, goals, meal days |
| Two-up | 2 | 12 | Paired tiles and quick actions (for example Fasting beside a second module if one is enabled) |
| Three-up | 3 | 8 | Compact figures: sessions done this week, planned, rest days |
| Week strip | 7 | 4 | Weekday selector in Meal plan and Schedule; each cell at least 44 wide |
| Split row | flex + fixed | 12 | Settings units (label left, 216 segmented right), toggle rows, list row with trailing control |

Tiles in a 2-up or 3-up row share one height (the tallest sets it) and use the same radius and padding as a full card, reduced to 16 inside when the tile is under 160 wide.

### Alignment
- Text, icons and controls inside a card share one left edge (the card padding). A ring or icon beside text is aligned on its centre line, and stacked text blocks left-align to each other (as the Fasting card does).
- Section labels align to the gutter, not to the card padding.
- Trailing controls (chevrons, edit pencils, archive icons) sit on the card's right padding edge and align to the first line of text.

### Safe areas and keyboard
The header respects the top inset. The floating nav sits 12 above the bottom inset. Screens with a composer lift above the keyboard; the nav hides while a native keyboard is open.

### Wide screens
Content is capped at 560 wide and centred; the nav row is capped to the same width. Cards never stretch beyond 560.

## 6. Navigation

### Floating nav (bar plus companion button)
Modelled on [Alan](https://mobbin.com/screens/1d8e8577-abc5-4234-8d8e-ebdfd43eae92) and echoed by [Fresha](https://mobbin.com/screens/4896d295-e23e-4adc-8b6c-75767d1058a1), [Future Pro](https://mobbin.com/screens/d8f2e00a-c4e6-4d2d-8af4-edcff4f5e25d), [Superpower](https://mobbin.com/screens/e161ce23-7a66-4f9f-ba68-0c8621498ddd), [Apple News](https://mobbin.com/screens/29622411-b22a-485f-8851-74db23307865) and [Gentler Streak](https://mobbin.com/screens/14694404-10b6-403b-a01e-6b0afbbd4346).

- **Two floating pieces on one row**, 16 from the sides and 12 above the bottom safe area, 12 apart: a white **pill bar** (flex, 64 tall, `floating` shadow) and a separate **round companion button** (64 × 64, white, same shadow) holding the Mova mascot.
- **Bar:** three destinations, **Overview**, **Workouts**, **Meal plan**. Each item stacks a filled 22 icon over an 11/500 label.
- **Active item:** a soft `rose-wash` capsule that wraps both the icon and the label (it fills the item); icon `rose`, label `rose-deep`. **Inactive:** icon and label in `ink-tertiary`, no capsule.
- **Companion button:** the only way into Mova Companion. Opens the chat; no other floating button exists. Accessible name "Open the Mova companion".
- Hides while a native keyboard is open. The **Overview header only** carries the profile **avatar** (44, top left, display only, not tappable): a friendly round character picked at random the first time the app opens on a device (6 palettes: rose, lilac, peach, mint, blush, mauve, times 7 accessories: bear, cat, bunny, bun, sprout, bow, none) and kept after that and the History and Settings round icon buttons (44) at the top right. Workouts shows New routine (plus) and Schedule (calendar); Meal plan shows just its title. The buttons are filled **white at 72% opacity** so they lift off the blush page (a `well` fill would disappear into it); the active one turns `rose` with an `on-ink` icon.

### Sub-pages
Every pushed page has a **back chevron** at the top left that returns to the previous page (or to Overview when there is none). Sheets and modals use an **×** at the top right.

## 7. Components

### Buttons
| Variant | Fill | Text | Use |
|---|---|---|---|
| Primary | `rose` | `on-ink` | The one main action ("New routine", "Add goal") |
| Secondary | `well` (blush) | `ink` | Everything else ("Open meal plan", "Set time") |
| Ghost | none | `rose-deep` | Low-emphasis text actions ("Exercise history") |
| Danger | `negative-wash` | `negative` | Destructive confirmations |

48 tall, pill radius, 16/500 label, 24 horizontal padding. **No outlines on any variant.** Small buttons are 40 tall. Buttons in the same row share the same height and, when side by side, equal width. Pressed state lowers opacity to 0.85; disabled uses 40% opacity.

### Cards
`surface`, radius 24, padding 20, gap 12 inside. A tappable card shows a trailing chevron or an arrow-up-right icon. A card with an edit action shows a **pencil icon button (32)** at its top right.

### Expandable card
A card whose header is the title (20 or 18) with an optional one-line summary and a chevron. The body holds details and, at most, one secondary button. Items inside are separated by **hairline dividers**, with no icons unless they carry meaning.

### List row
Left: optional 40 icon tile. Middle: item name (body-medium) with an optional caption above (eyebrow) or a grey line below (small). Right: chevron or a control. Rows are at least 56 tall.

### Section header
Eyebrow label left, optional text action right. Sections are separated by a hairline divider and 32 of space.

### Field contrast
A field's fill depends on what it sits on, so it never matches its background: on a **white card or sheet** a field is a blush `well`; on the **blush page or on a tinted block** (lilac proposal card, tinted note, exercise block) it is **white**. The app does this with a field-tone context: `Screen` sets white, a white `Card` or `ExpandableCard` sets well, tinted cards and the exercise block set white, and sheets set well. Selected states (rose) never depend on this.

### Companion page
Mova Companion is a standalone page with **no nav bar**. It shares the app's look: the blush gradient, a transparent header with a back chevron and a 20/600 title, rose bubbles for the person, lilac-wash bubbles and proposal cards for the assistant, and the same composer. Sub-page titles are 20/600; tab titles are 24/600.

### Inputs
`well` (a soft blush) on both page and white cards, radius 16, 48 tall, 16 text, **no outline**. The label sits above at 14/500 (regular 400 inside dense editors). Focus is shown by a `rose` caret and a faint `rose-wash` ring that fades in; errors add a 1px `negative` outline and a message below. Placeholders use `ink-disabled`.

### Selection controls
- **Segmented control:** `well` track, selected segment `rose` with `on-ink` text, pill radius, no borders. In Settings it sits **on the same row as its label**, with a fixed 216 width so stacked rows align.
- **Pill select (chips):** `well` pills, selected `rose` with white text. Multi-select pills expose a checked state to assistive tech.
- **Checkbox:** 24 square, radius 6, 2px `ink-disabled` border; checked = `rose` fill with a white check.
- **Toggle:** the platform's standard switch shape; **on = `rose`**, off = `blush`; thumb white. Rows have the label (500) and an optional grey description.

### Progress ring
96 diameter, 8 stroke, `blush` track, `rose` arc with round caps, starting at 12 o'clock. The figure inside is `figure` style. Empty state shows an empty track and a dash. One ring per card; paired with text to its right (title, "0h 53m of 16h 0m", "Ends at 10:44") aligned on one left edge.

### Composer (companion)
One white rounded container (radius 24, min 48 tall) holding the input and a **36 round button** on the right:
- **Empty:** a `lilac-wash` circle with a **star** icon in `lilac`. Tapping opens the options sheet.
- **With text:** a `rose` circle with a white **arrow-up** (send). While sending, a spinner replaces the arrow.
- Input grows from 1 to 5 lines; Enter sends on web, Shift+Enter adds a line. A one-line grey note below says the demo assistant is simulated and nothing is saved until approval.

### Options sheet
A centred card (radius 32) over the scrim, titled "What would you like to do?" with a × on the right, then full-width option rows (`well`, radius 16, 56 tall). When the assistant offers a draft, the first option is that action. No action buttons appear inside chat bubbles except links to review an existing proposal.

### Modal and bottom sheet
`surface`, radius 32, padding 24, 16 gap. Title left, **× right**. A primary button at the bottom spans the width of the inputs above it. Tapping the scrim closes the sheet.

### Tags
Pill, 12/500: `positive-wash` + `positive` for Active, `well` + `ink-tertiary` for plain Draft, `lilac-wash` + `lilac` for companion Draft and Proposal, `rose-wash` + `rose-deep` for Selected or Today, status washes for others.

### Icons
One family, one stroke, a small size ladder. Researched in [`docs/research/MOBBIN_ICON_RESEARCH.md`](docs/research/MOBBIN_ICON_RESEARCH.md).

- **Family:** Rune Icons only, outline, 24-px grid, 2px round stroke. Where Rune has no glyph (dumbbell, footprints, utensils, droplet, chat-plus) Mova draws one on the same grid and stroke. No second icon library is used anywhere.
- **Filled** icons appear only in the nav bar and are tinted by state (rose when active, `ink-tertiary` otherwise). All other icons are outline.
- **Sizes:** `16` inline with small text and status badges · `20` inside buttons, 36 and 32 round controls, composer button, chevrons · `24` navigation, 44 round header buttons, list-row leading tiles, set logging · `28+` empty states and illustrations. Never 14, 18, 22 or 26.
- **Containers by role:**
  - Round header and sheet controls: 44 (header), 36 (sheet), 32 (card action); fill white at 72% opacity, icon `ink`.
  - Leading tiles in rows: 44 rounded square (`radius lg`), fill `well`, glyph 24 in `rose-deep`.
  - Bare glyphs sit beside text: 16 in `ink-tertiary` for meta, 20 in `ink` or `ink-secondary` for actions.
- **Colour by meaning:** `ink` for actions, `ink-tertiary` for decoration and chevrons, `rose` for the active or selected item, `lilac` for the companion (star), status colours only inside status badges, `on-ink` on filled rose or ink.
- **Pairing:** an icon never carries meaning alone; a label, accessible name or adjacent text always does (status badges are icon plus word).
- **Chevrons:** `chevron-right` 20 in `ink-tertiary` on tappable rows; `chevron-down`/`up` 20 on expandable cards.

### Mascot
The Mova bubble mascot has **one face and several poses**. Every pose is the same rose-faced bubble with plum-black eyes and blush cheeks, drawn in the palette (never yellow or mustard); only the pose and a small prop change, and each pose is tied to a state:

| State | Pose |
|---|---|
| Rest day on Overview | `rest` (eyes closed) |
| Nothing scheduled, quiet history, Fasting page | `calm` |
| No routine yet, empty routines | `planning` |
| No meal plan | `nutrition` |
| Empty goals, companion greeting | `focus` / `welcome` |
| Hydration | `hydration` |
| Records and monthly review | `checklist` |
| Today's workout done, every goal achieved | `celebration` |
| Companion is thinking, empty exercise history | `thinking` (with a small lilac "?" bubble) |

The **companion button in the nav is always the same**: the `thinking` face without its "?" bubble, on every page. On white it needs at least a 30px body (about a 72 px canvas); the companion button uses a 76 px canvas. Each drawn mascot gets its own gradient ids so several can sit on a page, including inside hidden tabs, without losing their fill. Source SVGs are in `assets/illustrations/mova/`.

### Bottom sheets
Mova Companion, Settings, History, Schedule and New routine (and Edit routine) open as **bottom sheets** over the page you were on, not as new pages.
- **Shape:** page-coloured surface, 32 top radius, up to 780 tall (never above the top inset), 640 max width, a 40 × 5 handle, a 22/600 title on the left and round controls on the right (close, plus back, add or new chat when needed). **Every round control in a sheet header is 36**, the same in Settings, History, Goals and the companion. The companion sheet hides its title to give the chat more room; its header keeps a **sticky new-chat button (a chat bubble with a plus inside)** beside the close button, both outside the scrolling thread, and the title stays available to screen readers, a dimmed scrim behind.
- **Close:** drag the handle or title down (past 110 or with a quick flick; otherwise it springs back), tap the scrim, press Escape on the web, or press the close button. All four work; none is required.
- **Motion:** slides up in 260ms and down in 200ms; the scrim fades with it.
- **Accessibility:** the sheet is a modal dialog with an accessible name, the handle exposes a "close" action to screen readers ("Drag down to close Settings"), the close button is 44 × 44, and content scrolls inside the sheet while the header stays put.
- **Sub-views stay inside the sheet:** Settings opens Goals in the same sheet with a back chevron and an add (+) button beside the close button, instead of pushing a new page. The date pill in History is white like every other card.
- Fields inside a sheet follow the field-contrast rule (white fields on the page-coloured sheet, blush fields in white cards).

### Dividers
1px `hairline`. Used between sections, between rows inside a card, and between settings groups. Never as a box outline.

### Banners
`positive-wash`, `caution-wash` or `negative-wash` fill, radius 16, an icon, one sentence. Informational notes use `well`.

## 8. Screens

### Overview
Top-right: History and Settings round buttons. Then a small uppercase date, and the greeting in `display` (plain text, no italics). Cards in order: **Needs an update** (expandable, only when relevant) → **Today's workout** (card, no label, no "See all") → **On the Menu** (expandable; item names medium; hairline dividers; secondary "Open meal plan" button) → **Fasting** (one card: ring on the left; "Fasting" label, progress text and end time on one left edge; the whole card opens the fasting page). Hydration is not shown. Empty states are a single honest card with one action.

### Workouts
The header carries two round icon buttons at the top right, like Overview: **plus (New routine)** and **calendar (Schedule)**. Both open bottom sheets; there is no full-width New routine button and no "See all" link. Sections are **Your routines** (card per routine; tap opens it) and **Upcoming workouts** (next 14 days), separated by a hairline. **Exercise history** is a plain left-aligned text action at the end. Opening a routine shows one card per training day with a **pencil** that edits only that day in a sheet; there is no version history and no routine-level text block.

### Meal plan
Timetable and Shopping list tabs. Seven expandable cards, one per weekday, titled at 18/600; meal names medium; slot labels as eyebrows; hairlines between meals.

### Fasting
Status block (mascot, state, since / until), start or end button, then **Schedule** (start time and length, regular-weight labels, save) and, if present, **Recorded fasts**, separated by a hairline. No preset chips and no disclaimers block.

### Goals
Header "+" opens the add-goal modal (title, equal-width High / Medium / Low segments, full-width Add goal, × top right). Each goal card has a checkbox on the left (achieved) and an archive icon top right.

### Settings
Header has a back chevron. Groups, each with an eyebrow and a hairline between them: **Units** (label left, 216-wide segmented control right), **Time zone**, **Goals** (a tappable summary card of active goals or an invitation to add one), **Training equipment** (the section label is the only label; one field with the placeholder "Enter the equipment you use" when empty, saved on blur), **Intermittent fasting** (expandable card with a toggle; "Set time" appears when on), **Reminders** (toggle), **Reset demo data** (button only, with a confirm step).

### Onboarding
Three short questions, one per screen, researched in [`docs/research/MOBBIN_ONBOARDING_RESEARCH.md`](docs/research/MOBBIN_ONBOARDING_RESEARCH.md). No nav bar, no header: a back chevron (44) and three progress segments (4 tall, `blush` track, `rose` fill) at the top; the mascot (132, one pose per step); a 12/500 uppercase lead-in; a 30/38 headline; then the answer; and a pinned full-width Continue (disabled until answered) at the bottom. Content is capped at 520 wide and centred.
1. **Name.** "Hi! What should I call you?" One large centred field (60 tall, radius 24, white on the page), auto-focused. "Skip for now" is a centred text link under Continue.
2. **Experience.** "Have you used a fitness app before?" Two choice cards: "Yes, I have" continues; "No, I'm new to this" goes straight to the Overview with no further questions.
3. **Routine.** "Do you have a workout routine you follow?" "Yes, I have a routine" opens the routine sheet (exercise, sets, reps only; sets 3 and reps 10 prefilled; no names, weights or days to fill in) and returns to the Overview when saved. "No, create with Mova" goes to the Overview and opens Mova Companion, which asks one question at a time and saves nothing until the person approves.

**Choice card:** a white card (radius 24, min 88 tall, 24 side padding) with a 18/600 title, a 14 hint and a 28 radio mark on the right. The whole surface is the tap target. Selected = `rose-wash` fill, 2px `rose` ring and a rose check (never colour alone); keyboard focus adds a 4px rose-tinted ring; the group is a `radiogroup` and each card a `radio` with a checked state. No auto-advance, so a mis-tap never moves someone on.

Steps ease in over 260ms and skip the movement when reduced motion is on. The headline of each step is announced politely when it changes.

**After onboarding the Overview shows only what exists.** A new person's workspace is empty: no sample routines, sessions, meals or fasting. Empty states say what is missing and offer one action: "No routine yet" (New routine), "On the Menu: No meal plan yet" (Plan my meals, opens the companion on meals), "Fasting: Not set up" (Set up fasting). The greeting adds the person's name ("Good morning, Ada").

### Companion
Messages: yours on `rose` with white text, assistant on `lilac-wash`. The empty state shows a short greeting. Proposals appear as cards with a "Draft" tag and a Review button. The composer and options sheet are described above.

## 9. States

- **Loading:** a soft spinner with a short label ("Loading…"); content areas keep their space to avoid jumps.
- **Empty:** one sentence of what is missing plus one action. No illustrations unless they add meaning (the mascot appears only in Fasting and the empty companion).
- **Error:** a `negative-wash` banner with a retry action; never a blank screen.
- **Offline / demo:** a single quiet line states that data is saved on this device.

## 10. Motion

Short and soft. Cards expand with a 200ms height ease; sheets fade in 200ms; the progress arc animates to its value over 320ms; message bubbles rise 8px while fading in. Respect reduced-motion by removing movement and keeping state changes instant.

## 11. Accessibility

- All tap targets are at least 44 × 44.
- Every icon-only control has an accessible name ("Back", "Archive Lower body", "Choose what to ask").
- Selection is conveyed by state (checked, selected, expanded) as well as colour.
- Text scales with the system setting; layouts wrap instead of truncating essential content.
- Rings and bars expose a progress value and label ("Fasting progress toward your target, 6%").
- Focus order follows reading order; sheets trap focus and return it on close.

## 12. Do and don't

| Do | Don't |
|---|---|
| White cards on a pale page with no border | Outlined inputs, outlined buttons, boxed sections |
| Medium-weight labels and item names | Bold everywhere |
| One ring per card with text beside it | Stacking rings, bars and charts |
| A hairline between categories | Heavy bands or extra card nesting |
| A star that becomes send | Action buttons inside chat bubbles |
| Back chevron on every sub-page | Dead ends that need the system gesture |
| Plain words ("Set time") | Internal terms ("Open fasting", "AI version 2") |
| `rose` for the primary action, selection and progress | Rose on every element, streaks, flames, neon, glitter or cartoon pinks |
| Lilac only for the companion | Lilac as a second brand colour |
| Blush and peach as soft glows | Pink text on pink, or blush used for anything the user must read |

## 13. Current build vs. this system

The running app follows version 2.1: the rose palette, the blush page with lilac and peach glows, radii of 24 / 16 / 32, and the floating nav with a separate round companion button. Old token names (`canvas`, `cream`, `brand`, `sage`) remain in `apps/mobile/src/theme/tokens.ts` as aliases of the new values and can be removed gradually.

### Overview layout (current)

Header: avatar, name (16/600) and long date (12) with History and Settings on the right. Then the status section (large Mova mascot on a status glow, 24/30 headline, 14/400 supporting line, button only when work needs attention). Training and Nutrition sit side by side as equal cards: a filled 24 icon on a 40 tile at the top left (Training teal `#1f7a78` on `#dff2ef`, Nutrition apricot `#c2652a` on `#fdeadd`), the uppercase category label on the same line, right of the icon, then an 18/600 title and 14 detail; no chevron, the whole card is the tap target. Fasting is full width with a `FASTING` label top left, elapsed-of-target on the left and a progress ring on the right.

**Icon sizes:** 20 for every icon in sticky headers and sheet controls (History, Settings, Back, Close, chevrons) and for icons in body rows; 24 only for the filled icons on the Overview cards and the floating nav; 16 for inline status marks.

**Overview status illustrations and colours:** needs attention uses the `oops` pose (worried brows, soft frown, sweat drop) on a soft red-pink blob, a 24/600 headline in `#c93445` and a raspberry `#cf3a4a` button (white text, 4.8:1); up to date uses the `cheer` pose on a blush blob with default ink text; not set up uses the `welcome` pose on a rose-wash blob. All blobs are the same organic shape, never a plain circle; there is no green in this section.
