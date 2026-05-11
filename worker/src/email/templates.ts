// Email HTML templates for the Worker.
// These are plain HTML strings — no React needed in the Worker environment.

export interface TemplateVars {
  appName: string;
}

function baseLayout(appName: string, content: string): string {
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${appName}</title>
<style>
  body { margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f5f5f5; color: #1a1a1a; }
  .wrapper { max-width: 560px; margin: 40px auto; background: #fff; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.08); }
  .header { background: linear-gradient(135deg, #55CDFC 0%, #F7A8B8 50%, #FFFFFF 100%); padding: 32px 40px; }
  .header h1 { margin: 0; font-size: 22px; font-weight: 700; color: #fff; text-shadow: 0 1px 2px rgba(0,0,0,0.15); }
  .body { padding: 32px 40px; }
  .body p { margin: 0 0 16px; line-height: 1.7; font-size: 15px; }
  .btn { display: inline-block; padding: 12px 28px; background: #F7A8B8; color: #fff !important; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 15px; margin: 16px 0; }
  .footer { padding: 20px 40px; background: #fafafa; border-top: 1px solid #eee; font-size: 12px; color: #888; }
  .footer p { margin: 0; }
</style>
</head>
<body>
<div class="wrapper">
  <div class="header"><h1>${appName}</h1></div>
  <div class="body">${content}</div>
  <div class="footer"><p>此邮件由系统自动发送，请勿回复。</p></div>
</div>
</body>
</html>`;
}

export function verificationEmailHtml(params: {
  url: string;
  appName: string;
}): { html: string; text: string } {
  const html = baseLayout(
    params.appName,
    `<p>你好，</p>
<p>请点击下方按钮完成登录。链接有效期为 30 分钟。</p>
<a href="${params.url}" class="btn">登录 ${params.appName}</a>
<p>如果你没有请求此链接，请忽略此邮件。</p>`,
  );
  const text = `登录 ${params.appName}\n\n请访问以下链接完成登录（有效期 30 分钟）：\n${params.url}\n\n如未请求，请忽略此邮件。`;
  return { html, text };
}

export function totpSetupEmailHtml(params: {
  appName: string;
  secret: string;
  qrAscii: string;
  otpauthUrl: string;
}): { html: string; text: string } {
  const escapedAscii = params.qrAscii
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  const html = baseLayout(
    params.appName,
    `<p>你好，</p>
<p>请使用认证器应用（例如 Google Authenticator / Microsoft Authenticator）扫描二维码并保存密钥。</p>
<pre style="font-size: 8px; line-height: 1; background: #111; color: #f7f7f7; padding: 12px; border-radius: 8px; overflow-x: auto;">${escapedAscii}</pre>
<p>密钥：<code style="font-size: 14px;">${params.secret}</code></p>
<p>如果无法扫码，可手动添加并填写上述密钥。</p>`,
  );
  const text = `你的 ${params.appName} TOTP 初始化信息：\n\n${params.qrAscii}\n\n密钥：${params.secret}\n\n如需手动导入，可使用 otpauth URL：\n${params.otpauthUrl}`;
  return { html, text };
}

export function applicationApprovedEmailHtml(params: {
  appName: string;
}): { html: string; text: string } {
  const html = baseLayout(
    params.appName,
    `<p>你好，</p>
<p>恭喜！你在 <strong>${params.appName}</strong> 的入站申请已通过审核。</p>
<p>现在你可以使用申请时填写的邮箱登录，探索社群活动了。</p>`,
  );
  const text = `你在 ${params.appName} 的入站申请已通过审核。请使用申请邮箱登录。`;
  return { html, text };
}

export function applicationRejectedEmailHtml(params: {
  appName: string;
  note?: string;
}): { html: string; text: string } {
  const noteHtml = params.note
    ? `<p>审核留言：${params.note}</p>`
    : "";
  const html = baseLayout(
    params.appName,
    `<p>你好，</p>
<p>很遗憾，你在 <strong>${params.appName}</strong> 的入站申请未能通过。</p>
${noteHtml}
<p>如有疑问请通过其他渠道联系我们。</p>`,
  );
  const text = `你在 ${params.appName} 的入站申请未能通过。${params.note ? `\n留言：${params.note}` : ""}`;
  return { html, text };
}

type RegStatus = "CONFIRMED" | "WAITLIST" | "DECLINED" | "PENDING";

const REG_STATUS_LABEL: Record<RegStatus, string> = {
  CONFIRMED: "已确认",
  WAITLIST: "候补等待",
  DECLINED: "未通过",
  PENDING: "待审核",
};

export function registrationStatusEmailHtml(params: {
  eventTitle: string;
  eventUrl: string;
  status: RegStatus;
  appName: string;
}): { html: string; text: string } {
  const label = REG_STATUS_LABEL[params.status] ?? params.status;
  const html = baseLayout(
    params.appName,
    `<p>你好，</p>
<p>你在活动「<strong>${params.eventTitle}</strong>」的报名状态已更新为：<strong>${label}</strong>。</p>
<a href="${params.eventUrl}" class="btn">查看活动详情</a>`,
  );
  const text = `你在「${params.eventTitle}」的报名状态：${label}\n查看详情：${params.eventUrl}`;
  return { html, text };
}

export function eventReminderEmailHtml(params: {
  eventTitle: string;
  eventUrl: string;
  startAt: string;
  appName: string;
}): { html: string; text: string } {
  const html = baseLayout(
    params.appName,
    `<p>你好，</p>
<p>提醒：你报名的活动「<strong>${params.eventTitle}</strong>」将于 <strong>${params.startAt}</strong> 开始。</p>
<a href="${params.eventUrl}" class="btn">查看活动详情</a>`,
  );
  const text = `提醒：「${params.eventTitle}」将于 ${params.startAt} 开始。\n${params.eventUrl}`;
  return { html, text };
}

export function contactRequestEmailHtml(params: {
  requesterName: string;
  reason: string;
  url: string;
  appName: string;
}): { html: string; text: string } {
  const html = baseLayout(
    params.appName,
    `<p>你好，</p>
<p><strong>${params.requesterName}</strong> 申请查看你的联系方式。</p>
<p>申请理由：${params.reason}</p>
<a href="${params.url}" class="btn">查看并处理请求</a>`,
  );
  const text = `${params.requesterName} 申请查看你的联系方式。\n理由：${params.reason}\n处理：${params.url}`;
  return { html, text };
}
