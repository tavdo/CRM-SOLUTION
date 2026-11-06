import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
const file = fileURLToPath(new URL("../.env.live.local", import.meta.url));
const password = process.env.DATABASE_PASSWORD;
if (!password || password === "REPLACE_ME") throw new Error("Enter DATABASE_PASSWORD in the ignored .env.live.local file first. Do not paste it into chat.");
let text = readFileSync(file, "utf8");
for (const name of ["DATABASE_URL", "DIRECT_URL"]) {
  const raw = process.env[name];
  if (!raw || !/^postgres/.test(raw)) throw new Error(`${name} is missing`);
  const url = new URL(raw); url.password = encodeURIComponent(password);
  text = text.replace(new RegExp(`^${name}=.*$`, "m"), `${name}=${JSON.stringify(url.toString())}`);
}
text = text.replace(/^DATABASE_PASSWORD=.*\r?\n?/m, "");
writeFileSync(file, text, { mode: 0o600 });
console.log("Database connection strings configured in the ignored live environment. Password values were not printed.");
