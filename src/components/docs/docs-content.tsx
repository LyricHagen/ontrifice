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
            Ontrifice exposes a REST API for querying the prediction market
            dependency graph, computed incoherences, model-implied probabilities,
            and cascade alerts.
          </p>

          <h3 className="text-lg font-bold font-mono mt-8 mb-2">Base URL</h3>
          <Code>{`https://api.ontrifice.dev/v1`}</Code>
        </section>

        <section id="authentication" className="mt-12">
          <h2 className="text-xl font-bold font-mono mb-4">Authentication</h2>
          <p className="text-text-secondary mb-4">
            Most read endpoints are public. Write endpoints and rate-limited
            features require an API key passed in the Authorization header:
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
              {
                code: "ERR_VALIDATION",
                status: 400,
                description: "A query parameter or request body field has an invalid value.",
              },
              {
                code: "ERR_AUTH_MISSING_API_KEY",
                status: 401,
                description: "No API key was provided on a protected endpoint.",
              },
              {
                code: "ERR_AUTH_INVALID_CREDENTIALS",
                status: 401,
                description: "The provided API key is not valid.",
              },
              {
                code: "ERR_AUTH_SESSION_EXPIRED",
                status: 401,
                description: "The session has expired due to inactivity.",
              },
              {
                code: "ERR_AUTH_ACCOUNT_NOT_FOUND",
                status: 404,
                description: "No account matches the provided credentials.",
              },
              {
                code: "ERR_MARKET_NOT_FOUND",
                status: 404,
                description: "The requested market ID does not exist.",
              },
              {
                code: "ERR_RATE_LIMIT",
                status: 429,
                description: "Too many requests. Wait and retry.",
              },
              {
                code: "ERR_MARKET_FETCH_TIMEOUT",
                status: 502,
                description: "An upstream prediction market platform did not respond in time.",
              },
              {
                code: "ERR_EXTERNAL_API",
                status: 502,
                description: "An external service returned an error.",
              },
              {
                code: "ERR_DATABASE",
                status: 500,
                description: "A database operation failed unexpectedly.",
              },
              {
                code: "ERR_GRAPH_COMPUTATION",
                status: 500,
                description: "The dependency graph computation failed.",
              },
              {
                code: "ERR_INTERNAL",
                status: 500,
                description: "An unexpected server error occurred.",
              },
            ]}
          />
        </section>

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

          <h3 className="text-lg font-bold font-mono mt-6 mb-2">Example Request</h3>
          <Code>{`curl https://api.ontrifice.dev/v1/api/markets?platform=polymarket&limit=2`}</Code>

          <h3 className="text-lg font-bold font-mono mt-6 mb-2">Example Response</h3>
          <Code>{`{
  "markets": [
    {
      "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
      "platform": "polymarket",
      "platformMarketId": "0x1234abcd",
      "title": "Will the Fed cut rates in Q3 2026?",
      "description": "Resolves YES if the Federal Reserve...",
      "category": "economics",
      "currentProbability": "0.72000000",
      "volumeUsd": "1450320.50",
      "status": "active",
      "resolution": null,
      "createdAt": "2026-08-15T10:30:00.000Z",
      "updatedAt": "2026-09-08T14:22:00.000Z",
      "lastFetchedAt": "2026-09-09T01:00:00.000Z",
      "metadata": {}
    },
    {
      "id": "b2c3d4e5-f6a7-8901-bcde-f12345678901",
      "platform": "polymarket",
      "platformMarketId": "0x5678efgh",
      "title": "US GDP growth above 3% in 2026?",
      "description": "Resolves YES if annualized GDP...",
      "category": "economics",
      "currentProbability": "0.41000000",
      "volumeUsd": "892100.00",
      "status": "active",
      "resolution": null,
      "createdAt": "2026-07-01T08:00:00.000Z",
      "updatedAt": "2026-09-08T18:45:00.000Z",
      "lastFetchedAt": "2026-09-09T01:00:00.000Z",
      "metadata": {}
    }
  ],
  "total": 847,
  "page": 1,
  "limit": 2
}`}</Code>
        </Endpoint>

        {/* GET /api/markets/:id */}
        <Endpoint
          id="get-api-markets-id"
          method="GET"
          path="/api/markets/:id"
          description="Get a single market by ID, including its graph edges and connected markets."
          auth={false}
        >
          <h3 className="text-lg font-bold font-mono mt-6 mb-2">Example Request</h3>
          <Code>{`curl https://api.ontrifice.dev/v1/api/markets/a1b2c3d4-e5f6-7890-abcd-ef1234567890`}</Code>

          <h3 className="text-lg font-bold font-mono mt-6 mb-2">Example Response</h3>
          <Code>{`{
  "market": {
    "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "platform": "polymarket",
    "platformMarketId": "0x1234abcd",
    "title": "Will the Fed cut rates in Q3 2026?",
    "description": "Resolves YES if the Federal Reserve...",
    "category": "economics",
    "currentProbability": "0.72000000",
    "volumeUsd": "1450320.50",
    "status": "active",
    "resolution": null,
    "createdAt": "2026-08-15T10:30:00.000Z",
    "updatedAt": "2026-09-08T14:22:00.000Z",
    "lastFetchedAt": "2026-09-09T01:00:00.000Z",
    "metadata": {}
  },
  "edges": [
    {
      "id": "e1e2e3e4-e5e6-7890-abcd-ef1234567890",
      "sourceMarketId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
      "targetMarketId": "b2c3d4e5-f6a7-8901-bcde-f12345678901",
      "relationClass": "semantic",
      "relationType": "same_topic",
      "score": "0.85000000",
      "confidence": "0.92000000",
      "direction": "bidirectional",
      "mathematicalSemantics": "tfidf_cosine=0.8500; shared category 'economics'",
      "modelVersion": "tfidf-v1",
      "evidence": {},
      "createdAt": "2026-08-20T12:00:00.000Z",
      "updatedAt": "2026-09-08T14:22:00.000Z"
    }
  ],
  "connectedMarkets": [
    {
      "id": "b2c3d4e5-f6a7-8901-bcde-f12345678901",
      "title": "US GDP growth above 3% in 2026?",
      "platform": "polymarket",
      "currentProbability": "0.41000000"
    }
  ]
}`}</Code>

          <h3 className="text-lg font-bold font-mono mt-6 mb-2">Error</h3>
          <p className="text-text-secondary">
            Returns <span className="font-mono">404</span> with{" "}
            <span className="font-mono">ERR_MARKET_NOT_FOUND</span> if the ID
            does not match any market.
          </p>
        </Endpoint>

        {/* GET /api/graph/edges */}
        <Endpoint
          id="get-api-graph-edges"
          method="GET"
          path="/api/graph/edges"
          description="Query the dependency graph. When market_id is provided, returns the local subgraph around that market. Otherwise returns edges matching the filters."
          auth={false}
        >
          <h3 className="text-lg font-bold font-mono mt-6 mb-2">Query Parameters</h3>
          <ParamTable
            params={[
              { name: "market_id", type: "uuid", description: "Return the subgraph around this market" },
              { name: "depth", type: "integer", default: "1", description: "Traversal depth when market_id is set (1-5)" },
              { name: "relation_class", type: "string", description: "Filter by class: logical, statistical, semantic" },
              { name: "relation_type", type: "string", description: "Filter by type within class (e.g., correlation, implies, same_entity)" },
              { name: "min_score", type: "number", description: "Minimum edge score (-1 to 1)" },
              { name: "limit", type: "integer", default: "100", description: "Max edges to return (max 500)" },
            ]}
          />

          <h3 className="text-lg font-bold font-mono mt-6 mb-2">Example Request</h3>
          <Code>{`curl https://api.ontrifice.dev/v1/api/graph/edges?relation_class=semantic&min_score=0.7&limit=2`}</Code>

          <h3 className="text-lg font-bold font-mono mt-6 mb-2">Example Response</h3>
          <Code>{`{
  "edges": [
    {
      "id": "e1e2e3e4-e5e6-7890-abcd-ef1234567890",
      "sourceMarketId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
      "targetMarketId": "b2c3d4e5-f6a7-8901-bcde-f12345678901",
      "relationClass": "semantic",
      "relationType": "same_topic",
      "score": "0.85000000",
      "confidence": "0.92000000",
      "direction": "bidirectional",
      "mathematicalSemantics": "tfidf_cosine=0.8500; shared category 'economics'",
      "modelVersion": "tfidf-v1",
      "sampleSize": null,
      "evidence": {},
      "createdAt": "2026-08-20T12:00:00.000Z",
      "updatedAt": "2026-09-08T14:22:00.000Z"
    }
  ],
  "count": 1
}`}</Code>
        </Endpoint>

        {/* GET /api/graph/incoherences */}
        <Endpoint
          id="get-api-graph-incoherences"
          method="GET"
          path="/api/graph/incoherences"
          description="List detected incoherences across the market graph. Each incoherence identifies a logical inconsistency between two or more markets."
          auth={false}
        >
          <h3 className="text-lg font-bold font-mono mt-6 mb-2">Query Parameters</h3>
          <ParamTable
            params={[
              { name: "status", type: "string", description: "Filter by status: active, resolved, expired" },
              { name: "violation_type", type: "string", description: "Filter by type: probability_sum, conditional_contradiction, mutual_exclusion, implication_violation" },
              { name: "sort", type: "string", default: "severity", description: "Sort field: severity, detected_at, market_count" },
              { name: "order", type: "string", default: "desc", description: "Sort order: asc, desc" },
              { name: "page", type: "integer", default: "1", description: "Page number" },
              { name: "limit", type: "integer", default: "20", description: "Results per page (max 100)" },
            ]}
          />

          <h3 className="text-lg font-bold font-mono mt-6 mb-2">Example Request</h3>
          <Code>{`curl https://api.ontrifice.dev/v1/api/graph/incoherences?status=active&limit=1`}</Code>

          <h3 className="text-lg font-bold font-mono mt-6 mb-2">Example Response</h3>
          <Code>{`{
  "incoherences": [
    {
      "id": "f1f2f3f4-f5f6-7890-abcd-ef1234567890",
      "involvedMarketIds": [
        "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
        "b2c3d4e5-f6a7-8901-bcde-f12345678901"
      ],
      "violationType": "probability_sum",
      "severity": "0.84000000",
      "description": "Mutually exclusive markets sum to 1.13",
      "impliedArbitrage": {
        "expectedProfit": 0.13,
        "strategy": "short_both"
      },
      "detectedAt": "2026-09-08T18:30:00.000Z",
      "resolvedAt": null,
      "status": "active",
      "involvedMarkets": [
        {
          "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
          "title": "Will the Fed cut rates in Q3 2026?",
          "platform": "polymarket",
          "currentProbability": "0.72000000"
        },
        {
          "id": "b2c3d4e5-f6a7-8901-bcde-f12345678901",
          "title": "US GDP growth above 3% in 2026?",
          "platform": "polymarket",
          "currentProbability": "0.41000000"
        }
      ]
    }
  ],
  "total": 23,
  "page": 1,
  "limit": 1
}`}</Code>
        </Endpoint>

        {/* GET /api/graph/conditionals */}
        <Endpoint
          id="get-api-graph-conditionals"
          method="GET"
          path="/api/graph/conditionals"
          description="Compute a model-implied conditional probability between two markets, or list recent computations."
          auth={false}
        >
          <h3 className="text-lg font-bold font-mono mt-6 mb-2">Methodology</h3>
          <p className="text-text-secondary mb-2">
            For binary random variables A and B with known marginal probabilities
            P(A) and P(B), the joint probability is computed using the Bernoulli
            correlation formula:
          </p>
          <Code>{`P(A,B) = P(A)*P(B) + r * sqrt(P(A)*(1-P(A)) * P(B)*(1-P(B)))`}</Code>
          <p className="text-text-secondary mb-2">
            This is exact for binary variables given the true Pearson correlation r.
            The conditional follows as P(B|A) = P(A,B) / P(A). The computed joint
            is clamped to the Frechet bounds [max(0, P(A)+P(B)-1), min(P(A), P(B))];
            clamping indicates the correlation estimate is unreliable for that pair.
          </p>

          <h3 className="text-lg font-bold font-mono mt-6 mb-2">Confidence levels</h3>
          <div className="overflow-x-auto my-4">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-2 pr-4 font-mono font-medium">Level</th>
                  <th className="text-left py-2 pr-4 font-mono font-medium">Basis</th>
                  <th className="text-left py-2 font-mono font-medium">Criteria</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-border">
                  <td className="py-2 pr-4 font-mono">HIGH</td>
                  <td className="py-2 pr-4 text-text-secondary">direct_observation</td>
                  <td className="py-2 text-text-secondary">Direct statistical edge with 30+ observations</td>
                </tr>
                <tr className="border-b border-border">
                  <td className="py-2 pr-4 font-mono">MEDIUM</td>
                  <td className="py-2 pr-4 text-text-secondary">direct_observation</td>
                  <td className="py-2 text-text-secondary">{"Direct statistical edge with <30 observations"}</td>
                </tr>
                <tr className="border-b border-border">
                  <td className="py-2 pr-4 font-mono">LOW</td>
                  <td className="py-2 pr-4 text-text-secondary">path_inference</td>
                  <td className="py-2 text-text-secondary">No direct edge; correlation estimated by multiplying along path (assumes conditional independence)</td>
                </tr>
              </tbody>
            </table>
          </div>

          <h3 className="text-lg font-bold font-mono mt-6 mb-2">Limitations</h3>
          <p className="text-text-secondary mb-4">
            The formula is exact only if the correlation r is the true population
            Pearson correlation. In practice we use an estimate derived from market
            price co-movement, which introduces sampling error. Path-inferred
            estimates multiply correlations along intermediate edges, which assumes
            conditional independence along the path. This may not hold and can
            produce misleading estimates. All results are model outputs, not market
            prices.
          </p>

          <h3 className="text-lg font-bold font-mono mt-6 mb-2">Query Parameters</h3>
          <ParamTable
            params={[
              { name: "condition", type: "uuid", description: "The condition market ID. Required with target." },
              { name: "target", type: "uuid", description: "The target market ID. Required with condition." },
              { name: "page", type: "integer", default: "1", description: "Page number (when listing)" },
              { name: "limit", type: "integer", default: "20", description: "Results per page (when listing, max 100)" },
            ]}
          />
          <p className="text-text-secondary mt-2 mb-4">
            Provide both <span className="font-mono">condition</span> and{" "}
            <span className="font-mono">target</span> to compute a probability,
            or omit both to list recent computations.
          </p>

          <h3 className="text-lg font-bold font-mono mt-6 mb-2">Example Request</h3>
          <Code>{`curl "https://api.ontrifice.dev/v1/api/graph/conditionals?condition=a1b2c3d4-e5f6-7890-abcd-ef1234567890&target=b2c3d4e5-f6a7-8901-bcde-f12345678901"`}</Code>

          <h3 className="text-lg font-bold font-mono mt-6 mb-2">Example Response</h3>
          <Code>{`{
  "conditional": {
    "probability": 0.58,
    "confidenceLevel": "HIGH",
    "confidenceBasis": "direct_observation",
    "assumptions": "Joint probability computed via Bernoulli correlation formula: P(A,B) = P(A)*P(B) + r*sqrt(P(A)*(1-P(A))*P(B)*(1-P(B))). This is exact for binary random variables given the true Pearson correlation. The correlation r=0.4200 is an estimate from 45 observations.",
    "derivationPath": [
      {
        "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
        "title": "Will the Fed cut rates in Q3 2026?"
      },
      {
        "id": "b2c3d4e5-f6a7-8901-bcde-f12345678901",
        "title": "US GDP growth above 3% in 2026?"
      }
    ],
    "conditionMarket": {
      "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
      "title": "Will the Fed cut rates in Q3 2026?",
      "probability": 0.72
    },
    "targetMarket": {
      "id": "b2c3d4e5-f6a7-8901-bcde-f12345678901",
      "title": "US GDP growth above 3% in 2026?",
      "probability": 0.41
    }
  }
}`}</Code>
        </Endpoint>

        {/* GET /api/graph/cascades */}
        <Endpoint
          id="get-api-graph-cascades"
          method="GET"
          path="/api/graph/cascades"
          description="List cascade alerts. A cascade alert fires when a trigger market moves significantly and connected markets have not yet adjusted."
          auth={false}
        >
          <h3 className="text-lg font-bold font-mono mt-6 mb-2">Query Parameters</h3>
          <ParamTable
            params={[
              { name: "status", type: "string", description: "Filter by status: active, resolved, expired" },
              { name: "sort", type: "string", default: "detected_at", description: "Sort field: detected_at, trigger_delta" },
              { name: "order", type: "string", default: "desc", description: "Sort order: asc, desc" },
              { name: "page", type: "integer", default: "1", description: "Page number" },
              { name: "limit", type: "integer", default: "20", description: "Results per page (max 100)" },
            ]}
          />

          <h3 className="text-lg font-bold font-mono mt-6 mb-2">Example Request</h3>
          <Code>{`curl https://api.ontrifice.dev/v1/api/graph/cascades?status=active&limit=1`}</Code>

          <h3 className="text-lg font-bold font-mono mt-6 mb-2">Example Response</h3>
          <Code>{`{
  "cascades": [
    {
      "id": "d4e5f6a7-b8c9-0123-defg-345678901234",
      "triggerMarketId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
      "expectedMarketIds": [
        "b2c3d4e5-f6a7-8901-bcde-f12345678901"
      ],
      "triggerDelta": "0.15000000",
      "expectedDeltas": {
        "b2c3d4e5-f6a7-8901-bcde-f12345678901": 0.08
      },
      "lagWindowSeconds": 3600,
      "detectedAt": "2026-09-09T00:15:00.000Z",
      "resolvedAt": null,
      "status": "active",
      "triggerMarket": {
        "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
        "title": "Will the Fed cut rates in Q3 2026?",
        "platform": "polymarket",
        "currentProbability": "0.72000000"
      },
      "expectedMarkets": [
        {
          "id": "b2c3d4e5-f6a7-8901-bcde-f12345678901",
          "title": "US GDP growth above 3% in 2026?",
          "platform": "polymarket",
          "currentProbability": "0.41000000",
          "expectedDelta": 0.08
        }
      ]
    }
  ],
  "total": 5,
  "page": 1,
  "limit": 1
}`}</Code>
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

          <h3 className="text-lg font-bold font-mono mt-6 mb-2">Example Response</h3>
          <Code>{`{
  "summary": {
    "marketsProcessed": 1247,
    "created": 18,
    "updated": 1229,
    "errors": 0
  }
}`}</Code>
        </Endpoint>

        {/* POST /api/graph/compute */}
        <Endpoint
          id="post-api-graph-compute"
          method="POST"
          path="/api/graph/compute"
          description="Trigger a full graph computation cycle. Recomputes all edges, detects incoherences, and identifies cascade opportunities."
          auth={true}
        >
          <h3 className="text-lg font-bold font-mono mt-6 mb-2">Example Request</h3>
          <Code>{`curl -X POST https://api.ontrifice.dev/v1/api/graph/compute \\
  -H "Authorization: Bearer YOUR_API_KEY"`}</Code>

          <h3 className="text-lg font-bold font-mono mt-6 mb-2">Example Response</h3>
          <Code>{`{
  "status": "complete",
  "summary": {
    "edgesCreated": 342,
    "incoherencesDetected": 7,
    "cascadesDetected": 3,
    "computeTimeMs": 4821
  }
}`}</Code>
        </Endpoint>

        {/* Webhooks */}
        <section id="webhooks" className="mt-12 pt-8 border-t border-border">
          <h2 className="text-xl font-bold font-mono mb-4">Webhooks</h2>
          <p className="text-text-secondary">
            Webhook support for real-time incoherence and cascade notifications
            is planned.
          </p>
        </section>

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
