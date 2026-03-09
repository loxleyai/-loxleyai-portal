# CLAUDE.md — Loxley AI Corridor Intelligence Portal

## Project Overview

Subscriber-gated intelligence dashboard for Watkins-scored real estate corridors. Static HTML/CSS/JS site deployed on Vercel.

## Tech Stack

- **Frontend**: Vanilla HTML, CSS, JavaScript (no framework)
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

### Project Structure

```
/                       # Project root
├── CLAUDE.md           # AI assistant guide (this file)
├── README.md           # Project readme
├── FILE_MANIFEST.md    # Categorized file inventory
├── .gitignore          # Git ignore rules
└── .claude/            # Claude Code configuration
    ├── agents/         # Custom agent definitions
    └── commands/       # Custom slash commands
```

## Conventions

- This is a static site — no build step, no bundler, no package manager required.
- Entry point is `index.html` (to be created).
- Keep dependencies minimal; prefer vanilla JS over frameworks.
- Use semantic HTML and accessible markup.
- CSS should be in separate stylesheet(s), not inline.

## Deployment

Vercel auto-deploys from the repo. No build command or output directory configuration needed — Vercel serves files as-is.

## Git Workflow

- Default branch: `master`
- Feature branches prefixed with `claude/` for AI-assisted work.
- Write clear, descriptive commit messages.

## Key Domain Concepts

- **Corridors**: Real estate geographic areas scored by the Watkins methodology.
- **Watkins Score**: A proprietary scoring system for evaluating real estate corridors.
- **Subscriber Gate**: Access control — dashboard content is gated behind a subscription.
