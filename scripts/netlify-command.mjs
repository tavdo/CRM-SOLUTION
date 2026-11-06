import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { homedir } from "node:os";
import path from "node:path";

// Use the official CLI installed by npm exec; no shell interpolation or token arguments.
const cache = process.env.npm_config_cache || (process.platform === "win32"
  ? path.join(process.env.LOCALAPPDATA || path.join(homedir(), "AppData/Local"), "npm-cache")
  : path.join(homedir(), ".npm"));
const npx = path.join(cache, "_npx");
const candidates = existsSync(npx) ? readdirSync(npx).map(name => path.join(npx, name, "node_modules/netlify-cli/package.json"))
  .filter(file => existsSync(file)).sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs) : [];
if (!candidates.length) throw new Error("Install the official CLI first: npm exec --yes --package=netlify-cli -- netlify --version");
const metadata = JSON.parse(readFileSync(candidates[0], "utf8"));
const entry = path.resolve(path.dirname(candidates[0]), typeof metadata.bin === "string" ? metadata.bin : metadata.bin.netlify);
const result = spawnSync(process.execPath, [entry, ...process.argv.slice(2)], { env: process.env, stdio: "inherit" });
process.exitCode = result.status ?? 1;
