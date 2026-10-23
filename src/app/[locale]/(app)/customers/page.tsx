import Link from "next/link";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { redirect } from "next/navigation";
import { Plus, Search, ArrowUpRight } from "lucide-react";
import { Button, EmptyState, Input, Surface } from "@/components/ui";
import { requireWorkspace } from "@/lib/auth/workspace";
import { listCustomers } from "@/lib/services/customers";
import { isLocale } from "@/i18n/config";

export default async function CustomersPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  const { locale } = await params;
  const sp = await searchParams;
  if (!isLocale(locale)) redirect("/en");
  setRequestLocale(locale);
  const ctx = await requireWorkspace();
  const page = Number(sp.page ?? 1);
  const result = await listCustomers(ctx, { q: sp.q, page });
  const t = await getTranslations("customers");
  const common = await getTranslations("common");

  return (
    <div style={{ display: "grid", gap: "1.15rem" }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: "1rem",
          flexWrap: "wrap",
        }}
      >
        <div>
          <span className="kicker">{ctx.company.name}</span>
          <h1 className="page-title" style={{ marginTop: 2 }}>
            {t("title")}
          </h1>
        </div>
        <Link href={`/${locale}/customers/new`} className="btn btn-primary">
          <Plus size={15} />
          <span>{t("new")}</span>
        </Link>
      </div>

      <form style={{ display: "flex", gap: "0.6rem", maxWidth: 460 }}>
        <Input
          name="q"
          defaultValue={sp.q ?? ""}
          placeholder={t("search")}
          aria-label={t("search")}
        />
        <Button type="submit" variant="secondary">
          <Search size={15} />
          <span>{common("search")}</span>
        </Button>
      </form>

      <Surface style={{ overflowX: "auto" }}>
        {result.items.length === 0 ? (
          <EmptyState>{t("empty")}</EmptyState>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>{t("name")}</th>
                <th>{t("email")}</th>
                <th>{t("phone")}</th>
                <th>{t("owner")}</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {result.items.map((c) => (
                <tr key={c.id}>
                  <td>
                    <Link href={`/${locale}/customers/${c.id}`}>
                      <strong style={{ color: "#fff" }}>{c.name}</strong>
                    </Link>
                  </td>
                  <td className="muted">{c.email ?? "—"}</td>
                  <td className="muted">{c.phone ?? "—"}</td>
                  <td className="muted">{c.owner?.name ?? "—"}</td>
                  <td style={{ textAlign: "right" }}>
                    <Link href={`/${locale}/customers/${c.id}`} className="muted">
                      <ArrowUpRight size={15} />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Surface>

      {result.totalPages > 1 ? (
        <p className="muted" style={{ fontSize: "0.85rem" }}>
          {common("page")} {result.page} {common("of")} {result.totalPages}
          {result.page < result.totalPages ? (
            <>
              {" · "}
              <Link
                href={`/${locale}/customers?page=${result.page + 1}&q=${encodeURIComponent(sp.q ?? "")}`}
                style={{ color: "var(--brand)" }}
              >
                Next →
              </Link>
            </>
          ) : null}
        </p>
      ) : null}
    </div>
  );
}
