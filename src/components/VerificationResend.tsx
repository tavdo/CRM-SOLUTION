"use client";
import { useActionState } from "react";
import { resendVerificationAction } from "@/app/actions/auth";
import { Alert, Button } from "./ui";

export function VerificationResend({ locale }: { locale: string }) {
  const [state, action, pending] = useActionState(resendVerificationAction, null);
  const ka = locale === "ka";
  return <form action={action} style={{ display: "grid", gap: "1rem", marginTop: "1rem" }}>
    <input type="hidden" name="locale" value={locale} />
    {state?.ok && <Alert tone="ok">{ka ? "დადასტურების წერილი გაგზავნილია. შეამოწმე შემოსული წერილები და სპამის საქაღალდე." : "Verification email sent. Check your inbox and spam folder."}</Alert>}
    {state?.error && <Alert>{ka ? "წერილის გაგზავნა ვერ მოხერხდა. სცადე მოგვიანებით ან ხელახლა შედი ანგარიშში." : state.error}</Alert>}
    <Button type="submit" disabled={pending}>{ka ? "დადასტურების წერილის ხელახლა გაგზავნა" : "Resend verification email"}</Button>
  </form>;
}
