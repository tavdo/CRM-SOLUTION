const origin = process.argv[2] || process.env.APP_URL;
if (!origin) throw new Error("Usage: npm run release:smoke -- https://your-domain");
const base = new URL(origin);
if (base.protocol !== "https:" && !["localhost", "127.0.0.1"].includes(base.hostname)) throw new Error("Remote smoke tests require HTTPS");
const paths = ["/api/health", "/ka", "/en", "/ka/sign-in", "/ka/sign-up", "/ka/privacy", "/ka/terms", "/ka/contact", "/robots.txt", "/sitemap.xml"];
const assets = new Map();
for (const path of paths) {
  const response = await fetch(new URL(path, base), { signal: AbortSignal.timeout(20000) });
  if (!response.ok) throw new Error(`Smoke failed: ${path} returned ${response.status}`);
  if (path === "/api/health" && (await response.json()).status !== "ok") throw new Error("Health check did not report ok");
  if (["/ka", "/ka/sign-up"].includes(path)) {
    const html = await response.text();
    for (const tag of html.match(/<(?:link|script|img)\b[^>]*>/gi) || []) {
      const attribute = name => tag.match(new RegExp(`\\b${name}=["']([^"']+)["']`, "i"))?.[1]?.replaceAll("&amp;", "&");
      const type = /^<script/i.test(tag) ? "script" : /^<img/i.test(tag) ? "image" : attribute("rel") === "stylesheet" ? "style" : null;
      const source = attribute(type === "style" ? "href" : "src");
      if (type && source && new URL(source, base).origin === base.origin) assets.set(source, type);
    }
  }
  console.log(`PASS ${path}`);
}
if (!["style", "script", "image"].every(type => [...assets.values()].includes(type))) throw new Error("Expected page assets were not found");
await Promise.all([...assets].map(async ([source, type]) => {
  const response = await fetch(new URL(source, base), { signal: AbortSignal.timeout(20000) });
  const mime = response.headers.get("content-type") || "";
  const expected = type === "style" ? /text\/css/ : type === "script" ? /(?:javascript|ecmascript)/ : /image\//;
  if (!response.ok || !expected.test(mime)) throw new Error(`Page asset failed (${response.status}, ${type}): ${source}`);
  await response.arrayBuffer();
}));
console.log(`PASS ${assets.size} page assets (CSS, JavaScript and images)`);
const privatePage = await fetch(new URL("/ka/dashboard", base), { redirect: "manual", signal: AbortSignal.timeout(20000) });
if (![302, 303, 307, 308].includes(privatePage.status) || !privatePage.headers.get("location")?.includes("/ka/sign-in")) throw new Error("Private dashboard is not protected");
console.log("PASS anonymous dashboard access denied. Complete real email, upload and role smoke tests before launch.");
