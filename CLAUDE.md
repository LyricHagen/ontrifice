# Ontrifice

Cross-market structural risk analyzer for prediction markets. Detects provable logical relationships between contracts across Polymarket and Kalshi and uses them to compute true portfolio max loss. The dependency graph is the inference layer; the risk solver is the output layer.

## Stack

- Next.js 15 (App Router, TypeScript strict)
- Tailwind CSS 4
- PostgreSQL with Drizzle ORM
- Fonts: JetBrains Mono (code/data), IBM Plex Sans (body). Loaded via next/font from Google Fonts. No Inter, no Geist, no Space Grotesk.

## Git

- Always commit as "LyricHagen" with email "lyrichagen@users.noreply.github.com"
- Commit messages: all lowercase, laconic (3-6 words max), no emojis, no conventional commit prefixes
- Never use co-authored-by or signed-off-by headers

## Routes

```
/                landing (public)
/analyzer        portfolio risk analyzer (public)
/constraints     proven market relationships browser (public)
/graph           relationship network visualization (public)
/docs            API documentation (public)
/login           auth (public)
/signup          auth (public)
/settings        account & API keys (protected)
/privacy         privacy policy (public)
```

## Design System

### Color

- CSS variables defined in globals.css under `[data-theme="dark"]` and `[data-theme="light"]`
- Dark mode default. Toggle persists in localStorage.
- Dark: off-black backgrounds (#0a0a0a, #111111, #1a1a1a), white/gray text
- Light: true white/near-white, near-black text
- Single accent: #4a7cff (links, active states, interactive elements only)

### Constraints (enforced strictly)

- NO gradients anywhere
- NO drop shadows (use 1px solid borders with low-opacity colors)
- NO rounded corners beyond 2px (border-radius: 2px max)
- NO emojis anywhere in UI or codebase
- NO hover animations or transitions (instant state changes only)
- NO neon colors, no pastels, no rainbow anything
- NO dot grids, radial orbs, sparkle icons, animated arrows
- NO bento grids
- NO cards displayed 3-in-a-row
- Borders and lines only: 1px solid, muted colors
- Typography hierarchy: size and weight only, no color tricks
- Data-dense layouts. Respect the user's intelligence.

### Accessibility

- All interactive elements must have visible focus states (outline, not shadow)
- Focus: `outline: 2px solid var(--accent); outline-offset: 2px`

### Errors

Every user-facing error must include:
1. What happened
2. Why it might have happened
3. What the user can do about it
4. A machine-readable error code (e.g., ERR_MARKET_FETCH_TIMEOUT)

## Coding Conventions

- TypeScript strict mode
- Prefer server components; use "use client" only when necessary
- No default exports for components (except pages/layouts per Next.js convention)
- All colors via CSS variables, never hardcoded in components
- Font classes: `font-mono` for JetBrains Mono, `font-sans` for IBM Plex Sans
