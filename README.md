# TCG Deck Companion

A Pokemon TCG deck tracker, collection manager, and deck builder built with React.

## Quick Start

Requires Node.js (https://nodejs.org, LTS version).

```bash
# Install dependencies (once)
npm install

# Run locally
npm run dev
# Then open http://localhost:5173
```

## Features
- Deck library with cover art, completion %, cost, legality warnings
- Formats: Standard (2026), Expanded, GLC, Era (BST-PAR style), Custom
- Legality checking per format with inline warnings
- Card bling selector — pick alternate prints with prices shown
- Deck builder — search + browse sets, click to add cards
- Collection tab (Cards / Decks / Wishlist)
- Buy List with TCGPlayer market prices and per-deck cost breakdown
- Auto-save to browser localStorage + JSON export/import

## API Key (optional)
Get a free key at https://dev.pokemontcg.io — click the 💾 button in the app to add it.
Without a key: 1,000 lookups/day. With key: 20,000/day.

## Migrating from the HTML version
Old app: click 💾 → Export JSON. New app: click 💾 → Import JSON.
