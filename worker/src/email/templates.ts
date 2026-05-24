// Email HTML templates for the Worker.
// These are plain HTML strings — no React needed in the Worker environment.

export interface TemplateVars {
  appName: string;
}

function tierLabel(tier?: string): string {
  switch ((tier ?? "").toUpperCase()) {
    case "ADMIN":
      return "ADMIN";
    case "TRUSTED":
      return "TRUSTED";
    case "VERIFIED":
      return "VERIFIED";
    case "UNVERIFIED":
      return "UNVERIFIED";
    default:
      return "UNVERIFIED";
  }
}

function tierHtml(tier?: string): string {
  return `<p style="font-size:13px;color:#666;">当前账号等级：<strong>${tierLabel(tier)}</strong></p>`;
}

function tierText(tier?: string): string {
  return `当前账号等级：${tierLabel(tier)}`;
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
  qrSvg?: string;
  userTier?: string;
}): { html: string; text: string } {
  const prettySecret = params.secret.replace(/(.{4})/g, "$1 ").trim();
  const qrSection = params.qrSvg
    ? `<p><strong>扫码快速添加（推荐）</strong></p>
<div style="display:flex;justify-content:center;margin:8px 0 16px;padding:12px;background:#fff;border:1px solid #eee;border-radius:8px;">${params.qrSvg}</div>`
    : "";
  const html = baseLayout(
    params.appName,
    `<p>你好，</p>
<p>你的 <strong>${params.appName}</strong> 账号已配置完成。本平台不使用密码，<strong>认证器动态验证码（TOTP）是唯一的登录凭证</strong>，请按以下步骤完成设置。</p>
${tierHtml(params.userTier)}
<p><strong>第一步：安装认证器应用</strong></p>
<p>在手机上安装以下任意一款应用：</p>
<ul style="margin: 0 0 16px; padding-left: 20px; line-height: 1.9; font-size: 15px;">
  <li>Google Authenticator（iOS / Android）</li>
  <li>Microsoft Authenticator（iOS / Android）</li>
  <li>Aegis Authenticator（Android，开源推荐）</li>
  <li>任意支持 TOTP（RFC 6238）的认证器</li>
</ul>
<p><strong>第二步：添加账号</strong></p>
${qrSection}
<p>打开认证器应用，选择「添加账号」→「手动输入」，填写以下密钥：</p>
<p style="font-size: 18px; letter-spacing: 0.12em; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; background: #f6f6f6; padding: 12px 14px; border-radius: 8px;">${prettySecret}</p>
<p style="font-size: 13px; color: #666;">或者在认证器中粘贴以下链接手动导入：<br/><code style="font-size: 11px; word-break: break-all;">${params.otpauthUrl}</code></p>
<p><strong>第三步：登录</strong></p>
<p>设置完成后，打开 <strong>${params.appName}</strong>，输入邮箱和认证器应用上显示的 6 位数字即可登录。验证码每 30 秒刷新一次，请在过期前输入。</p>
<p style="color: #c0392b; font-size: 13px;">⚠️ 请妥善保存上方密钥。若手机丢失或认证器数据被清除，你将需要此密钥来恢复访问。</p>`,
  );
  const text = `你的 ${params.appName} 账号已配置完成。本平台不使用密码，认证器动态验证码（TOTP）是唯一的登录凭证，请按步骤完成设置。\n${tierText(params.userTier)}\n\n【第一步】安装认证器应用\n推荐：Google Authenticator、Microsoft Authenticator、Aegis（Android 开源）\n\n【第二步】在认证器中添加账号 → 手动输入密钥：\n${prettySecret}\n\n手动导入链接：${params.otpauthUrl}\n\n【第三步】登录\n打开 ${params.appName}，输入邮箱和认证器显示的 6 位数字即可登录。验证码每 30 秒刷新，请在过期前输入。\n\n⚠️ 请妥善保存密钥，丢失设备时需要它来恢复访问。`;
  return { html, text };
}

