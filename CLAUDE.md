# CLAUDE.md — Loxley AI Corridor Intelligence Portal

## Project Overview

Subscriber-gated intelligence dashboard for Watkins-scored real estate corridors. Static HTML/CSS/JS site deployed on Vercel. Single-file architecture — the entire portal lives in `index.html`.

## Tech Stack

- **Frontend**: Vanilla HTML, CSS, JavaScript (no framework)
- **Fonts**: Google Fonts — DM Sans (body), Space Mono (data/numbers)
- **Local Dev Server**: Python 3 HTTP server
- **Deployment**: Vercel (auto-deploys from repo)
- **Domain**: loxleyai-portal.vercel.app

## Development

### Local Setup

```bash
# Serve locally on port 3000
python3 -m http.server 3000

# Or open index.html directly in a browser
```

### Access Codes (client-side gate, sessionStorage)

- `loxley2026`
- `margaret2026`

### Project Structure

```
/                       # Project root
├── index.html          # Complete portal (gate + dashboard + detail views)
├── vercel.json         # Vercel routing config (SPA catch-all)
├── CLAUDE.md           # AI assistant guide (this file)
├── README.md           # Project readme
├── FILE_MANIFEST.md    # Categorized file inventory
├── .gitignore          # Git ignore rules
└── .claude/            # Claude Code configuration
    ├── agents/         # Custom agent definitions
    └── commands/       # Custom slash commands
```

## Architecture

### Two-State Portal

1. **Access Gate** — Centered card with access code input. Valid codes stored client-side. Access persisted in `sessionStorage`.
2. **Dashboard** — Three corridor summary cards in a responsive grid. Clicking a card reveals a full detail view with score breakdown, executive summary, investment thesis, demand wave visualization, projects table, supply analysis, recommendations, and risk factors.

### Design System (CSS Custom Properties)

All colors, surfaces, and accents use `--lox-*` CSS variables defined in `:root`. Key tokens:
- `--lox-charcoal` (#1a1a2e): primary background
- `--lox-gold` (#c9a84c): primary accent
- `--lox-surface` (#111122): card backgrounds
- `--lox-navy` (#16213e): header / elevated surfaces

### Data

All corridor data is hardcoded in the `CORRIDORS` JavaScript array. Three corridors:
- Dayton Defense (score 85)
- Phoenix Semiconductor (score 87)
- I-270 East Columbus (score 79)

Each includes: Watkins score factors, executive summary, investment thesis, demand wave model, projects, supply metrics, recommendations, and risk factors.

## Conventions

- This is a static site — no build step, no bundler, no package manager required.
- Entry point is `index.html`.
- Keep dependencies minimal; prefer vanilla JS over frameworks.
- Use semantic HTML and accessible markup.
- CSS lives in a `<style>` block inside `index.html` (single-file architecture).
- Mobile-responsive — must work on phone (Timothy demos from his phone).

## Deployment

Vercel auto-deploys from the repo. `vercel.json` provides SPA-style catch-all routing. No build command or output directory needed.

## Git Workflow

- Default branch: `master`
- Feature branches prefixed with `claude/` for AI-assisted work.
- Write clear, descriptive commit messages.

## Key Domain Concepts

- **Corridors**: Real estate geographic areas scored by the Watkins methodology.
- **Watkins Score**: A proprietary scoring system (five factors weighted 30/25/20/15/10%) for evaluating real estate corridors.
- **Demand Wave**: Five-phase model (Site Prep → Construction → Commissioning → Ramp-Up → Steady State) for corridor demand lifecycle.
- **Subscriber Gate**: Access control — dashboard content is gated behind an access code.
- **Signal**: Action classification — IMMEDIATE ACTION (green) or STRONG OPPORTUNITY (teal).
