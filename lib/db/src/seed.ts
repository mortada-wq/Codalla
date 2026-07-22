// Seeds the built-in pattern library (userId = null). Safe to re-run: existing
// built-in patterns are matched by id and updated in place rather than duplicated.
// Usage: pnpm --filter @workspace/db run seed
import { db, patternsTable } from "./index";
import { eq } from "drizzle-orm";

const BUILT_IN_PATTERNS: (typeof patternsTable.$inferInsert)[] = [
  {
    id: "builtin-prompt-role-separation",
    userId: null,
    problemType: "prompt",
    title: "Separate system and user intent",
    description: "Keep instructions the model must always follow in the system message, and put the user's actual request in the user message. Mixing them makes the model treat your rules as negotiable.",
    triggers: ["prompt", "system", "instruction", "role"],
    template: "System: <fixed rules, tone, constraints, output format>\nUser: <the actual request or question>",
    example: "System: 'Always respond with valid JSON matching the given schema.' User: 'Summarize this article.'",
    resources: [],
    isEnabled: true,
  },
  {
    id: "builtin-prompt-output-format",
    userId: null,
    problemType: "prompt",
    title: "Show the exact output shape you want",
    description: "Models follow a concrete example far more reliably than a prose description of the format. Give one filled-in example of the exact response shape before asking for the real one.",
    triggers: ["format", "output", "json", "response"],
    template: "Respond in exactly this format:\n<filled-in example of the desired output>\n\nNow do the same for: <real input>",
    example: "Respond in exactly this format:\n{\"title\": \"...\", \"tags\": [\"...\"]}",
    resources: [],
    isEnabled: true,
  },
  {
    id: "builtin-prompt-context-overflow",
    userId: null,
    problemType: "prompt",
    title: "Trim context before it overflows the window",
    description: "If replies get truncated or quality drops on long conversations, summarize or drop older turns instead of sending the entire history on every request.",
    triggers: ["token", "context", "long", "truncated"],
    template: "Keep the last N turns verbatim; replace anything older with a short running summary appended as a system message.",
    example: null,
    resources: [],
    isEnabled: true,
  },
  {
    id: "builtin-data-schema-validation",
    userId: null,
    problemType: "data-pipeline",
    title: "Validate schema before transforming",
    description: "Check column names, types, and required fields right after loading a dataset — failing fast there is much easier to debug than a cryptic error three transforms later.",
    triggers: ["csv", "schema", "column", "dataset", "validation"],
    template: "Load → assert expected columns/types exist → fail with a clear message naming the missing/mismatched field → then transform.",
    example: "assert set(['id','label']).issubset(df.columns), f'Missing columns: {set([\"id\",\"label\"]) - set(df.columns)}'",
    resources: [],
    isEnabled: true,
  },
  {
    id: "builtin-data-missing-values",
    userId: null,
    problemType: "data-pipeline",
    title: "Decide explicitly how to handle missing values",
    description: "Silently dropping or zero-filling nulls skews downstream results in ways that are hard to trace back. Pick a strategy per column and document why.",
    triggers: ["missing", "null", "nan", "cleaning"],
    template: "For each column with nulls: drop the row, impute a default, or flag-and-keep — choose per-column, and log how many rows were affected.",
    example: null,
    resources: [],
    isEnabled: true,
  },
  {
    id: "builtin-data-batch-processing",
    userId: null,
    problemType: "data-pipeline",
    title: "Process large datasets in batches, not all at once",
    description: "Loading an entire dataset into memory works until it doesn't. Stream or chunk the data so the pipeline scales with dataset size instead of available RAM.",
    triggers: ["batch", "dataframe", "pandas", "loader", "large"],
    template: "Iterate in fixed-size chunks (e.g. pandas' chunksize=, or a generator), processing and writing out each chunk before loading the next.",
    example: null,
    resources: [],
    isEnabled: true,
  },
  {
    id: "builtin-model-retry-backoff",
    userId: null,
    problemType: "model-integration",
    title: "Retry rate limits and timeouts with backoff",
    description: "A 429 or a transient network timeout isn't a real failure — retry a few times with exponential backoff before surfacing an error to the user.",
    triggers: ["rate", "timeout", "429", "retry", "error"],
    template: "On 429/5xx/timeout: wait, retry up to N times with exponentially increasing delay; only surface an error after retries are exhausted.",
    example: null,
    resources: [],
    isEnabled: true,
  },
  {
    id: "builtin-model-key-auth-errors",
    userId: null,
    problemType: "model-integration",
    title: "Diagnose 401/403 before assuming the model is broken",
    description: "An auth error looks like the integration is broken, but it's almost always a missing, expired, or wrong-scoped API key — check that first.",
    triggers: ["401", "403", "unauthorized", "key", "api"],
    template: "On 401/403: log which key/provider was used (never the key value itself), verify it's active and has the right scope/quota, before touching the request logic.",
    example: null,
    resources: [],
    isEnabled: true,
  },
  {
    id: "builtin-model-embedding-dimension",
    userId: null,
    problemType: "model-integration",
    title: "Match embedding dimensions across the pipeline",
    description: "A vector-store error about dimension mismatch almost always means the embedding model used at query time differs from the one used at index time.",
    triggers: ["embedding", "vector", "dimension", "shape"],
    template: "Pin one embedding model/version for both indexing and querying; store the model name alongside the vectors so a mismatch is caught immediately.",
    example: null,
    resources: [],
    isEnabled: true,
  },
  {
    id: "builtin-finetune-data-format",
    userId: null,
    problemType: "fine-tuning",
    title: "Validate the training data format before a full run",
    description: "Malformed JSONL rows or inconsistent field names usually surface hours into a training run. Validate every row's shape up front instead.",
    triggers: ["jsonl", "training", "dataset", "format"],
    template: "Parse and validate every row against the expected schema before submitting the job; reject the whole file on the first malformed row with its line number.",
    example: null,
    resources: [],
    isEnabled: true,
  },
  {
    id: "builtin-finetune-overfitting",
    userId: null,
    problemType: "fine-tuning",
    title: "Watch validation loss, not just training loss",
    description: "Training loss that keeps dropping while validation loss rises is overfitting — stop there rather than chasing a lower training number.",
    triggers: ["loss", "overfitting", "epoch", "validation"],
    template: "Track train and validation loss per epoch; stop (or checkpoint-and-revert) once validation loss stops improving for a few consecutive epochs.",
    example: null,
    resources: [],
    isEnabled: true,
  },
  {
    id: "builtin-general-reproduce-first",
    userId: null,
    problemType: "general",
    title: "Reproduce the failure before changing anything",
    description: "A fix for a bug you can't reliably reproduce is a guess. Find the smallest input that triggers it first, then fix, then confirm the same input now passes.",
    triggers: ["bug", "error", "fix", "not working"],
    template: "Minimal reproduction → root cause → smallest fix → re-run the same reproduction to confirm.",
    example: null,
    resources: [],
    isEnabled: true,
  },
];

async function seed() {
  let created = 0;
  let updated = 0;

  for (const pattern of BUILT_IN_PATTERNS) {
    const [existing] = await db.select({ id: patternsTable.id }).from(patternsTable).where(eq(patternsTable.id, pattern.id));
    if (existing) {
      await db.update(patternsTable)
        .set({ ...pattern, updatedAt: new Date() })
        .where(eq(patternsTable.id, pattern.id));
      updated++;
    } else {
      await db.insert(patternsTable).values(pattern);
      created++;
    }
  }

  console.log(`Seeded built-in patterns: ${created} created, ${updated} updated.`);
}

seed()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Seed failed:", err);
    process.exit(1);
  });
