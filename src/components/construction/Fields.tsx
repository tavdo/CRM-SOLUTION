"use client";

import { useId } from "react";
import { Field, Input } from "@/components/ui";

export function SiteField({ name, label, value = "", type = "text", required = true, step }: { name: string; label: string; value?: string; type?: string; required?: boolean; step?: string }) {
  const inputId = useId();
  return <Field label={label} htmlFor={inputId}><Input id={inputId} name={name} type={type} defaultValue={value} required={required} step={step} /></Field>;
}
export function SiteSelect({ name, label, value = "", options, optional = false }: { name: string; label: string; value?: string; options: { id: string; label: string }[]; optional?: boolean }) {
  const inputId = useId();
  return <Field label={label} htmlFor={inputId}><select className="select" id={inputId} name={name} defaultValue={value} required={!optional}>{optional ? <option value="">—</option> : null}{options.map((option) => <option value={option.id} key={option.id}>{option.label}</option>)}</select></Field>;
}
