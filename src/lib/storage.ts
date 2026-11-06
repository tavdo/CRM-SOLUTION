import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";

function objectStorage() {
  const region = process.env.S3_REGION || process.env.AWS_REGION;
  if (!process.env.S3_BUCKET || !region) throw new Error("Private object storage is not configured");
  const endpoint = process.env.S3_ENDPOINT;
  if (endpoint && new URL(endpoint).protocol !== "https:") throw new Error("Object storage requires HTTPS");
  const accessKeyId = process.env.S3_ACCESS_KEY_ID || process.env.AWS_ACCESS_KEY_ID;
  const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY || process.env.AWS_SECRET_ACCESS_KEY;
  if (endpoint && (!accessKeyId || !secretAccessKey)) throw new Error("Private object storage credentials are missing");
  return { bucket: process.env.S3_BUCKET, client: new S3Client({ region,
    credentials: accessKeyId && secretAccessKey ? { accessKeyId, secretAccessKey } : undefined,
    endpoint: endpoint || undefined, forcePathStyle: !!endpoint }) };
}

function validateKey(key: string) {
  if (!/^[a-zA-Z0-9_\-/\.]+$/.test(key) || key.includes("..") || key.startsWith("/")) throw new Error("Invalid storage key");
}

export async function putPrivateObject(key: string, bytes: Uint8Array, mime: string) {
  validateKey(key);
  const { client, bucket } = objectStorage();
  await client.send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: bytes, ContentType: mime }));
}

export async function getPrivateObject(key: string, maxBytes: number) {
  validateKey(key);
  const { client, bucket } = objectStorage();
  const response = await client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
  if (!response.Body || (response.ContentLength ?? 0) > maxBytes) throw new Error("Invalid stored object size");
  const chunks: Uint8Array[] = []; let size = 0;
  for await (const chunk of response.Body as AsyncIterable<Uint8Array>) {
    size += chunk.length;
    if (size > maxBytes) throw new Error("Stored object exceeds size limit");
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

export async function deletePrivateObject(key: string) {
  validateKey(key);
  const { client, bucket } = objectStorage();
  await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
}
