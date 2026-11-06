import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { createReadStream, createWriteStream, existsSync } from "node:fs";
import { mkdir, mkdtemp, writeFile, readFile, readdir, rename, appendFile, stat, lstat, rm, cp } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { pipeline } from "node:stream/promises";
import { spawnSync } from "node:child_process";
import * as tar from "tar";
import { S3Client, ListObjectsV2Command, GetObjectCommand } from "@aws-sdk/client-s3";

const MAGIC = Buffer.from("CRMBKP1\n");
const root = fileURLToPath(new URL("../", import.meta.url));
const args = process.argv.slice(2);
const flag = name => { const i = args.indexOf(name); return i < 0 ? undefined : args[i + 1]; };
const mode = args[0];
const key = Buffer.from(process.env.BACKUP_ENCRYPTION_KEY || "", "base64");
if (key.length !== 32) throw new Error("Set BACKUP_ENCRYPTION_KEY to a separately backed-up random 32-byte base64 key");

function postgresEnvironment(connection) {
  const u = new URL(connection);
  return { ...process.env, PGHOST: u.hostname, PGPORT: u.port || "5432", PGUSER: decodeURIComponent(u.username),
    PGPASSWORD: decodeURIComponent(u.password), PGDATABASE: decodeURIComponent(u.pathname.slice(1)), PGSSLMODE: u.searchParams.get("sslmode") || "require" };
}
function safeKey(key) {
  if (!key || key.startsWith("/") || key.includes("\\") || key.split("/").some(p => !p || p === "." || p === "..")) throw new Error("Unsafe media key");
  return key;
}
async function copyMedia(staging) {
  const media = path.join(staging, "media"); await mkdir(media);
  if (process.env.FILE_STORAGE === "s3" || process.env.INBOX_STORAGE === "s3") {
    if (!process.env.S3_BUCKET) throw new Error("S3_BUCKET is missing");
    const accessKeyId = process.env.S3_ACCESS_KEY_ID || process.env.AWS_ACCESS_KEY_ID;
    const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY || process.env.AWS_SECRET_ACCESS_KEY;
    if (process.env.S3_ENDPOINT && (!accessKeyId || !secretAccessKey)) throw new Error("Private storage credentials are missing");
    const s3 = new S3Client({ region: process.env.S3_REGION || process.env.AWS_REGION,
      credentials: accessKeyId && secretAccessKey ? { accessKeyId, secretAccessKey } : undefined,
      endpoint: process.env.S3_ENDPOINT || undefined, forcePathStyle: !!process.env.S3_ENDPOINT });
    let token;
    do {
      const page = await s3.send(new ListObjectsV2Command({ Bucket: process.env.S3_BUCKET, ContinuationToken: token }));
      for (const entry of page.Contents || []) {
        if (!entry.Key || entry.Key.endsWith("/")) continue;
        const destination = path.join(media, safeKey(entry.Key));
        await mkdir(path.dirname(destination), { recursive: true });
        const object = await s3.send(new GetObjectCommand({ Bucket: process.env.S3_BUCKET, Key: entry.Key }));
        if (!object.Body) throw new Error("Media object is unavailable");
        await pipeline(object.Body, createWriteStream(destination, { flags: "wx", mode: 0o600 }));
      }
      token = page.IsTruncated ? page.NextContinuationToken : undefined;
      if (page.IsTruncated && !token) throw new Error("Incomplete media listing");
    } while (token);
  }
  // Preserve local files too during a storage migration. No .env files are copied.
  const localStorage = process.env.BACKUP_LOCAL_STORAGE_PATH || path.join(root, "storage");
  const includesLocal = process.env.FILE_STORAGE !== "s3" || process.env.INBOX_STORAGE !== "s3" || process.env.BACKUP_INCLUDE_LOCAL === "true";
  if (includesLocal && existsSync(localStorage)) await cp(localStorage, path.join(media, "local-storage"), { recursive: true, dereference: false,
    filter: async source => !(await lstat(source)).isSymbolicLink() });
}

