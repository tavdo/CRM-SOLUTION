import nodemailer from "nodemailer";

export type MailMessage = {
  to: string;
  subject: string;
  text: string;
  html?: string;
};

export async function sendMail(message: MailMessage): Promise<void> {
  const transport = process.env.EMAIL_TRANSPORT ?? "console";
  const from = process.env.SMTP_FROM ?? "CRM Solution <noreply@localhost>";

  if (transport === "console" || !process.env.SMTP_HOST) {
    console.info("\n========== DEV EMAIL ==========");
    console.info(`From: ${from}`);
    console.info(`To: ${message.to}`);
    console.info(`Subject: ${message.subject}`);
    console.info(message.text);
    console.info("================================\n");
    return;
  }

  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT ?? 587),
    secure: false,
    auth:
      process.env.SMTP_USER && process.env.SMTP_PASS
        ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
        : undefined,
  });

  await transporter.sendMail({
    from,
    to: message.to,
    subject: message.subject,
    text: message.text,
    html: message.html,
  });
}
