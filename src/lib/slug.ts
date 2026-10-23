export function slugify(input: string): string {
  const base = input
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\u10a0-\u10ff]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  return base || "company";
}

export function uniqueSlug(base: string, suffix: string): string {
  const clean = slugify(base).slice(0, 40);
  return `${clean}-${suffix.slice(0, 8)}`;
}
