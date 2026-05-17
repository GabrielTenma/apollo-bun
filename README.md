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

## Overview

Just a simple project focusing on scrape data related with economics for who need answer to take decision into market, processed with multiple sources data and openrouter LLM for describe the market tension, I called this `apollo`.

## How it works

Basically this app just collect data from trusted platform who updates related economic topic, wrap it up become one data and analyze with openrouter LLM autoselect `free` model, then send the result to social chat platform `telegram` for now.

For the future plan focusing integrate to stackyrd pkg which `diameter-tscd` project, frontend and manageable web-content.

To see a `sequence diagram` complete, click <a href="https://sequencediagram.org/index.html#initialData=C4S2BsFMAIEMAcD25yIFBoMbhJAdsALQB8CyqAXAE6QCOArpAM7AXQD0CI7AbgIztM5SJmCIqaMikQl4VRDxAATSFWgBBCkJQjg0JbGCxoIAqryGQiC+GgAjGrADWpgObQ8kAO5NoAMmhQTCdVSSRpWXlFFTUAIS1hUX1DY3BDZj1PH2gAM3oUaBZxAE8w8hliRHh8eXpgVTYaBgy2YCpYPCY0+uhtKFFIJWSjNCqaxDrVEilKaBomJE7IVvbO7sHh2DQ8RB6FVThw2cxYTAALN0CzmHn84AxsXAIAHkIZxGpmRaZluchYAx2KD6RCYegAW3w922uxg+zU70aE1AnmgqCqhWqmBAOVwQ1AkLKERITFBIFg4DYPzwQx2oFxJ1A1n8vWs9QIQA">here</a>.

## Getting Started

### Prerequisites

- Node.js >= 18
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
# Development (NestJS + Vite with hot reload)
bun run dev

# Production build
bun run build:all

# Start production server
bun run start:all
```

The app serves on `http://localhost:3000`. The Vite dev server runs on `http://localhost:3001`.

## Preview
![Web](.github/assets/preview.png)

## License
Use Apache 2. See `LICENSE` for deal your free time.