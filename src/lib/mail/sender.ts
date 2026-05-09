import { Resend } from "resend";
import { render } from "@react-email/render";
import { env } from "@/lib/env";
import VerificationEmail from "@/emails/VerificationEmail";
import ApplicationApprovedEmail from "@/emails/ApplicationApprovedEmail";
import ApplicationRejectedEmail from "@/emails/ApplicationRejectedEmail";
import RegistrationStatusEmail from "@/emails/RegistrationStatusEmail";
import EventReminderEmail from "@/emails/EventReminderEmail";
import ContactRequestEmail from "@/emails/ContactRequestEmail";
import type { ReactElement } from "react";

let resend: Resend | null = null;
function getResend() {
  if (!env.email.resendKey) return null;
  if (!resend) resend = new Resend(env.email.resendKey);
  return resend;
}

async function send(params: {
  to: string;
  subject: string;
  react: ReactElement;
}) {
  const html = await render(params.react);
  const text = await render(params.react, { plainText: true });

  const r = getResend();
  if (r) {
    await r.emails.send({
      from: env.email.from,
      to: params.to,
      subject: params.subject,
      html,
      text,
    });
    return;
  }

  // Dev fallback: log to console
  console.log("\n──── Email (dev console) ────");
  console.log(`To:      ${params.to}`);
  console.log(`From:    ${env.email.from}`);
  console.log(`Subject: ${params.subject}`);
  console.log(`Text:\n${text}`);
  console.log("─────────────────────────────\n");
}

export async function sendVerificationEmail(args: { to: string; url: string }) {
  return send({
    to: args.to,
    subject: `登录 ${env.app.name}`,
    react: VerificationEmail({ url: args.url, appName: env.app.name }),
  });
}

export async function sendApplicationApprovedEmail(args: { to: string; appName?: string }) {
  return send({
    to: args.to,
    subject: `${env.app.name} 入站申请已通过`,
    react: ApplicationApprovedEmail({ appName: env.app.name }),
  });
}

export async function sendApplicationRejectedEmail(args: { to: string; note?: string }) {
  return send({
    to: args.to,
    subject: `${env.app.name} 入站申请回复`,
    react: ApplicationRejectedEmail({ appName: env.app.name, note: args.note }),
  });
}

export async function sendRegistrationStatusEmail(args: {
  to: string;
  eventTitle: string;
  eventUrl: string;
  status: "CONFIRMED" | "WAITLIST" | "DECLINED" | "PENDING";
}) {
  return send({
    to: args.to,
    subject: `「${args.eventTitle}」报名状态更新`,
    react: RegistrationStatusEmail({
      eventTitle: args.eventTitle,
      eventUrl: args.eventUrl,
      status: args.status,
      appName: env.app.name,
    }),
  });
}

export async function sendEventReminderEmail(args: {
  to: string;
  eventTitle: string;
  eventUrl: string;
  startAt: Date;
}) {
  return send({
    to: args.to,
    subject: `提醒：「${args.eventTitle}」即将开始`,
    react: EventReminderEmail({
      eventTitle: args.eventTitle,
      eventUrl: args.eventUrl,
      startAt: args.startAt,
      appName: env.app.name,
    }),
  });
}

export async function sendContactRequestEmail(args: {
  to: string;
  requesterName: string;
  reason: string;
  url: string;
}) {
  return send({
    to: args.to,
    subject: `${args.requesterName} 申请查看你的联系方式`,
    react: ContactRequestEmail({
      requesterName: args.requesterName,
      reason: args.reason,
      url: args.url,
      appName: env.app.name,
    }),
  });
}
