# CLAUDE.md — Loxley AI Corridor Intelligence Portal

## Project Overview

Subscriber-gated intelligence dashboard for **Watkins-scored real estate corridors**. The portal surfaces corridor analytics and buyer intelligence reports for real estate brokers.

- **Stack**: Static HTML / CSS / JavaScript (no build step)
- **Hosting**: [Vercel](https://vercel.com) — [loxleyai-portal.vercel.app](https://loxleyai-portal.vercel.app)
- **Entry point**: `index.html`

## Repository Structure

```
/
├── index.html          # Main application entry (to be created)
├── README.md           # Project overview and deploy info
├── CLAUDE.md           # This file — AI assistant guide
├── .gitignore          # Ignores .vercel, node_modules, .DS_Store, Claude worktrees
└── .git/
```

> This repo is in early scaffold stage. Source files, assets, and dependencies will be added as the portal is built out.

## Local Development

```bash
# Serve locally on port 3000
python3 -m http.server 3000

# Or open index.html directly in a browser
```

No `npm install` or build step is required at this time.

## Deployment

Push to the default branch triggers a Vercel deployment automatically.

- Production URL: https://loxleyai-portal.vercel.app

## Key Concepts

| Term | Meaning |
|------|---------|
| **Watkins Score** | Proprietary scoring methodology for ranking real estate corridors |
| **Corridor** | A geographic zone or market segment evaluated for investment potential |
| **BuyerID Dossier** | Intelligence report profiling a specific buyer (e.g., `BuyerID_RToddSmith_Lexington.docx`) |
| **Subscriber-gated** | Content is behind authentication; only paying subscribers can access dashboards |

## Conventions for AI Assistants

### Code Style
- Keep it simple — plain HTML/CSS/JS unless a framework is explicitly introduced.
- No build tools or transpilation unless the project evolves to require them.
- Prefer semantic HTML and accessible markup.

### Git
- **Default branch**: `master`
- Write clear, descriptive commit messages.
- Feature branches should follow the pattern `claude/<description>-<session-id>` when created by Claude Code.
- Do not force-push or amend published commits.

### File Organization
- Static assets (images, icons) go in an `assets/` directory.
- Styles go in a `css/` or `styles/` directory if separated from HTML.
- Scripts go in a `js/` or `scripts/` directory if separated from HTML.
- Report templates and generated dossiers go in a `templates/` or `reports/` directory.

### Security
- Never commit API keys, tokens, or secrets.
- Subscriber authentication details should use environment variables (Vercel env vars for production).
- Validate all user-facing inputs.

### Testing
- No test framework is configured yet. When added, document the test command here.

## Report Pipeline (Planned)

The project aims to support automated **BuyerID Dossier** generation for brokers:
- Template formats: `.docx` and `.pdf`
- Naming convention: `BuyerID_<FullName>_<Market>.{docx,pdf}`
- Pipeline should be automatable for broker self-service use

## Environment Variables

None required for local static serving. Vercel-specific env vars will be documented here as they are added.
