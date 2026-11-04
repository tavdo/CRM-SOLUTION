import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
// Isolation is tested with temporary tenants, not with records in the configured database.
execFileSync(process.execPath, [require.resolve("vitest/vitest.mjs"), "run", "tests/security-workflows.integration.test.ts"], { stdio: "inherit" });
