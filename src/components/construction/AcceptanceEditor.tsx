"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { SiteField } from "./Fields";
import { Button } from "../ui";

export function AcceptanceEditor() {
  const [rows, setRows] = useState([0]);
  const [next, setNext] = useState(1);
  const t = useTranslations("construction");
  return <div className="construction-stack">{rows.map((row, index) => <fieldset className="construction-line" key={row}>
    <legend>{t("line")} {index + 1}</legend><div className="construction-grid">
      <SiteField name="lineDescription" label={t("description")} /><SiteField name="lineUnit" label={t("unit")} value="m²" />
      <SiteField name="lineQuantity" label={t("quantity")} value="1" type="number" step="0.001" /><SiteField name="linePrice" label={t("unitPrice")} value="0" type="number" step="0.01" />
    </div>{rows.length > 1 ? <Button type="button" variant="secondary" onClick={() => setRows(rows.filter((id) => id !== row))}>{t("removeLine")}</Button> : null}
  </fieldset>)}<Button variant="secondary" type="button" disabled={rows.length >= 200} onClick={() => { setRows([...rows, next]); setNext(next + 1); }}>{t("addLine")}</Button></div>;
}
