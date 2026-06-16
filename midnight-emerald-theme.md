# Midnight Emerald Theme
> Complete design tokens and rules for the **Midnight Emerald** theme variant — oklch palette, glassmorphism utilities, gradients, fonts, and component patterns.

This repo also includes a **Classic** theme (selected in Settings). The rules in this document apply to the Midnight Emerald variant (`[data-theme="midnight-emerald"]`).

## Palette (oklch only — never hex/RGB)

| Token | Value | Usage |
|-------|-------|-------|
| `--background` | `oklch(0.18 0.03 180)` | Page background base |
| `--foreground` | `oklch(0.97 0.01 180)` | Primary text |
| `--card` | `oklch(0.23 0.035 185)` | Card surfaces |
| `--primary` | `oklch(0.78 0.14 170)` | Emerald/teal accent |
| `--primary-foreground` | `oklch(0.18 0.03 180)` | Text on primary |
| `--secondary` | `oklch(0.28 0.04 190)` | Secondary surfaces |
| `--muted` | `oklch(0.27 0.03 190)` | Muted backgrounds |
| `--muted-foreground` | `oklch(0.7 0.02 180)` | Secondary text |
| `--accent` | `oklch(0.32 0.06 185)` | Hover/active accents |
| `--destructive` | `oklch(0.65 0.22 25)` | Errors / warnings |
| `--border` | `oklch(1 0 0 / 8%)` | Borders everywhere |
| `--input` | `oklch(1 0 0 / 10%)` | Input backgrounds |
| `--ring` | `oklch(0.78 0.14 170)` | Focus rings |
| `--gold` | `oklch(0.82 0.14 85)` | Hijri date, highlights |
| `--teal` | `oklch(0.78 0.14 170)` | Primary glow, labels |

## Gradients

- `--gradient-bg`: layered radial + linear from `oklch(0.16 0.03 190)` to `oklch(0.2 0.04 180)` with teal glow orbs at top center and bottom-right
- `--gradient-card`: `145deg` from `oklch(0.26 0.04 185 / 0.9)` to `oklch(0.22 0.035 190 / 0.85)`
- `--gradient-next`: `135deg` from `oklch(0.32 0.09 170 / 0.85)` to `oklch(0.28 0.07 185 / 0.7)`

## Shadows

- `--shadow-glow`: `0 0 40px -10px oklch(0.78 0.14 170 / 0.5)` — for next-prayer hero card
- `--shadow-card`: `0 10px 40px -15px oklch(0 0 0 / 0.5)` — for glass cards

## Utilities (CSS / Tailwind)

- `.glass-card`: `var(--gradient-card)`, `backdrop-filter: blur(12px)`, `1px solid oklch(1 0 0 / 0.08)`, `var(--shadow-card)`
- `.next-card`: `var(--gradient-next)`, `1px solid oklch(0.78 0.14 170 / 0.35)`, `var(--shadow-glow)`
- `.text-teal` / `.text-gold`: map to vars
- `.ring-teal`: `0 0 0 1px oklch(0.78 0.14 170 / 0.6), 0 0 30px -5px oklch(0.78 0.14 170 / 0.4)`
- `.animate-pulse-soft`: opacity `1 ↔ 0.7` over `2s ease-in-out infinite`

## Fonts

- Display / body: **Plus Jakarta Sans** (Google Fonts, 400–700)
- Arabic: **Amiri** (Google Fonts, 400, 700)
- Apply `font-family: var(--font-arabic)` on `[dir="rtl"]`

## Component Patterns

- **Cards**: always use `.glass-card` or `.next-card`; never flat backgrounds
- **Countdown blocks**: `rounded-2xl`, `border`, `backdrop-blur-md`, `tabular-nums`; highlight seconds with teal border + `animate-pulse-soft`
- **Progress bars**: `bg-gradient-to-r from-teal/70 to-teal` with glow shadow `0 0 10px oklch(0.78 0.14 170 / 0.5)`
- **Decorative orbs**: `absolute`, `rounded-full`, `blur-3xl`, low-opacity teal backgrounds
- **Hard rule (Midnight Emerald only):** never use raw hex colors, `text-white`, `bg-black`, or hardcoded `oklch()` values in components — always reference CSS variables or theme tokens
