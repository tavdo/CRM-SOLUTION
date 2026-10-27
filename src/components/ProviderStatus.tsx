import { getTranslations } from "next-intl/server";
import { Badge } from "@/components/ui";
import {
  providerTone,
  type ProviderInfo,
} from "@/lib/providers";

export async function ProviderStatus({
  provider,
  locale,
}: {
  provider: ProviderInfo;
  locale: string;
}) {
  const t = await getTranslations({ locale, namespace: "providers" });
  return (
    <div style={{ display: "grid", gap: 4 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <strong style={{ fontSize: "0.85rem", color: "#fff" }}>{t(`labels.${provider.id}`)}</strong>
        <Badge tone={providerTone(provider.state)}>
          {t(`states.${provider.state}`)}
        </Badge>
      </div>
      <p className="muted" style={{ margin: 0, fontSize: "0.78rem", lineHeight: 1.45 }}>
        {t(`details.${provider.detail}`)}
      </p>
    </div>
  );
}
