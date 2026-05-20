<div align="center">
  <img src=".github/assets/banner.png" alt="apollo" style="width: 100%; max-width: 700px;"/>

  <p align="center">
    Simple scraper - economics news watcher
    <br />
    <a href="https://github.com/GabrielTenma/apollo-bun/releases">Release</a>
    ·
    <a href="https://github.com/GabrielTenma/apollo-bun/issues">Report Bug</a>
    ·
    <a href="https://github.com/GabrielTenma/apollo-bun/issues">Request Feature</a>
  </p>
</div>

![Branches](https://www.shieldcn.dev/github/branches/GabrielTenma/apollo-bun.svg?variant=ghost&size=xs)
![Last commit](https://www.shieldcn.dev/github/last-commit/GabrielTenma/apollo-bun.svg?variant=secondary&size=xs)
![Release](https://www.shieldcn.dev/github/release/GabrielTenma/apollo-bun.svg?size=xs)
![CI](https://www.shieldcn.dev/github/ci/GabrielTenma/apollo-bun.svg?variant=secondary&size=xs)
![License](https://www.shieldcn.dev/github/license/GabrielTenma/apollo-bun.svg?variant=ghost&size=xs)
![Agent-friendly AGENTS.md](https://www.shieldcn.dev/badge/Agent--friendly-AGENTS.md-D97757.svg?variant=secondary&size=xs)


## Overview

Just a simple project focusing on scrape data related with economics for who need answer to take decision into market, processed with multiple sources data and openrouter LLM for describe the market tension, I called this `apollo`.

## How it works

Basically this app just collect data from trusted platform who updates related economic topic, wrap it up become one data and analyze with openrouter LLM autoselect `free` model, then send the result to social chat platform `telegram` for now.

Errors and structured events are logged via [evlog](https://evlog.dev) — one wide event per failure with full context, no scattered lines.

For the future plan focusing integrate to stackyrd pkg which `diameter-tscd` project, frontend and manageable web-content.

To see a `sequence diagram` complete, click <a href="https://sequencediagram.org/index.html#initialData=C4S2BsFMAIEMAcD25yIFBoMbhJAdsALQB8CyqAXAE6QCOArpAM7AXQD0CI7AbgIztM5SJmCIqaMikQl4VRDxAATSFWgBBCkJQjg0JbGCxoIAqryGQiC+GgAjGrADWpgObQ8kAO5NoAMmhQTCdVSSRpWXlFFTUAIS1hUX1DY3BDZj1PH2gAM3oUaBZxAE8w8hliRHh8eXpgVTYaBgy2YCpYPCY0+uhtKFFIJWSjNCqaxDrVEilKaBomJE7IVvbO7sHh2DQ8RB6FVThw2cxYTAALN0CzmHn84AxsXAIAHkIZxGpmRaZluchYAx2KD6RCYegAW3w922uxg+zU70aE1AnmgqCqhWqmBAOVwQ1AkLKERITFBIFg4DYPzwQx2oFxJ1A1n8vWs9QIQA">here</a>.

## Getting Started

### Prerequisites

- Bun (latest)
- PostgreSQL database / Supabase
- [OpenRouter](https://openrouter.ai/) API key
- Telegram bot token (from [@BotFather](https://t.me/BotFather))

### Installation

```bash
# Clone the repository
git clone https://github.com/GabrielTenma/apollo-bun.git
cd apollo-bun

# Install dependencies
bun install

# Configure environment variables
cp .env.example .env
# Edit .env and fill in your credentials
```

### Running

```bash
# Development — Vite frontend + Elysia backend in separate terminals
bun run dev              # Terminal 1: Elysia backend on :3000
bun run web:dev          # Terminal 2: Vite frontend on :3001

# Build frontend + start production server (serves frontend from :3000)
bun run web:build        # Build React app → dist/web/
bun run start            # Start Elysia server (serves API + frontend)
```

The Elysia server serves the React frontend from `http://localhost:3000/` using Elysia's native `file()` helper. API routes are prefixed under `/api/v1/`, `/telegram/`, etc. CORS allows `localhost:5173`, `localhost:3001`, and `localhost:3000`.


## Preview
![Web](.github/assets/preview.png)

## License
Use Apache 2. See `LICENSE` for deal your free time.