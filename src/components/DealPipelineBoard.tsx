"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Badge } from "@/components/ui";
import { moveDealByIdAction } from "@/app/actions/crm";

export type PipelineDeal = {
  id: string;
  title: string;
  stageId: string;
  amountLabel: string;
  customerName: string;
  ownerName: string;
};

export type PipelineStage = {
  id: string;
  name: string;
  isWon: boolean;
  isLost: boolean;
  totalLabel: string | null;
  deals: PipelineDeal[];
};

export function DealPipelineBoard({
  locale,
  stages,
}: {
  locale: string;
  stages: PipelineStage[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [overStageId, setOverStageId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function onDrop(stageId: string) {
    if (!draggingId) return;
    const from = stages.find((s) => s.deals.some((d) => d.id === draggingId));
    if (!from || from.id === stageId) {
      setDraggingId(null);
      setOverStageId(null);
      return;
    }
    const dealId = draggingId;
    setDraggingId(null);
    setOverStageId(null);
    setError(null);
    startTransition(async () => {
      try {
        await moveDealByIdAction(locale, dealId, stageId);
        router.refresh();
      } catch {
        setError(locale === "ka" ? "ეტაპის შეცვლა ვერ მოხერხდა" : "Could not move deal");
      }
    });
  }

  return (
    <div style={{ display: "grid", gap: "0.75rem" }}>
      {error ? (
        <div className="muted" style={{ color: "var(--danger-ink)", fontSize: "0.85rem" }}>
          {error}
        </div>
      ) : null}
      {pending ? (
        <div className="muted" style={{ fontSize: "0.8rem" }}>
          {locale === "ka" ? "გადაადგილება…" : "Moving…"}
        </div>
      ) : null}
      <div className="pipeline" role="list">
        {stages.map((stage) => (
          <section
            key={stage.id}
            className={`pipeline-col${overStageId === stage.id ? " pipeline-col-over" : ""}`}
            aria-label={stage.name}
            role="listitem"
            onDragOver={(e) => {
              e.preventDefault();
              setOverStageId(stage.id);
            }}
            onDragLeave={() => {
              setOverStageId((cur) => (cur === stage.id ? null : cur));
            }}
            onDrop={(e) => {
              e.preventDefault();
              onDrop(stage.id);
            }}
          >
            <div className="pipeline-col-header">
              <div>
                <strong style={{ fontSize: "0.88rem", color: "var(--ink)" }}>{stage.name}</strong>
                {stage.totalLabel ? (
                  <div className="muted" style={{ fontSize: "0.72rem", marginTop: 2 }}>
                    {stage.totalLabel}
                  </div>
                ) : null}
              </div>
              <Badge tone={stage.isWon ? "ok" : stage.isLost ? "danger" : "default"}>
                {stage.deals.length}
              </Badge>
            </div>

            {stage.deals.map((d) => (
              <div
                key={d.id}
                className={`pipeline-card${draggingId === d.id ? " pipeline-card-dragging" : ""}`}
                draggable={!pending}
                onDragStart={() => setDraggingId(d.id)}
                onDragEnd={() => {
                  setDraggingId(null);
                  setOverStageId(null);
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    gap: 6,
                    alignItems: "flex-start",
                  }}
                >
                  <Link href={`/${locale}/deals/${d.id}`}>
                    <strong style={{ color: "var(--ink)", fontSize: "0.9rem" }}>{d.title}</strong>
                  </Link>
                </div>
                <div
                  style={{
                    fontWeight: 700,
                    fontSize: "0.88rem",
                    color: "var(--brand)",
                    marginTop: 6,
                  }}
                >
                  {d.amountLabel}
                </div>
                <div className="muted" style={{ fontSize: "0.76rem", marginTop: 4 }}>
                  {d.customerName} · {d.ownerName}
                </div>
                <div className="muted" style={{ fontSize: "0.68rem", marginTop: 8, opacity: 0.75 }}>
                  {locale === "ka" ? "გადაიტანეთ სხვა ეტაპზე" : "Drag to another stage"}
                </div>
              </div>
            ))}
          </section>
        ))}
      </div>
    </div>
  );
}
