# Ontrifice

Cross-market neg risk engine for prediction markets.

Proves structural relationships between contracts across Polymarket and Kalshi — mutual exclusion, implication, exhaustive sets — and uses them to compute tighter max-loss bounds on multi-leg portfolios. The dependency graph is the inference layer; the collateral solver is the output layer.

Tighter collateral → tighter quotes → better prices → more volume.

## How it works

1. Ingests markets from Polymarket and Kalshi, normalizes contracts into a shared schema
2. Detects structural relationships between markets (neg risk groups, event groupings, implication patterns)
3. Given a portfolio of positions, enumerates all feasible resolution vectors constrained by proven relationships
4. Returns true max loss, binding constraints (which relationships actually saved collateral), and the worst-case resolution scenario

For realistic portfolio sizes (up to ~25 markets), brute-force enumeration with constraint pruning is fast enough. Larger portfolios fall back to greedy approximation.

## Stack

- Next.js 15 (App Router, TypeScript strict)
- Tailwind CSS 4
- PostgreSQL with Drizzle ORM
- JetBrains Mono + IBM Plex Sans

## Setup

```bash
git clone https://github.com/LyricHagen/ontrifice.git
cd ontrifice
npm install
```

Create a `.env` file:

```
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/ontrifice
AUTH_SECRET=<generate with: openssl rand -base64 33>
```

Push the schema and start:

```bash
npx drizzle-kit push
npm run dev
```

## Routes

```
/             landing
/analyzer     portfolio collateral analyzer
/constraints  proven market relationships browser
/graph        relationship network visualization
/docs         API documentation
```

## API

Core endpoints:

```
POST /api/portfolio/analyze     compute collateral for a set of positions
POST /api/portfolio/suggest     suggest markets that could reduce collateral
GET  /api/constraints           list proven relationships
GET  /api/constraints/:id       relationship detail with proof
GET  /api/markets               list markets
GET  /api/markets/:id           market detail with edges
GET  /api/markets/:id/relationships  all relationships for a market
```

Full documentation at [/docs](https://ontrifice.dev/docs).

## License

MIT
