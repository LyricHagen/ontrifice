function Code({ children }: { children: string }) {
  return (
    <pre className="font-mono text-sm border border-border bg-surface p-4 overflow-x-auto whitespace-pre my-4">
      {children}
    </pre>
  );
}

function ParamTable({
  params,
}: {
  params: { name: string; type: string; default?: string; description: string }[];
}) {
  return (
    <div className="overflow-x-auto my-4">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="border-b border-border">
            <th className="text-left py-2 pr-4 font-mono font-medium">Parameter</th>
            <th className="text-left py-2 pr-4 font-mono font-medium">Type</th>
            <th className="text-left py-2 pr-4 font-mono font-medium">Default</th>
            <th className="text-left py-2 font-mono font-medium">Description</th>
          </tr>
        </thead>
        <tbody>
          {params.map((p) => (
            <tr key={p.name} className="border-b border-border">
              <td className="py-2 pr-4 font-mono text-accent">{p.name}</td>
              <td className="py-2 pr-4 font-mono text-text-secondary">{p.type}</td>
              <td className="py-2 pr-4 font-mono text-text-secondary">{p.default ?? "-"}</td>
              <td className="py-2 text-text-secondary">{p.description}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ErrorTable({
  errors,
}: {
  errors: { code: string; status: number; description: string }[];
}) {
  return (
    <div className="overflow-x-auto my-4">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="border-b border-border">
            <th className="text-left py-2 pr-4 font-mono font-medium">Code</th>
            <th className="text-left py-2 pr-4 font-mono font-medium">HTTP Status</th>
            <th className="text-left py-2 font-mono font-medium">Description</th>
          </tr>
        </thead>
        <tbody>
          {errors.map((e) => (
            <tr key={e.code} className="border-b border-border">
              <td className="py-2 pr-4 font-mono text-accent">{e.code}</td>
              <td className="py-2 pr-4 font-mono text-text-secondary">{e.status}</td>
              <td className="py-2 text-text-secondary">{e.description}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function MethodBadge({ method }: { method: "GET" | "POST" }) {
  return (
    <span className="font-mono text-xs font-bold px-1.5 py-0.5 border border-border bg-surface mr-2">
      {method}
    </span>
  );
}

function Endpoint({
  id,
  method,
  path,
  description,
  auth,
  children,
}: {
  id: string;
  method: "GET" | "POST";
  path: string;
  description: string;
  auth?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-12 pt-8 border-t border-border" id={id}>
      <h2 className="text-xl font-bold font-mono mb-2">
        <MethodBadge method={method} />
        {path}
      </h2>
      <p className="text-text-secondary mb-2">{description}</p>
      {auth !== undefined && (
        <p className="text-sm text-text-secondary mb-4">
          Authentication: <span className="font-mono">{auth ? "Required" : "Public"}</span>
        </p>
      )}
      {children}
    </section>
  );
}

export function DocsContent() {
  return (
    <div className="flex-1 min-w-0 px-6 py-8 lg:px-12">
      <div className="max-w-[720px]">
        <section id="overview">
          <h1 className="text-3xl font-bold font-mono mb-6">API Documentation</h1>
          <p className="text-text-secondary mb-4">
            Use the Ontrifice API to compute collateral-efficient portfolios
            across prediction markets. Input your positions, get back your true
            max loss and the proven relationships that reduce it.
          </p>

          <h3 className="text-lg font-bold font-mono mt-8 mb-2">Base URL</h3>
          <Code>{`https://api.ontrifice.dev/v1`}</Code>
        </section>

        <section id="authentication" className="mt-12">
          <h2 className="text-xl font-bold font-mono mb-4">Authentication</h2>
          <p className="text-text-secondary mb-4">
            Most read endpoints are public. The portfolio analysis endpoint works
            without auth for demo purposes (rate-limited). Write endpoints require
            an API key passed in the Authorization header:
          </p>
          <Code>{`Authorization: Bearer YOUR_API_KEY`}</Code>
          <p className="text-text-secondary mt-4">
            You can generate an API key from your{" "}
            <a href="/settings">account settings</a>.
          </p>
        </section>

        <section id="rate-limiting" className="mt-12">
          <h2 className="text-xl font-bold font-mono mb-4">Rate Limiting</h2>
          <p className="text-text-secondary mb-4">
            Public endpoints: 60 requests/minute. Authenticated: 300
            requests/minute. Exceeded limits return{" "}
            <span className="font-mono">429</span> with{" "}
            <span className="font-mono">ERR_RATE_LIMIT</span>.
          </p>
        </section>

        <section id="errors" className="mt-12 pt-8 border-t border-border">
          <h2 className="text-xl font-bold font-mono mb-4">Errors</h2>
          <p className="text-text-secondary mb-4">
            All errors return a JSON body with this shape:
          </p>
          <Code>{`{
  "error": {
    "code": "ERR_...",
    "message": "Human-readable explanation.",
    "details": {}
  }
}`}</Code>

          <h3 className="text-lg font-bold font-mono mt-8 mb-2">Error Codes</h3>
          <ErrorTable
            errors={[
              { code: "ERR_VALIDATION", status: 400, description: "A query parameter or request body field has an invalid value." },
              { code: "ERR_AUTH_MISSING_API_KEY", status: 401, description: "No API key was provided on a protected endpoint." },
              { code: "ERR_NOT_FOUND", status: 404, description: "The requested resource does not exist." },
              { code: "ERR_MARKET_NOT_FOUND", status: 404, description: "The requested market ID does not exist." },
              { code: "ERR_RATE_LIMIT", status: 429, description: "Too many requests. Wait and retry." },
              { code: "ERR_DATABASE", status: 500, description: "A database operation failed unexpectedly." },
              { code: "ERR_INTERNAL", status: 500, description: "An unexpected server error occurred." },
            ]}
          />
        </section>

        {/* POST /api/portfolio/analyze */}
        <Endpoint
          id="post-api-portfolio-analyze"
          method="POST"
          path="/api/portfolio/analyze"
          description="Compute collateral requirements for a portfolio of prediction market positions. Returns naive collateral (sum of individual max losses), optimized collateral (true max loss given proven constraints), binding constraints, and the worst-case resolution scenario."
          auth={false}
        >
          <h3 className="text-lg font-bold font-mono mt-6 mb-2">Request Body</h3>
          <Code>{`{
  "positions": [
    {
      "market_id": "uuid",
      "side": "YES" | "NO",
      "size": number,
      "avg_price": number (0-1 exclusive)
    }
  ]
}`}</Code>
          <ParamTable
            params={[
              { name: "positions", type: "array", description: "Array of position objects (max 50)" },
              { name: "positions[].market_id", type: "uuid", description: "Market ID from the Ontrifice database" },
              { name: "positions[].side", type: "string", description: "Position direction: YES or NO" },
              { name: "positions[].size", type: "number", description: "Number of shares (must be positive)" },
              { name: "positions[].avg_price", type: "number", description: "Average entry price (between 0 and 1, exclusive)" },
            ]}
          />

          <h3 className="text-lg font-bold font-mono mt-6 mb-2">Example Request</h3>
          <Code>{`curl -X POST https://api.ontrifice.dev/v1/api/portfolio/analyze \\
  -H "Content-Type: application/json" \\
  -d '{
    "positions": [
      { "market_id": "a1b2...", "side": "YES", "size": 100, "avg_price": 0.65 },
      { "market_id": "b2c3...", "side": "NO", "size": 200, "avg_price": 0.40 }
    ]
  }'`}</Code>

          <h3 className="text-lg font-bold font-mono mt-6 mb-2">Example Response</h3>
          <Code>{`{
  "naive_collateral": 185.00,
  "optimized_collateral": 120.00,
  "savings": 65.00,
  "savings_pct": 35.14,
  "constraint_count": 3,
  "binding_constraints": [
    {
      "market_id_a": "a1b2...",
      "market_id_b": "b2c3...",
      "market_title_a": "Will the Fed cut rates in Q3 2026?",
      "market_title_b": "US GDP growth above 3% in 2026?",
      "relationship_type": "mutual_exclusion",
      "collateral_saved": 65.00,
      "edge_id": "e1e2...",
      "confidence": 0.95
    }
  ],
  "worst_case": {
    "resolutions": { "a1b2...": true, "b2c3...": false },
    "position_pnls": [
      {
        "market_id": "a1b2...",
        "market_title": "Will the Fed cut rates in Q3 2026?",
        "side": "YES",
        "size": 100,
        "avg_price": 0.65,
        "resolution": "YES",
        "pnl": 35.00
      },
      {
        "market_id": "b2c3...",
        "market_title": "US GDP growth above 3% in 2026?",
        "side": "NO",
        "size": 200,
        "avg_price": 0.40,
        "resolution": "NO",
        "pnl": 80.00
      }
    ],
    "total_loss": 120.00
  },
  "warnings": []
}`}</Code>
        </Endpoint>

        {/* POST /api/portfolio/suggest */}
        <Endpoint
          id="post-api-portfolio-suggest"
          method="POST"
          path="/api/portfolio/suggest"
          description="Given an existing portfolio, suggest markets with structural relationships that could reduce total collateral requirements if added."
          auth={false}
        >
          <h3 className="text-lg font-bold font-mono mt-6 mb-2">Request Body</h3>
          <p className="text-text-secondary mb-2">
            Same format as the analyze endpoint.
          </p>

          <h3 className="text-lg font-bold font-mono mt-6 mb-2">Example Response</h3>
          <Code>{`{
  "suggestions": [
    {
      "market_id": "c3d4...",
      "market_title": "Fed holds rates through 2026?",
      "relationship_count": 3,
      "potential_savings": "Depends on position size and direction"
    }
  ]
}`}</Code>
        </Endpoint>

        {/* GET /api/constraints */}
        <Endpoint
          id="get-api-constraints"
          method="GET"
          path="/api/constraints"
          description="List proven structural relationships between markets. These are the raw constraints that power collateral optimization."
          auth={false}
        >
          <h3 className="text-lg font-bold font-mono mt-6 mb-2">Query Parameters</h3>
          <ParamTable
            params={[
              { name: "type", type: "string", description: "Filter by relationship type: mutually_exclusive, implies, temporal_precondition" },
              { name: "class", type: "string", description: "Filter by relation class: logical, statistical, semantic" },
              { name: "platform", type: "string", description: "Filter by platform: polymarket, kalshi, limitless, cross-platform" },
              { name: "min_confidence", type: "number", description: "Minimum confidence threshold (0-1)" },
              { name: "page", type: "integer", default: "1", description: "Page number" },
              { name: "limit", type: "integer", default: "50", description: "Results per page (max 100)" },
            ]}
          />

          <h3 className="text-lg font-bold font-mono mt-6 mb-2">Example Request</h3>
          <Code>{`curl "https://api.ontrifice.dev/v1/api/constraints?type=mutually_exclusive&min_confidence=0.8"`}</Code>

          <h3 className="text-lg font-bold font-mono mt-6 mb-2">Example Response</h3>
          <Code>{`{
  "constraints": [
    {
      "id": "e1e2...",
      "market_a": { "id": "a1b2...", "title": "Trump wins 2028", "platform": "polymarket" },
      "market_b": { "id": "b2c3...", "title": "DeSantis wins 2028", "platform": "polymarket" },
      "relation_class": "logical",
      "relation_type": "mutually_exclusive",
      "confidence": "0.95000000",
      "score": "0.95000000",
      "direction": "bidirectional",
      "mathematical_semantics": "P(A AND B) = 0; mutually exclusive and collectively exhaustive",
      "evidence": { "constraintType": "mutual_exclusion", "collectivelyExhaustive": true },
      "detected_at": "2026-09-08T12:00:00.000Z",
      "model_version": "structural-v1"
    }
  ],
  "total": 234,
  "page": 1,
  "limit": 50
}`}</Code>
        </Endpoint>

        {/* GET /api/constraints/:id */}
        <Endpoint
          id="get-api-constraints-id"
          method="GET"
          path="/api/constraints/:id"
          description="Get full details for a single constraint, including both markets and the complete evidence/proof."
          auth={false}
        >
          <h3 className="text-lg font-bold font-mono mt-6 mb-2">Example Request</h3>
          <Code>{`curl https://api.ontrifice.dev/v1/api/constraints/e1e2e3e4-...`}</Code>
        </Endpoint>

        {/* GET /api/markets */}
        <Endpoint
          id="get-api-markets"
          method="GET"
          path="/api/markets"
          description="List markets with filtering and pagination."
          auth={false}
        >
          <h3 className="text-lg font-bold font-mono mt-6 mb-2">Query Parameters</h3>
          <ParamTable
            params={[
              { name: "platform", type: "string", description: "Filter by platform: polymarket, kalshi, limitless" },
              { name: "category", type: "string", description: "Filter by category" },
              { name: "status", type: "string", description: "Filter by status: active, resolved, voided" },
              { name: "search", type: "string", description: "Case-insensitive title search" },
              { name: "sort", type: "string", default: "updated_at", description: "Sort field: volume, probability, updated_at" },
              { name: "order", type: "string", default: "desc", description: "Sort order: asc, desc" },
              { name: "page", type: "integer", default: "1", description: "Page number" },
              { name: "limit", type: "integer", default: "20", description: "Results per page (max 100)" },
            ]}
          />
        </Endpoint>

        {/* GET /api/markets/:id */}
        <Endpoint
          id="get-api-markets-id"
          method="GET"
          path="/api/markets/:id"
          description="Get a single market by ID, including its graph edges and connected markets."
          auth={false}
        >
          <h3 className="text-lg font-bold font-mono mt-6 mb-2">Error</h3>
          <p className="text-text-secondary">
            Returns <span className="font-mono">404</span> with{" "}
            <span className="font-mono">ERR_MARKET_NOT_FOUND</span> if the ID
            does not match any market.
          </p>
        </Endpoint>

        {/* GET /api/markets/:id/relationships */}
        <Endpoint
          id="get-api-markets-id-relationships"
          method="GET"
          path="/api/markets/:id/relationships"
          description="Get all proven relationships involving a specific market. Returns the market details and all constraint edges where it appears as either source or target."
          auth={false}
        >
          <h3 className="text-lg font-bold font-mono mt-6 mb-2">Example Response</h3>
          <Code>{`{
  "market": { "id": "a1b2...", "title": "Will the Fed cut rates in Q3 2026?" },
  "relationships": [
    {
      "id": "e1e2...",
      "market_a": { "id": "a1b2...", "title": "Will the Fed cut rates in Q3 2026?", "platform": "polymarket" },
      "market_b": { "id": "b2c3...", "title": "US GDP growth above 3% in 2026?", "platform": "kalshi" },
      "relation_class": "logical",
      "relation_type": "implies",
      "confidence": "0.70000000",
      "mathematical_semantics": "if source resolves YES, target must resolve YES",
      "evidence": { "constraintType": "implication", "reason": "..." }
    }
  ]
}`}</Code>
        </Endpoint>

        {/* GET /api/graph/edges */}
        <Endpoint
          id="get-api-graph-edges"
          method="GET"
          path="/api/graph/edges"
          description="Query the dependency graph directly. When market_id is provided, returns the local subgraph around that market. Otherwise returns edges matching the filters."
          auth={false}
        >
          <h3 className="text-lg font-bold font-mono mt-6 mb-2">Query Parameters</h3>
          <ParamTable
            params={[
              { name: "market_id", type: "uuid", description: "Return the subgraph around this market" },
              { name: "depth", type: "integer", default: "1", description: "Traversal depth when market_id is set (1-5)" },
              { name: "relation_class", type: "string", description: "Filter by class: logical, statistical, semantic" },
              { name: "relation_type", type: "string", description: "Filter by type within class" },
              { name: "min_score", type: "number", description: "Minimum edge score (-1 to 1)" },
              { name: "limit", type: "integer", default: "100", description: "Max edges to return (max 500)" },
            ]}
          />
        </Endpoint>

        {/* POST /api/ingestion/trigger */}
        <Endpoint
          id="post-api-ingestion-trigger"
          method="POST"
          path="/api/ingestion/trigger"
          description="Trigger a market data ingestion run. Fetches the latest data from all connected prediction market platforms."
          auth={true}
        >
          <h3 className="text-lg font-bold font-mono mt-6 mb-2">Example Request</h3>
          <Code>{`curl -X POST https://api.ontrifice.dev/v1/api/ingestion/trigger \\
  -H "Authorization: Bearer YOUR_API_KEY"`}</Code>
        </Endpoint>

        {/* POST /api/graph/compute */}
        <Endpoint
          id="post-api-graph-compute"
          method="POST"
          path="/api/graph/compute"
          description="Trigger a full graph computation cycle. Recomputes all edges and detects structural relationships between markets."
          auth={true}
        >
          <h3 className="text-lg font-bold font-mono mt-6 mb-2">Example Request</h3>
          <Code>{`curl -X POST https://api.ontrifice.dev/v1/api/graph/compute \\
  -H "Authorization: Bearer YOUR_API_KEY"`}</Code>
        </Endpoint>

        {/* Client Libraries */}
        <section id="client-libraries" className="mt-12 pt-8 border-t border-border mb-16">
          <h2 className="text-xl font-bold font-mono mb-4">Client Libraries</h2>
          <p className="text-text-secondary">
            Official client libraries are not yet available. The API follows
            standard REST conventions and works with any HTTP client.
          </p>
        </section>
      </div>
    </div>
  );
}
