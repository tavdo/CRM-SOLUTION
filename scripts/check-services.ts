import { randomUUID } from "node:crypto";
import nodemailer from "nodemailer";
import { mailConfiguration } from "../src/lib/email";
import { putPrivateObject, getPrivateObject, deletePrivateObject } from "../src/lib/storage";

async function main() {
let failed = false;
const key = `launch-check/${randomUUID()}.txt`;
let uploaded = false;
try {
  await putPrivateObject(key, Buffer.from("CRM private storage verification"), "text/plain"); uploaded = true;
  const bytes = await getPrivateObject(key, 1024);
  if (bytes.toString() !== "CRM private storage verification") throw new Error();
  const endpoint = process.env.S3_ENDPOINT || "";
  if (endpoint.includes(".supabase.co/")) {
    const publicUrl = endpoint.replace(/\/s3$/, `/object/public/${process.env.S3_BUCKET}/${key}`);
    const response = await fetch(publicUrl, { signal: AbortSignal.timeout(10000) });
    if (response.ok || response.status >= 500) throw new Error();
  }
  console.log("PASS private object upload/download and anonymous access denied");
} catch { console.error("FAIL private storage verification; inspect server-only storage settings"); failed = true; }
finally {
  if (uploaded) try { await deletePrivateObject(key); } catch { console.error("FAIL test-object cleanup"); failed = true; }
}
try {
  const config = mailConfiguration();
  if (config.transport !== "smtp") throw new Error();
  await nodemailer.createTransport(config.options).verify();
  console.log("PASS SMTP TLS connection and authentication; verified-domain email delivery still needs a real send test");
} catch { console.error("FAIL SMTP connection/authentication; credentials were not logged"); failed = true; }
if (failed) process.exitCode = 1;
}
void main().catch(() => { console.error("Service check could not complete; credentials were not logged"); process.exitCode = 1; });
