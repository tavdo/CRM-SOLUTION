"use client";

import { useTransition } from "react";
import { moveDealAction } from "@/app/actions/crm";

export function MoveDealSelect({
  locale,
  dealId,
  stageId,
  stages,
  label,
}: {
  locale: string;
  dealId: string;
  stageId: string;
  stages: { id: string; name: string }[];
  label: string;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <form
      action={(fd) => {
        startTransition(async () => {
          await moveDealAction(fd);
        });
      }}
      style={{ marginTop: 8 }}
    >
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="dealId" value={dealId} />
      <label className="sr-only" htmlFor={`move-${dealId}`}>
        {label}
      </label>
      <select
        id={`move-${dealId}`}
        name="stageId"
        className="select"
        defaultValue={stageId}
        disabled={pending}
        onChange={(e) => e.currentTarget.form?.requestSubmit()}
      >
        {stages.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name}
          </option>
        ))}
      </select>
    </form>
  );
}