export function applicationApprovedEmailHtml(params: {
  appName: string;
  signInUrl: string;
  qrSvg?: string;
  userTier?: string;
}): { html: string; text: string } {
  const qrSection = params.qrSvg
    ? `<p>你也可以扫码快速打开登录页面：</p>
<div style="display:flex;justify-content:center;margin:8px 0 16px;padding:12px;background:#fff;border:1px solid #eee;border-radius:8px;">${params.qrSvg}</div>`
    : "";
  const html = baseLayout(
    params.appName,
    `<p>你好，</p>
<p>恭喜！你在 <strong>${params.appName}</strong> 的入站申请已通过审核。</p>
<p>现在你可以使用申请时填写的邮箱登录，探索社群活动了。</p>
${tierHtml(params.userTier)}
<a href="${params.signInUrl}" class="btn">前往登录</a>
${qrSection}`,
  );
  const text = `你在 ${params.appName} 的入站申请已通过审核。请使用申请邮箱登录：${params.signInUrl}\n${tierText(params.userTier)}`;
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
  qrSvg?: string;
  userTier?: string;
}): { html: string; text: string } {
  const label = REG_STATUS_LABEL[params.status] ?? params.status;
  const qrSection = params.qrSvg
    ? `<p>扫码查看活动详情：</p>
<div style="display:flex;justify-content:center;margin:8px 0 16px;padding:12px;background:#fff;border:1px solid #eee;border-radius:8px;">${params.qrSvg}</div>`
    : "";
  const html = baseLayout(
    params.appName,
    `<p>你好，</p>
<p>你在活动「<strong>${params.eventTitle}</strong>」的报名状态已更新为：<strong>${label}</strong>。</p>
${tierHtml(params.userTier)}
<a href="${params.eventUrl}" class="btn">查看活动详情</a>
${qrSection}`,
  );
  const text = `你在「${params.eventTitle}」的报名状态：${label}\n${tierText(params.userTier)}\n查看详情：${params.eventUrl}`;
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

export function welcomeEmailHtml(params: {
  appName: string;
  signInUrl: string;
  secret: string;
  otpauthUrl: string;
  initialPassword: string;
  qrSvg?: string;
  userTier?: string;
}): { html: string; text: string } {
  const prettySecret = params.secret.replace(/(.{4})/g, "$1 ").trim();
  const qrSection = params.qrSvg
    ? `<div style="display:flex;justify-content:center;margin:8px 0 16px;padding:12px;background:#fff;border:1px solid #eee;border-radius:8px;">${params.qrSvg}</div>`
    : "";
  const html = baseLayout(
    params.appName,
    `<p>你好，欢迎加入 <strong>${params.appName}</strong>！</p>
${tierHtml(params.userTier)}
<hr style="border:none;border-top:1px solid #eee;margin:20px 0;"/>

<h3 style="margin:0 0 12px;font-size:16px;">🔑 初始密码</h3>
<p>你的初始登录密码如下，请登录后立即前往「账号设置 → 安全偏好」修改：</p>
<p style="font-size:18px;letter-spacing:0.1em;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;background:#f6f6f6;padding:12px 14px;border-radius:8px;user-select:all;">${params.initialPassword}</p>
<p><a href="${params.signInUrl}" class="btn">前往登录</a></p>

<hr style="border:none;border-top:1px solid #eee;margin:20px 0;"/>

<h3 style="margin:0 0 12px;font-size:16px;">📱 TOTP 认证器（推荐设置）</h3>
<p>你也可以使用认证器应用登录，或要求同时验证密码和 TOTP（更高安全性）。</p>
<p><strong>第一步：安装认证器</strong></p>
<p style="margin:0 0 8px;">推荐：Google Authenticator、Microsoft Authenticator、Aegis（Android 开源）</p>
<p><strong>第二步：添加账号</strong></p>
${qrSection}
<p>在认证器中选择「添加账号 → 手动输入密钥」：</p>
<p style="font-size:16px;letter-spacing:0.12em;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;background:#f6f6f6;padding:12px 14px;border-radius:8px;">${prettySecret}</p>
<p style="font-size:12px;color:#666;">或粘贴以下链接导入：<br/><code style="font-size:11px;word-break:break-all;">${params.otpauthUrl}</code></p>

<hr style="border:none;border-top:1px solid #eee;margin:20px 0;"/>

<h3 style="margin:0 0 12px;font-size:16px;">⚙️ 安全偏好设置</h3>
<p>登录后进入「账号设置 → 安全偏好」，可以：</p>
<ul style="margin:0 0 16px;padding-left:20px;line-height:1.9;font-size:15px;">
  <li>修改密码</li>
  <li>切换登录方式：仅密码 / 仅 TOTP / 密码或 TOTP（默认）/ 同时需要两者</li>
</ul>
<p style="color:#c0392b;font-size:13px;">⚠️ 请妥善保存 TOTP 密钥，手机丢失时需要它来恢复访问。密码和 TOTP 不可同时停用。</p>`,
  );
  const text = `欢迎加入 ${params.appName}！\n${tierText(params.userTier)}\n\n【初始密码】\n${params.initialPassword}\n请登录后立即修改密码。\n登录地址：${params.signInUrl}\n\n【TOTP 认证器设置（推荐）】\n在认证器中手动输入密钥：${prettySecret}\n导入链接：${params.otpauthUrl}\n\n【安全偏好】\n登录后进入「账号设置 → 安全偏好」可修改密码和切换登录方式（仅密码 / 仅 TOTP / 任一 / 两者同时）。\n\n⚠️ 请妥善保存 TOTP 密钥，丢失设备时需要它来恢复访问。`;
  return { html, text };
}

export function passwordResetEmailHtml(params: {
  appName: string;
  signInUrl: string;
  newPassword: string;
}): { html: string; text: string } {
  const html = baseLayout(
    params.appName,
    `<p>你好，</p>
<p>你的 <strong>${params.appName}</strong> 账号密码已重置。新密码如下，请登录后立即修改：</p>
<p style="font-size:18px;letter-spacing:0.1em;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;background:#f6f6f6;padding:12px 14px;border-radius:8px;user-select:all;">${params.newPassword}</p>
<p><a href="${params.signInUrl}" class="btn">前往登录</a></p>
<p style="font-size:13px;color:#666;">如果你没有申请重置密码，请立即联系管理员。</p>`,
  );
  const text = `你的 ${params.appName} 账号密码已重置。新密码：${params.newPassword}\n登录后请立即修改。\n登录地址：${params.signInUrl}\n\n如未申请，请联系管理员。`;
  return { html, text };
}

export function moderationStatusEmailHtml(params: {
  appName: string;
  title: string;
  url: string;
  status: "PENDING_REVIEW" | "REJECTED";
  targetKind: "POST" | "EVENT";
  reason?: string;
}): { html: string; text: string } {
  const targetLabel = params.targetKind === "EVENT" ? "活动" : "帖子";
  const heading =
    params.status === "REJECTED"
      ? `你发布的${targetLabel}未通过社群审核`
      : `你发布的${targetLabel}已转人工复核`;
  const detail =
    params.status === "REJECTED"
      ? `内容暂时不会出现在公开列表中。你可以编辑后重新发布,或前往个人通知查看更多。`
      : `内容将仅你和管理员可见,管理员复核通过后会自动公开。`;
  const reasonBlock = params.reason
    ? `<p style="font-size:13px;color:#555;background:#fafafa;padding:12px 14px;border-radius:8px;border-left:3px solid #F7A8B8;"><strong>原因:</strong> ${params.reason}</p>`
    : "";

  const html = baseLayout(
    params.appName,
    `<p>${heading}</p>
<p style="font-size:15px;"><strong>${params.title}</strong></p>
${reasonBlock}
<p>${detail}</p>
<p><a href="${params.url}" class="btn">查看详情</a></p>`,
  );
  const text = `${heading}\n\n${params.title}\n${params.reason ? `原因: ${params.reason}\n` : ""}\n${detail}\n查看: ${params.url}`;
  return { html, text };
}

