import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const fake = vi.hoisted(() => ({ send: vi.fn(), configuration: vi.fn() }));
vi.mock("@aws-sdk/client-s3", async importOriginal => {
  const actual = await importOriginal<typeof import("@aws-sdk/client-s3")>();
  return { ...actual, S3Client: class { constructor(config: unknown) { fake.configuration(config); } send = fake.send; } };
});
import { getPrivateObject, putPrivateObject, deletePrivateObject } from "../src/lib/storage";
beforeEach(() => { vi.stubEnv("S3_BUCKET", "private-test"); vi.stubEnv("AWS_REGION", "eu-central-1"); fake.send.mockReset(); fake.configuration.mockReset(); });
afterEach(() => vi.unstubAllEnvs());
describe("private object storage", () => {
  it("uploads and removes the exact private scoped object without a public ACL", async () => {
    await putPrivateObject("construction/company/file.pdf", Buffer.from("%PDF"), "application/pdf");
    expect(fake.send.mock.calls[0][0].input).toEqual({ Bucket: "private-test", Key: "construction/company/file.pdf", Body: Buffer.from("%PDF"), ContentType: "application/pdf" });
    await deletePrivateObject("construction/company/file.pdf");
    expect(fake.send.mock.calls[1][0].input.Key).toBe("construction/company/file.pdf");
  });
  it("enforces download size even when the stored object omits a content length", async () => {
    fake.send.mockResolvedValue({ Body: (async function* () { yield Buffer.from("12345"); yield Buffer.from("67890"); })() });
    await expect(getPrivateObject("inbox/company/file", 6)).rejects.toThrow("size limit");
  });
  it("rejects traversal and insecure endpoints before issuing a storage request", async () => {
    await expect(getPrivateObject("construction/../private", 10)).rejects.toThrow("Invalid storage key");
    vi.stubEnv("S3_ENDPOINT", "http://storage.test");
    await expect(putPrivateObject("safe/file", Buffer.from("x"), "text/plain")).rejects.toThrow("HTTPS");
    expect(fake.send).not.toHaveBeenCalled();
  });
  it("uses the private storage credentials instead of the serverless host's AWS identity", async () => {
    vi.stubEnv("S3_ENDPOINT", "https://storage.test");
    vi.stubEnv("S3_REGION", "ap-southeast-1");
    vi.stubEnv("S3_ACCESS_KEY_ID", "private-storage-id");
    vi.stubEnv("S3_SECRET_ACCESS_KEY", "private-storage-secret");
    vi.stubEnv("AWS_ACCESS_KEY_ID", "host-identity");
    vi.stubEnv("AWS_SECRET_ACCESS_KEY", "host-secret");
    await putPrivateObject("safe/file", Buffer.from("x"), "text/plain");
    expect(fake.configuration).toHaveBeenCalledWith(expect.objectContaining({
      region: "ap-southeast-1", credentials: { accessKeyId: "private-storage-id", secretAccessKey: "private-storage-secret" },
    }));
  });
});
