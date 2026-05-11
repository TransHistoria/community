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
  otpauthUrl: string;
}): { html: string; text: string } {
  const prettySecret = params.secret.replace(/(.{4})/g, "$1 ").trim();
  const html = baseLayout(
    params.appName,
    `<p>你好，</p>
<p>你的账号已开启两步验证（TOTP）。每次登录时除邮箱外，还需要输入认证器应用生成的 6 位动态验证码。</p>
<p><strong>第一步：安装认证器应用</strong></p>
<p>在手机上安装以下任意一款应用：</p>
<ul style="margin: 0 0 16px; padding-left: 20px; line-height: 1.9; font-size: 15px;">
  <li>Google Authenticator（iOS / Android）</li>
  <li>Microsoft Authenticator（iOS / Android）</li>
  <li>Aegis Authenticator（Android，开源推荐）</li>
  <li>任意支持 TOTP（RFC 6238）的认证器</li>
</ul>
<p><strong>第二步：添加账号</strong></p>
<p>打开认证器应用，选择「添加账号」→「手动输入」，填写以下密钥：</p>
<p style="font-size: 18px; letter-spacing: 0.12em; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; background: #f6f6f6; padding: 12px 14px; border-radius: 8px;">${prettySecret}</p>
<p style="font-size: 13px; color: #666;">或者在认证器中粘贴以下链接手动导入：<br/><code style="font-size: 11px; word-break: break-all;">${params.otpauthUrl}</code></p>
<p><strong>第三步：登录时使用验证码</strong></p>
<p>设置完成后，每次登录时在「验证码」栏输入认证器应用上显示的 6 位数字即可。验证码每 30 秒刷新一次，请在过期前输入。</p>
<p style="color: #c0392b; font-size: 13px;">⚠️ 请妥善保存上方密钥。若手机丢失或认证器数据被清除，你将需要此密钥来恢复访问。</p>`,
  );
  const text = `你的账号已开启两步验证（TOTP）。\n\n【第一步】安装认证器应用\n推荐：Google Authenticator、Microsoft Authenticator、Aegis（Android 开源）\n\n【第二步】在认证器中添加账号 → 手动输入密钥：\n${prettySecret}\n\n手动导入链接：${params.otpauthUrl}\n\n【第三步】登录时输入 6 位验证码\n验证码每 30 秒刷新，请在过期前输入。\n\n⚠️ 请妥善保存密钥，丢失设备时需要它来恢复访问。`;
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
