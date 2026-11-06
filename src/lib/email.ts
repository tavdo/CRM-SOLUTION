import nodemailer from "nodemailer";
import { requirePreviewEmail } from "./release-access";

export type MailMessage = {
  to: string;
  subject: string;
  text: string;
  html?: string;
};

export function mailConfiguration() {
  const transport = process.env.EMAIL_TRANSPORT ?? "console";
  const from = process.env.SMTP_FROM ?? "CRM Solution <noreply@localhost>";
  if (transport === "console") {
    if (process.env.NODE_ENV === "production" && process.env.DEPLOYMENT_MODE !== "demo") {
      throw new Error("Production email requires EMAIL_TRANSPORT=smtp");
    }
    return { transport, from } as const;
  }
  if (transport !== "smtp" || !process.env.SMTP_HOST) throw new Error("SMTP is not configured");
  const port = Number(process.env.SMTP_PORT || 587);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("Invalid SMTP port");
  if (process.env.NODE_ENV === "production" &&
      (!process.env.SMTP_FROM || /localhost|example\.(com|invalid)/i.test(from) || !process.env.SMTP_USER || !process.env.SMTP_PASS)) {
    throw new Error("Production SMTP sender and credentials are required");
  }
  return { transport, from, options: {
    host: process.env.SMTP_HOST, port,
    secure: port === 465,
    requireTLS: true,
    disableFileAccess: true,
    disableUrlAccess: true,
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 20000,
    auth: process.env.SMTP_USER && process.env.SMTP_PASS ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
  } } as const;
}

export async function sendMail(message: MailMessage): Promise<void> {
  requirePreviewEmail(message.to);
  const config = mailConfiguration();
  if (config.transport === "console") {
    console.info("\n========== DEV EMAIL ==========");
    console.info(`From: ${config.from}`);
    console.info(`To: ${message.to}`);
    console.info(`Subject: ${message.subject}`);
    console.info(message.text);
    console.info("================================\n");
    return;
  }

  const transporter = nodemailer.createTransport(config.options);

  await transporter.sendMail({
    from: config.from,
    to: message.to,
    subject: message.subject,
    text: message.text,
    html: message.html,
  });
}
