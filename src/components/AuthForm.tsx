"use client";

import { useActionState } from "react";
import { Alert, Button, Field, Input, Select } from "./ui";

type ActionState = { error?: string; ok?: boolean } | null;

export function AuthForm({
  action,
  locale,
  mode,
  labels,
  next,
  token,
}: {
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  locale: string;
  mode: "sign-in" | "sign-up" | "forgot" | "reset" | "invite";
  labels: Record<string, string>;
  next?: string;
  token?: string;
}) {
  const [state, formAction, pending] = useActionState(action, null);

  return (
    <form action={formAction} style={{ display: "grid", gap: "0.9rem" }}>
      <input type="hidden" name="locale" value={locale} />
      {next ? <input type="hidden" name="next" value={next} /> : null}
      {token ? <input type="hidden" name="token" value={token} /> : null}

      {state?.error ? <Alert>{state.error}</Alert> : null}
      {state?.ok ? <Alert tone="ok">{labels.resetSent ?? "OK"}</Alert> : null}

      {mode === "sign-up" ? (
        <>
          <Field label={labels.companyName} htmlFor="companyName">
            <Input id="companyName" name="companyName" required autoComplete="organization" />
          </Field>
          <Field label={labels.name} htmlFor="adminName">
            <Input id="adminName" name="adminName" required autoComplete="name" />
          </Field>
        </>
      ) : null}

      {mode === "invite" ? (
        <Field label={labels.name} htmlFor="name">
          <Input id="name" name="name" required autoComplete="name" />
        </Field>
      ) : null}

      {mode !== "reset" && mode !== "invite" ? (
        <Field label={labels.email} htmlFor="email">
          <Input id="email" name="email" type="email" required autoComplete="email" />
        </Field>
      ) : null}

      {mode === "sign-in" || mode === "sign-up" || mode === "reset" || mode === "invite" ? (
        <Field label={mode === "reset" ? labels.newPassword : labels.password} htmlFor="password">
          <Input
            id="password"
            name="password"
            type="password"
            required
            minLength={8}
            autoComplete={mode === "sign-in" ? "current-password" : "new-password"}
          />
        </Field>
      ) : null}

      {(mode === "sign-up" || mode === "invite") && (
        <Field label={labels.language} htmlFor="localeSelect">
          <Select id="localeSelect" name="locale" defaultValue={locale}>
            <option value="en">English</option>
            <option value="ka">ქართული</option>
          </Select>
        </Field>
      )}

      <Button type="submit" disabled={pending}>
        {pending ? "…" : submitLabel(mode, labels)}
      </Button>
    </form>
  );
}

function submitLabel(mode: string, labels: Record<string, string>) {
  switch (mode) {
    case "sign-in":
      return labels.signIn;
    case "sign-up":
      return labels.signUp;
    case "forgot":
      return labels.sendReset;
    case "reset":
      return labels.resetPassword;
    case "invite":
      return labels.acceptInvite;
    default:
      return "OK";
  }
}
