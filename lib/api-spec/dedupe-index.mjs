// orval appends its re-export lines to an existing workspace index.ts on
// every run instead of replacing it, so any custom exports we've added
// (setBaseUrl, AuthTokenGetter, etc.) accumulate duplicate copies of the
// generated re-exports on each `codegen` run. Dedupe line-for-line,
// keeping first occurrence order, right after orval runs.
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const files = [
  path.resolve(import.meta.dirname, "..", "api-client-react", "src", "index.ts"),
  path.resolve(import.meta.dirname, "..", "api-zod", "src", "index.ts"),
];

for (const file of files) {
  const lines = readFileSync(file, "utf8").split("\n");
  const seen = new Set();
  const deduped = lines.filter((line) => {
    const trimmed = line.trim();
    if (trimmed === "") return true;
    // Normalize quote style ('./x' vs "./x") so orval's re-appended lines
    // are recognized as duplicates of the existing ones, not distinct text.
    const normalized = trimmed.replace(/'/g, '"');
    if (seen.has(normalized)) return false;
    seen.add(normalized);
    return true;
  });
  writeFileSync(file, deduped.join("\n"));
}

console.log("Deduped generated barrel exports.");
