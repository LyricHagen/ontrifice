# Ontrifice

Live coherence engine for prediction markets.

Treats the entire prediction market universe as a connected dependency graph and surfaces cross-event logical inconsistencies, implied conditional probabilities, and cascade alerts across Polymarket, Kalshi, and Limitless.

## Stack

- Next.js 15 (App Router, TypeScript strict)
- Tailwind CSS 4
- PostgreSQL with Drizzle ORM
- JetBrains Mono + IBM Plex Sans (via next/font)

## Setup

```bash
git clone https://github.com/your-org/ontrifice.git
cd ontrifice
npm install
```

Create a `.env` file:

```
DATABASE_URL=postgresql://user:password@localhost:5432/ontrifice
NEXTAUTH_SECRET=your-secret-here
NEXTAUTH_URL=http://localhost:3000
```

Run migrations and seed:

```bash
npx drizzle-kit push
npx tsx src/db/seed/index.ts
```

Start the dev server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## API

Full API documentation is available at [/docs](http://localhost:3000/docs).

## License

MIT
