import Link from "next/link";
import { setRequestLocale } from "next-intl/server";
import { redirect } from "next/navigation";
import { Package, Plus } from "lucide-react";
import { Badge, Button, EmptyState, Field, Input, Surface, Textarea } from "@/components/ui";
import {
  createProductAction,
  toggleProductActiveAction,
} from "@/app/actions/crm";
import { requireWorkspace } from "@/lib/auth/workspace";
import { listProducts } from "@/lib/services/products";
import { formatMoney } from "@/lib/money";
import { isLocale } from "@/i18n/config";
import styles from "./products.module.css";

export default async function ProductsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) redirect("/en");
  setRequestLocale(locale);
  const ctx = await requireWorkspace();
  const isKa = locale === "ka";
  const products = await listProducts(ctx);

  return (
    <div className={styles.page}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-end",
          gap: "1rem",
          flexWrap: "wrap",
        }}
      >
        <div>
          <span className="kicker">{ctx.company.name}</span>
          <h1 className="page-title" style={{ marginTop: 2 }}>
            {isKa ? "მასალები და სამშენებლო მომსახურებები" : "Materials & Construction Services"}
          </h1>
          <p className="muted" style={{ margin: "0.35rem 0 0", fontSize: "0.88rem" }}>
            {isKa
              ? "მასალების მოთხოვნებისთვის, შესყიდვებისთვის და შეთავაზებებისთვის."
              : "Catalog for material requests, purchases and offers."}
          </p>
        </div>
        <Link href={`/${locale}/invoices`} className="btn btn-secondary">
          {isKa ? "ინვოისები / შეთავაზებები" : "Invoices / Quotes"}
        </Link>
      </div>

      <div className={styles.content}>
        <Surface className={styles.catalog}>
          {products.length === 0 ? (
            <EmptyState>
              {isKa ? "კატალოგი ცარიელია." : "No products yet. Add your first SKU."}
            </EmptyState>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>{isKa ? "დასახელება" : "Name"}</th>
                  <th>SKU</th>
                  <th>{isKa ? "ერთეული" : "Unit"}</th>
                  <th>{isKa ? "ფასი" : "Price"}</th>
                  <th>{isKa ? "სტატუსი" : "Status"}</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {products.map((p) => (
                  <tr key={p.id}>
                    <td>
                      <strong style={{ color: "var(--ink)" }}>{p.name}</strong>
                      {p.description ? (
                        <div className="muted" style={{ fontSize: "0.75rem" }}>
                          {p.description}
                        </div>
                      ) : null}
                    </td>
                    <td className="muted">{p.sku ?? "—"}</td>
                    <td className="muted">{p.unit}</td>
                    <td style={{ fontWeight: 600 }}>
                      {formatMoney(p.priceMinor, p.currency, locale)}
                    </td>
                    <td>
                      <Badge tone={p.isActive ? "ok" : "default"}>
                        {p.isActive
                          ? isKa
                            ? "აქტიური"
                            : "Active"
                          : isKa
                            ? "გამორთული"
                            : "Inactive"}
                      </Badge>
                    </td>
                    <td>
                      <form action={toggleProductActiveAction}>
                        <input type="hidden" name="locale" value={locale} />
                        <input type="hidden" name="id" value={p.id} />
                        <input
                          type="hidden"
                          name="isActive"
                          value={p.isActive ? "0" : "1"}
                        />
                        <Button
                          type="submit"
                          variant="secondary"
                          style={{ padding: "0.35rem 0.7rem", fontSize: "0.75rem" }}
                        >
                          {p.isActive
                            ? isKa
                              ? "გამორთვა"
                              : "Deactivate"
                            : isKa
                              ? "ჩართვა"
                              : "Activate"}
                        </Button>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Surface>

        <Surface className={styles.formPanel} style={{ padding: "1.2rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: "0.85rem" }}>
            <Package size={16} color="#10b981" />
            <h2 className="section-title">
              {isKa ? "ახალი პროდუქტი" : "Add product"}
            </h2>
          </div>
          <form action={createProductAction} className={styles.form}>
            <input type="hidden" name="locale" value={locale} />
            <Field label={isKa ? "დასახელება" : "Name"} htmlFor="name">
              <Input id="name" name="name" required />
            </Field>
            <Field label="SKU" htmlFor="sku">
              <Input id="sku" name="sku" placeholder="MAT-001" />
            </Field>
            <Field label={isKa ? "ფასი (GEL)" : "Price (GEL)"} htmlFor="price">
              <Input id="price" name="price" type="number" step="0.01" defaultValue="100" />
            </Field>
            <Field label={isKa ? "ერთეული" : "Unit"} htmlFor="unit">
              <select id="unit" name="unit" className="select" defaultValue="ცალი">
                <option value="ცალი">ცალი</option>
                <option value="თვე">თვე</option>
                <option value="საათი">საათი</option>
                <option value="პაკეტი">პაკეტი</option>
              </select>
            </Field>
            <div className={styles.description}>
              <Field label={isKa ? "აღწერა" : "Description"} htmlFor="description">
                <Textarea id="description" name="description" style={{ minHeight: 64 }} />
              </Field>
            </div>
            <div className={styles.actions}>
              <Button type="submit">
                <Plus size={14} />
                <span>{isKa ? "შენახვა" : "Save product"}</span>
              </Button>
            </div>
          </form>
        </Surface>
      </div>
    </div>
  );
}
