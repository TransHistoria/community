// Email sender using Cloudflare Workers send_email binding.
// The SEND_EMAIL binding requires a "Workers Email" / Email Routing rule
// configured in the Cloudflare dashboard for the from address.

import type { SendEmail } from "@cloudflare/workers-types";
import { EmailMessage } from "cloudflare:email";
import { createMimeMessage } from "mimetext";
import QRCode from "qrcode";
import {
  verificationEmailHtml,
  totpSetupEmailHtml,
  applicationApprovedEmailHtml,
  applicationRejectedEmailHtml,
  registrationStatusEmailHtml,
  eventReminderEmailHtml,
  contactRequestEmailHtml,
  welcomeEmailHtml,
  passwordResetEmailHtml,
  moderationStatusEmailHtml,
} from "@/email/templates";

type RegStatus = "CONFIRMED" | "WAITLIST" | "DECLINED" | "PENDING";

interface SendParams {
  sendEmail: SendEmail;
  from: string;
  appName: string;
}

async function generateQrSvg(data: string): Promise<string | undefined> {
  try {
    return await QRCode.toString(data, {
      type: "svg",
      width: 180,
      margin: 1,
      errorCorrectionLevel: "M",
    });
  } catch (err) {
    console.error("Failed to generate QR SVG:", err);
    return undefined;
  }
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
  args: { to: string; secret: string; otpauthUrl: string; userTier?: string },
): Promise<void> {
  const qrSvg = await generateQrSvg(args.otpauthUrl);
  const { html, text } = totpSetupEmailHtml({
    appName: p.appName,
    secret: args.secret,
    otpauthUrl: args.otpauthUrl,
    qrSvg,
    userTier: args.userTier,
  });
  await send(p.sendEmail, p.from, args.to, `${p.appName} TOTP 初始化`, html, text);
}

export async function sendApplicationApprovedEmail(
  p: SendParams,
  args: { to: string; signInUrl: string; userTier?: string },
): Promise<void> {
  const qrSvg = await generateQrSvg(args.signInUrl);
  const { html, text } = applicationApprovedEmailHtml({
    appName: p.appName,
    signInUrl: args.signInUrl,
    qrSvg,
    userTier: args.userTier,
  });
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
    userTier?: string;
  },
): Promise<void> {
  const qrSvg = await generateQrSvg(args.eventUrl);
  const { html, text } = registrationStatusEmailHtml({
    eventTitle: args.eventTitle,
    eventUrl: args.eventUrl,
    status: args.status,
    appName: p.appName,
    qrSvg,
    userTier: args.userTier,
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

export async function sendTestEmail(
  p: SendParams,
  args: { to: string },
): Promise<void> {
  const now = new Date().toLocaleString("zh-CN", { timeZone: "Asia/Shanghai" });
  const html = `<!DOCTYPE html><html lang="zh-CN"><head><meta charset="UTF-8"/></head><body style="font-family:sans-serif;background:#f5f5f5;padding:40px 0"><div style="max-width:480px;margin:0 auto;background:#fff;border-radius:12px;padding:32px 40px;box-shadow:0 2px 8px rgba(0,0,0,0.08)"><h2 style="margin:0 0 16px;color:#55CDFC">📧 测试邮件</h2><p style="color:#555;line-height:1.7">这是一封来自 <strong>${p.appName}</strong> 的测试邮件。<br/>如果你收到此邮件，说明邮件服务配置正常。</p><p style="color:#999;font-size:13px">发送时间：${now}</p></div></body></html>`;
  const text = `测试邮件 — ${p.appName}\n\n这是一封测试邮件。如果你收到此邮件，说明邮件服务配置正常。\n发送时间：${now}`;
  await send(p.sendEmail, p.from, args.to, `${p.appName} 邮件服务测试`, html, text);
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

export async function sendWelcomeEmail(
  p: SendParams,
  args: {
    to: string;
    signInUrl: string;
    secret: string;
    otpauthUrl: string;
    initialPassword: string;
    userTier?: string;
  },
): Promise<void> {
  const qrSvg = await generateQrSvg(args.otpauthUrl);
  const { html, text } = welcomeEmailHtml({
    appName: p.appName,
    signInUrl: args.signInUrl,
    secret: args.secret,
    otpauthUrl: args.otpauthUrl,
    initialPassword: args.initialPassword,
    qrSvg,
    userTier: args.userTier,
  });
  await send(p.sendEmail, p.from, args.to, `欢迎加入 ${p.appName}`, html, text);
}

export async function sendPasswordResetEmail(
  p: SendParams,
  args: { to: string; signInUrl: string; newPassword: string },
): Promise<void> {
  const { html, text } = passwordResetEmailHtml({
    appName: p.appName,
    signInUrl: args.signInUrl,
    newPassword: args.newPassword,
  });
  await send(p.sendEmail, p.from, args.to, `${p.appName} 密码已重置`, html, text);
}

export async function sendModerationStatusEmail(
  p: SendParams,
  args: {
    to: string;
    title: string;
    url: string;
    status: "PENDING_REVIEW" | "REJECTED";
    targetKind: "POST" | "EVENT";
    reason?: string;
  },
): Promise<void> {
  const { html, text } = moderationStatusEmailHtml({
    appName: p.appName,
    title: args.title,
    url: args.url,
    status: args.status,
    targetKind: args.targetKind,
    reason: args.reason,
  });
  const subject =
    args.status === "REJECTED"
      ? `「${args.title}」未能通过社群审核`
      : `「${args.title}」已转人工复核`;
  await send(p.sendEmail, p.from, args.to, subject, html, text);
}
