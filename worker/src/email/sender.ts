// Email sender using Cloudflare Workers send_email binding.
// The SEND_EMAIL binding requires a "Workers Email" / Email Routing rule
// configured in the Cloudflare dashboard for the from address.

import type { SendEmail } from "@cloudflare/workers-types";
import { EmailMessage } from "cloudflare:email";
import { createMimeMessage } from "mimetext";
import { toString as toQrString } from "qrcode";
import {
  verificationEmailHtml,
  totpSetupEmailHtml,
  applicationApprovedEmailHtml,
  applicationRejectedEmailHtml,
  registrationStatusEmailHtml,
  eventReminderEmailHtml,
  contactRequestEmailHtml,
} from "@/email/templates";

type RegStatus = "CONFIRMED" | "WAITLIST" | "DECLINED" | "PENDING";

interface SendParams {
  sendEmail: SendEmail;
  from: string;
  appName: string;
}

async function send(
  binding: SendEmail,
  from: string,
  to: string,
  subject: string,
  html: string,
  text: string,
): Promise<void> {
  const msg = createMimeMessage();
  // Parse "Display Name <email>" or plain email
  const match = from.match(/^(.*?)\s*<(.+)>$/);
  if (match) {
    msg.setSender({ name: match[1]!.trim(), addr: match[2]!.trim() });
  } else {
    msg.setSender({ addr: from.trim() });
  }
  msg.setRecipient(to);
  msg.setSubject(subject);
  msg.addMessage({ contentType: "text/html", data: html });
  msg.addMessage({ contentType: "text/plain", data: text });

  // Extract from address for EmailMessage
  const fromAddr = match ? match[2]!.trim() : from.trim();

  const message = new EmailMessage(fromAddr, to, msg.asRaw());
  await binding.send(message);
}

export async function sendVerificationEmail(
  p: SendParams,
  args: { to: string; url: string },
): Promise<void> {
  const { html, text } = verificationEmailHtml({ url: args.url, appName: p.appName });
  await send(p.sendEmail, p.from, args.to, `登录 ${p.appName}`, html, text);
}

export async function sendTotpSetupEmail(
  p: SendParams,
  args: { to: string; secret: string; otpauthUrl: string },
): Promise<void> {
  const qrAscii = await toQrString(args.otpauthUrl, {
    type: "terminal",
    small: true,
  });
  const { html, text } = totpSetupEmailHtml({
    appName: p.appName,
    secret: args.secret,
    qrAscii,
    otpauthUrl: args.otpauthUrl,
  });
  await send(p.sendEmail, p.from, args.to, `${p.appName} TOTP 初始化`, html, text);
}

export async function sendApplicationApprovedEmail(
  p: SendParams,
  args: { to: string },
): Promise<void> {
  const { html, text } = applicationApprovedEmailHtml({ appName: p.appName });
  await send(
    p.sendEmail,
    p.from,
    args.to,
    `${p.appName} 入站申请已通过`,
    html,
    text,
  );
}

export async function sendApplicationRejectedEmail(
  p: SendParams,
  args: { to: string; note?: string },
): Promise<void> {
  const { html, text } = applicationRejectedEmailHtml({
    appName: p.appName,
    note: args.note,
  });
  await send(
    p.sendEmail,
    p.from,
    args.to,
    `${p.appName} 入站申请回复`,
    html,
    text,
  );
}

export async function sendRegistrationStatusEmail(
  p: SendParams,
  args: {
    to: string;
    eventTitle: string;
    eventUrl: string;
    status: RegStatus;
  },
): Promise<void> {
  const { html, text } = registrationStatusEmailHtml({
    eventTitle: args.eventTitle,
    eventUrl: args.eventUrl,
    status: args.status,
    appName: p.appName,
  });
  await send(
    p.sendEmail,
    p.from,
    args.to,
    `「${args.eventTitle}」报名状态更新`,
    html,
    text,
  );
}

export async function sendEventReminderEmail(
  p: SendParams,
  args: {
    to: string;
    eventTitle: string;
    eventUrl: string;
    startAt: string;
  },
): Promise<void> {
  const { html, text } = eventReminderEmailHtml({
    eventTitle: args.eventTitle,
    eventUrl: args.eventUrl,
    startAt: args.startAt,
    appName: p.appName,
  });
  await send(
    p.sendEmail,
    p.from,
    args.to,
    `提醒：「${args.eventTitle}」即将开始`,
    html,
    text,
  );
}

export async function sendContactRequestEmail(
  p: SendParams,
  args: {
    to: string;
    requesterName: string;
    reason: string;
    url: string;
  },
): Promise<void> {
  const { html, text } = contactRequestEmailHtml({
    requesterName: args.requesterName,
    reason: args.reason,
    url: args.url,
    appName: p.appName,
  });
  await send(
    p.sendEmail,
    p.from,
    args.to,
    `${args.requesterName} 申请查看你的联系方式`,
    html,
    text,
  );
}