if (mode === "create") {
  const output = path.resolve(flag("--output") || path.join(root, "backups", `crm-${new Date().toISOString().replaceAll(":", "-")}.crmbak`));
  if (existsSync(output) || existsSync(output + ".partial")) throw new Error("Backup destination already exists");
  await mkdir(path.dirname(output), { recursive: true });
  const staging = await mkdtemp(path.join(tmpdir(), "crm-backup-"));
  try {
    const connection = process.env.DATABASE_URL || "";
    const postgres = /^postgres(ql)?:/.test(connection);
    if (postgres) {
      const result = spawnSync(process.env.PG_DUMP_PATH || "pg_dump", ["--format=custom", "--schema=crm", "--no-owner", "--no-privileges", "--file", path.join(staging, "database.dump")],
        { env: postgresEnvironment(process.env.DIRECT_URL || connection), stdio: ["ignore", "ignore", "pipe"] });
      if (result.error || result.status !== 0) throw new Error("pg_dump failed; verify PG_DUMP_PATH, DIRECT_URL and connectivity");
    } else {
      if (!connection.startsWith("file:")) throw new Error("DATABASE_URL is missing or unsupported");
      const { DatabaseSync, backup } = await import("node:sqlite");
      const source = connection.slice(5);
      const database = new DatabaseSync(path.isAbsolute(source) ? source : path.join(root, "prisma", source), { readOnly: true });
      try { await backup(database, path.join(staging, "database.sqlite")); } finally { database.close(); }
    }
    await copyMedia(staging);
    await writeFile(path.join(staging, "manifest.json"), JSON.stringify({ version: 1, createdAt: new Date().toISOString(), database: postgres ? "postgresql" : "sqlite", schema: postgres ? "crm" : undefined }, null, 2));
    await writeFile(path.join(staging, "inbox-key.json"), JSON.stringify({ INBOX_ENCRYPTION_KEY: process.env.INBOX_ENCRYPTION_KEY || null }), { mode: 0o600 });
    const iv = randomBytes(12); const cipher = createCipheriv("aes-256-gcm", key, iv); cipher.setAAD(MAGIC);
    await writeFile(output + ".partial", Buffer.concat([MAGIC, iv]), { flag: "wx", mode: 0o600 });
    await pipeline(tar.c({ gzip: true, cwd: staging, portable: true }, ["manifest.json", "database." + (postgres ? "dump" : "sqlite"), "inbox-key.json", "media"]),
      cipher, createWriteStream(output + ".partial", { flags: "a", mode: 0o600 }));
    await appendFile(output + ".partial", cipher.getAuthTag());
    await rename(output + ".partial", output);
    console.log(`Encrypted database/media backup saved: ${output}`);
  } finally {
    // Only remove the exact OS-created task staging directory, never user paths.
    if (path.dirname(staging) === path.resolve(tmpdir()) && path.basename(staging).startsWith("crm-backup-")) await rm(staging, { recursive: true, force: true });
  }
} else if (mode === "restore") {
  const source = flag("--input"); const destination = flag("--to-dir");
  if (!source || !destination) throw new Error("Usage: restore --input archive.crmbak --to-dir EMPTY_DIRECTORY");
  const target = path.resolve(destination);
  if (existsSync(target) && (await readdir(target)).length) throw new Error("Restore requires an empty directory; existing files/databases are never overwritten");
  const size = (await stat(source)).size;
  if (size < 36) throw new Error("Invalid backup");
  const { open } = await import("node:fs/promises"); const input = await open(source, "r");
  const header = Buffer.alloc(20); const tag = Buffer.alloc(16);
  try { await input.read(header, 0, 20, 0); await input.read(tag, 0, 16, size - 16); } finally { await input.close(); }
  if (!header.subarray(0, 8).equals(MAGIC)) throw new Error("Unsupported backup format");
  const staging = await mkdtemp(path.join(tmpdir(), "crm-backup-"));
  try {
    const decipher = createDecipheriv("aes-256-gcm", key, header.subarray(8)); decipher.setAAD(MAGIC); decipher.setAuthTag(tag);
    // Authenticate the entire archive before extracting or touching the target.
    await pipeline(createReadStream(source, { start: 20, end: size - 17 }), decipher, createWriteStream(path.join(staging, "data.tgz"), { mode: 0o600 }));
    const unpacked = path.join(staging, "unpacked"); await mkdir(unpacked);
    await tar.x({ file: path.join(staging, "data.tgz"), cwd: unpacked, strict: true,
      filter: (entry, metadata) => { safeKey(entry.replace(/\/$/, "")); if (["SymbolicLink", "Link"].includes(metadata.type)) throw new Error("Links are not allowed in backups"); return true; } });
    const manifest = JSON.parse(await readFile(path.join(unpacked, "manifest.json"), "utf8"));
    if (manifest.version !== 1 || !["sqlite", "postgresql"].includes(manifest.database)) throw new Error("Invalid backup manifest");
    await mkdir(target, { recursive: true });
    for (const entry of await readdir(unpacked)) await cp(path.join(unpacked, entry), path.join(target, entry), { recursive: true, force: false, errorOnExist: true });
    console.log(`Authenticated backup restored to ${target}. Live databases were not changed. Follow docs/PRODUCTION.md for isolated database restore verification.`);
  } finally {
    if (path.dirname(staging) === path.resolve(tmpdir()) && path.basename(staging).startsWith("crm-backup-")) await rm(staging, { recursive: true, force: true });
  }
} else throw new Error("Use create --output FILE or restore --input FILE --to-dir EMPTY_DIRECTORY");
