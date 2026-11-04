"use client";

import { useActionState, useId, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { constructionAction } from "@/app/actions/construction";
import { Alert, Button } from "@/components/ui";

export function ActionForm({ operation, projectId = "", locale, label, children }: { operation: string; projectId?: string; locale: string; label: string; children?: ReactNode }) {
  const [state, action, pending] = useActionState(constructionAction, {});
  const t = useTranslations("construction");
  const formId = useId();
  return <form action={action} className="construction-form" aria-describedby={state.error ? `${formId}-error` : undefined}>
    <input type="hidden" name="operation" value={operation} /><input type="hidden" name="projectId" value={projectId} /><input type="hidden" name="locale" value={locale} />
    {children}
    {state.error ? <div id={`${formId}-error`}><Alert>{t.has(`errors.${state.error}`) ? t(`errors.${state.error}`) : t("errors.C_ERROR")}</Alert></div> : null}
    <Button type="submit" disabled={pending}>{pending ? t("saving") : label}</Button>
  </form>;
}
