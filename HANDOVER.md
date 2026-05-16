# TransHistoria/community — 交接与代码审阅报告

> 私域 · 邀请制 · 隐私可控的跨性别社群活动平台
> 审阅日期：2026-05-16
> 审阅范围：项目结构、前端、Worker API、D1 migrations、测试/CI、部署配置、现有 README/HANDOVER 准确性

---

## 0. 结论先读

当前项目是一个**静态导出的 Next.js 前端 + Cloudflare Workers/Hono 后端 + D1 数据库**的 MVP。核心产品面向跨性别社群活动：邀请/申请准入、分级访问、活动报名、联系方式分级可见、举报/屏蔽、管理后台。

这次审阅最大的发现是：项目已经从早期 **Next.js 14 + Auth.js/Prisma/SQLite** 叙述演进到 **Next.js 15 static export + Worker/D1**，但文档仍大量停留在旧架构。README 与本交接文档已经重写为当前主路径。

### 当前健康度

| 维度 | 状态 | 说明 |
|---|---|---|
| 前端类型检查 | ✅ 通过 | `pnpm typecheck` 通过 |
| Worker 类型检查 | ✅ 通过 | `pnpm typecheck:worker` 通过 |
| Lint | ⚠️ 通过但有警告 | `next lint` 已弃用；2 条 hook dependency warning |
| Frontend build | ⚠️ 环境受限失败 | `next/font/google` 拉取 Google Fonts 失败 |
| Vitest | ❌ 配置不匹配 | `worker/test/api.test.mjs` 是 Node harness，不是 Vitest suite |
| 文档准确性 | ✅ 本次已更新 | README/HANDOVER 已按 Worker/D1 主路径改写 |
| 安全关键流 | ⚠️ 有缺口 | 邀请码预校验与实际账号创建/提权未闭环 |

---

## 1. 当前架构理解

### 1.1 运行时拓扑

```text
Browser
  └─ static Next.js app (GitHub Pages / static hosting)
       ├─ AuthContext reads/writes localStorage tc_token
       ├─ src/lib/api.ts adds Authorization: Bearer <JWT>
       └─ fetch NEXT_PUBLIC_API_URL / fallback / legacy host
            ↓
Cloudflare Worker (Hono)
  ├─ /api/auth
  ├─ /api/activities and /api/events compatibility alias
  ├─ /api/users
  ├─ /api/applications
  ├─ /api/admin
  ├─ /api/reports
  ├─ /api/notifications
  └─ /api/files
       ↓
Cloudflare D1 (DB), R2 (FILES), Workers Email (SEND_EMAIL)
```

### 1.2 为什么前端路由看起来特殊

`next.config.mjs` 使用 `output: "export"`，所以前端不能依赖动态服务端路由。项目通过 `src/lib/query-routing.ts` 把内部路径编码到首页 query 中，例如：

- 逻辑路径：`/events/new`
- 静态托管链接：`/?events/new`

各页面再用 `useSearchParams()` 解析 query-route，并在客户端渲染相应页面。这是 GitHub Pages 单入口静态站点的兼容方案。

### 1.3 当前事实 schema

后端事实 schema 是 `worker/migrations/*.sql`，不是 `prisma/schema.prisma`。D1 表包括：

- `users`
- `magic_tokens`
- `invite_codes`
- `applications`
- `events`
- `registrations`
- `comments`
- `contact_methods`
- `contact_requests`
- `reports`
- `blocks`
- `notifications`
- `audit_logs`

后续迁移应优先新增 `worker/migrations/000x_*.sql`，除非明确决定恢复 Prisma 主路径。

---

## 2. 关键目录与职责

```text
src/
├─ app/
│  ├─ (marketing)/        # 首页、关于页；公开但 noindex
│  ├─ (auth)/             # sign-in/sign-up/apply/verify；调用 Worker auth/applications API
│  ├─ (app)/              # 活动、个人中心、用户主页、通知；客户端鉴权与 query-route
│  └─ admin/              # 管理后台；客户端检查 ADMIN，Worker API 再强制权限
├─ components/
│  ├─ layout/             # TopBar/AppShell/Footer/MobileNav/UserMenu
│  ├─ ui/                 # Button/Card/Dialog/Input/Tabs/Toast 等基础组件
│  ├─ event/              # EventCard/EventForm/Share*
│  ├─ user/               # ProfileMarkdown/TierBadge/contact config
│  ├─ moderation/         # ReportButton
│  └─ security/           # TurnstileWidget
├─ contexts/AuthContext.tsx
├─ lib/api.ts             # 前端唯一 API client 主入口
├─ lib/access/index.ts    # 前端权限谓词，镜像 Worker access 逻辑
├─ lib/query-routing.ts   # 静态导出路由适配
└─ styles/globals.css

worker/
├─ src/index.ts           # Hono app、CORS、debug instrumentation、route mounts
├─ src/routes/
│  ├─ auth.ts             # magic link/TOTP/password/security/change-email/invite precheck
│  ├─ events.ts           # 活动 CRUD、报名、评论
│  ├─ users.ts            # profile、contacts、contact requests、invites、blocks、export
│  ├─ applications.ts     # 申请提交/查询/审核
│  ├─ admin.ts            # users/reports/email/turnstile/audit
│  ├─ reports.ts          # 用户举报入口
│  ├─ notifications.ts    # 通知列表/mark-read
│  └─ files.ts            # R2 upload/read
├─ src/auth/              # jwt/magic/totp/password helpers
├─ src/lib/               # access/enums/turnstile/utils
├─ src/email/             # Workers Email sender + templates
├─ migrations/            # D1 migrations
└─ test/                  # seed.sql + api.test.mjs endpoint harness
```

---

## 3. 产品与权限模型

### 3.1 用户等级

| Tier | 典型来源 | 能力 |
|---|---|---|
| `GUEST` | 未登录访客 | 浏览公开活动概要/公开页面有限内容 |
| `UNVERIFIED` | 仅登录但未通过申请/邀请 | 查看本人状态，不能报名/评论/发活动 |
| `VERIFIED` | 申请通过或受邀后应成为认证成员 | 浏览认证活动、报名、评论、发活动、签发少量邀请 |
| `TRUSTED` | 管理员提级 | 浏览信任活动、更多邀请额度 |
| `ADMIN` | 管理员初始化/提级 | 全部管理能力 |

### 3.2 活动隐私

活动有两个层次的隐私：

1. `visibility` 决定谁能看到活动存在：`PUBLIC` / `VERIFIED` / `TRUSTED`。
2. 精确地址 `precise_addr` 和线上链接 `online_url` 只在以下情况返回/展示：组织者、ADMIN、报名 `CONFIRMED` 或 `CHECKED_IN`。

### 3.3 联系方式隐私

| 值 | 含义 | 可见范围 |
|---|---|---|
| `PUBLIC` | 公开联系方式 | 访客也可见 |
| `VERIFIED` | 默认值 | 认证成员及以上 |
| `TRUSTED` | 更严格 | 信任成员及管理员 |
| `HIDDEN_REQUEST` | 申请查看 | 本人同意后可见；本人和 ADMIN 例外 |

---

## 4. API 审阅

### 4.1 Hono app

`worker/src/index.ts` 做了：

- 全局 CORS：`origin: "*"`、不带 credentials。
- `DEBUG` 响应 instrumentation：开启后把 console 日志收集进 JSON response 的 `debug` 字段。
- `/api/health` 健康检查。
- 路由挂载：`/api/auth`、`/api/activities`、`/api/events` alias、`/api/users`、`/api/applications`、`/api/notifications`、`/api/admin`、`/api/reports`、`/api/files`。

### 4.2 Auth

主要端点：

- `POST /api/auth/send-link`
- `POST /api/auth/register-totp`
- `POST /api/auth/login-totp`
- `POST /api/auth/login-password`
- `POST /api/auth/reset-password`
- `PATCH /api/auth/security`
- `POST /api/auth/change-email`
- `POST /api/auth/verify`
- `POST /api/auth/verify-invite`
- `GET /api/auth/me`
- `POST /api/auth/sign-out`

当前会话是无状态 JWT，前端存 `localStorage.tc_token`，Worker 中间件只验证 Bearer token。

### 4.3 Events

主要端点：

- `GET /api/activities`
- `GET /api/activities/:slug`
- `POST /api/activities`
- `PATCH /api/activities/:id`
- `DELETE /api/activities/:id`
- `GET/POST /api/activities/:id/registrations`
- `PATCH/DELETE /api/activities/registrations/:regId`
- `GET/POST /api/activities/:id/comments`
- `PATCH /api/activities/comments/:commentId/hide`

### 4.4 Users

主要端点：

- `PATCH /api/users/me`
- `GET /api/users/:handle`
- `GET/POST/PATCH/DELETE /api/users/me/contacts`
- `GET/PATCH /api/users/me/contact-requests`
- `POST /api/users/:handle/contact-requests`
- `GET/POST /api/users/me/invites`
- `GET /api/users/me/blocks`
- `POST/DELETE /api/users/:handle/block`
- `GET /api/users/me/registrations`
- `GET /api/users/me/export`

### 4.5 Admin

主要端点：

- `GET/PATCH /api/admin/users`
- `POST /api/admin/users/:id/reinitialize`
- `PATCH /api/admin/users/:id/email`
- `GET/POST/PATCH /api/admin/reports`
- `POST /api/admin/test-email`
- `POST /api/admin/test-turnstile`
- `GET /api/admin/audit`

---

## 5. 代码审阅发现

### P0 / 必须优先处理

#### 1) 邀请码准入没有形成闭环

**现象**：`POST /api/auth/verify-invite` 只验证邀请码存在、次数未满、未过期，并写入发行者的一条 `INVITE_PRECHECK` notification。`POST /api/auth/verify` 创建新用户时只看 `ADMIN_EMAILS` 和 approved application，不读取 `INVITE_PRECHECK`，也不更新 `invite_codes.used_count`。

**影响**：

- 邀请码不会真正消费。
- 受邀邮箱通过 magic-link 登录后仍可能只是 `UNVERIFIED`。
- `used_count`/`max_uses` 无法发挥准入限制作用。
- 测试注释提到“后续 magic-link verify 才消费”，但实现未看到对应逻辑。

**建议**：新增明确的数据结构，如 `invite_claims(email, code, expires_at, consumed_at)`，或在 `magic_tokens` 表加 `invite_code`。`verify-invite` 创建 claim；`send-link`/`verify` 绑定并原子消费；成功创建用户时设置 `tier='VERIFIED'`、`invited_by_id`，并 `UPDATE invite_codes SET used_count = used_count + 1`。

#### 2) 当前测试入口误导

`package.json` 的 `test` 是 `vitest`，但 `worker/test/api.test.mjs` 是自行实现的 Node endpoint harness，没有 `describe/it/test`，所以 `pnpm exec vitest run` 会失败。CI 的正确做法是启动 wrangler dev 后运行 `node test/api.test.mjs`。

**建议**：二选一：

- 把 `pnpm test` 改为完整 Worker integration workflow 的脚本；或
- 把 endpoint harness 排除出 Vitest，并新增真正的 Vitest 单元测试。

### P1 / 高优先级

#### 3) 静态前端 build 依赖 Google Fonts 网络

根布局使用 `next/font/google` 加载 Inter 和 Source Serif 4。当前环境下 `pnpm frontend` 因无法拉取 Google Fonts 失败。

**建议**：把字体改为本地 vendored font（`next/font/local`），或在 CI/build 环境保证 Google Fonts 可访问并缓存。

#### 4) `next lint` 已弃用，且有 hook dependency warnings

`pnpm lint` 通过但输出：

- `src/app/(app)/events/[slug]/CommentSection.tsx`：`loadComments` 缺失依赖。
- `src/app/(app)/events/[slug]/manage/ManageEventPageClient.tsx`：`loadData` 缺失依赖。

**建议**：用 `useCallback` 包裹 loader 并加入依赖，或在明确不会变化时加局部 eslint 注释。中期按 Next 提示迁移到 ESLint CLI。

#### 5) 文件上传安全弱于产品承诺

当前 `worker/src/routes/files.ts` 只根据 `file.type` 判断扩展名，并限制 4MB，然后直接写入 R2；没有 magic-byte 校验、图片重压缩、EXIF 抹除或内容安全扫描。旧文档中“自动 EXIF 抹除 / magic-byte 校验”的说法不符合当前实现。

**建议**：至少读取文件头做签名校验；对 JPEG/PNG/WebP 做服务端重编码和 EXIF stripping；按用途拆分公开/私有 bucket 或增加访问控制。

#### 6) JWT 存在 localStorage，XSS 风险较高

这是静态站点常见折中，但一旦前端出现 XSS，token 会被直接读取。项目已使用 markdown sanitize，但仍需把所有用户输入链路都视为高风险。

**建议**：

- 继续禁止 `dangerouslySetInnerHTML`。
- 强化 CSP（如果静态托管平台支持 header 配置）。
- 缩短 JWT TTL，增加 refresh/rotation 或 token version。
- 高风险操作要求二次 TOTP/密码确认。

#### 7) DEBUG 响应 instrumentation 可能泄漏敏感信息

Worker `DEBUG` 开启后会把 console 输出和错误 stack 附到 response。生产环境如果误开，可能泄漏内部状态。

**建议**：生产环境不要设置 `DEBUG`；必要时只允许管理员或特定 header 使用，并过滤敏感字段。

#### 8) 根目录和 worker 子目录 wrangler 配置重复

`wrangler.jsonc` 与 `worker/wrangler.jsonc` 都存在，`main`、`migrations_dir`、`compatibility_date` 不一致。团队成员从不同工作目录部署可能得到不同结果。

**建议**：保留一个权威配置，另一个加注释或删除；CI/README 明确从哪个目录执行。

### P2 / 中优先级

#### 9) Prisma/NextAuth 时代文件仍保留，容易误导

`prisma/schema.prisma`、`prisma/seed.ts`、`scripts/create-admin.ts`、`scripts/issue-invite.ts`、`scripts/dev-session.ts` 都是 Prisma 主路径遗留。当前 Worker/D1 代码不依赖它们。

**建议**：

- 如果确定 Worker/D1 为唯一主路径：移动到 `legacy/` 或删除。
- 如果还要保留本地 Prisma 模拟：文档明确其用途，并补齐与 D1 schema 的同步策略。

#### 10) Worker 与前端 access 逻辑需要防漂移

`worker/src/lib/access.ts` 与 `src/lib/access/index.ts` 是手动镜像。长期迭代容易出现一端改了另一端没改。

**建议**：把纯 TS 权限谓词抽到共享 package，或至少加单元测试比较关键用例。

#### 11) slugify 实现有前后端差异

前端 `src/lib/utils.ts` 的 `slugify` 明确 ASCII-only 且非 ASCII fallback 到 `e-xxxx`；Worker `worker/src/lib/utils.ts` 注释写“保留中文”，但后续正则实际会删除中文，纯中文标题 fallback 到 `event` stem。当前创建活动走 Worker，所以不会出现中文 percent-encoding，但结果可能是 `event`/`event-xxxx`，与旧文档说法不同。

**建议**：统一 slugify 实现与注释，最好共享同一函数。

#### 12) CORS 完全开放符合静态前端需求，但应确认 threat model

当前 CORS `origin: "*"` 且 `credentials: false`。由于使用 Bearer token，不会自动带 cookie，CSRF 风险低；但任何站点都可以调用公开 API 并诱导用户粘贴 token。

**建议**：若 API 只服务固定前端域名，可限制 origin；若保留开放 API，则加强 rate-limit 和 abuse monitoring。

#### 13) 缺少明显的 rate limit 实现

旧交接文档提到举报/分享/联系方式申请限频，但当前审阅未看到通用 rate-limit 中间件。Cloudflare WAF/Turnstile 可覆盖部分入口，但业务限频最好在 API 层落库或 KV/Durable Object 实现。

### P3 / 可后续清理

- `pnpm` 版本：workflow 使用 pnpm 9，文档曾写 pnpm 10+，建议统一。
- `package.json` 中 `lint` 依赖 `next lint`，Next 16 前迁移。
- `README` 旧默认 API URL 曾写 `transcommunity.cyanmint.workers.dev`，实际代码 legacy fallback 是 `https://communityapi.transhistoria.org`。
- `verify-screenshots/` 很有价值，但建议注明对应 commit/日期与是否仍代表当前 UI。

---

## 6. 本次实际执行的检查

```text
pnpm typecheck
# PASS

pnpm typecheck:worker
# PASS

pnpm lint
# PASS with warnings:
# - next lint deprecated
# - CommentSection.tsx missing loadComments dependency
# - ManageEventPageClient.tsx missing loadData dependency

pnpm exec vitest run
# FAIL: worker/test/api.test.mjs has no Vitest suite

pnpm frontend
# FAIL in this environment: next/font/google could not fetch Inter / Source Serif 4
```

---

## 7. 开发与调试手册

### 7.1 本地 Worker

```bash
cd worker
cat > .dev.vars <<'VARS'
JWT_SECRET=dev-secret-change-me
ADMIN_EMAILS=admin@example.test
CREATE_ADMIN=dev-create-admin-secret
FRONTEND_URL=http://localhost:3000
EMAIL_FROM="Trans Community <noreply@example.test>"
APP_NAME=跨性别社群
VARS
../node_modules/.bin/wrangler d1 migrations apply transcommunity --local
../node_modules/.bin/wrangler dev --port 8787
```

### 7.2 本地前端

```bash
NEXT_PUBLIC_API_URL=http://localhost:8787 pnpm dev
```

### 7.3 使用 CI 测试夹具跑 API 集成测试

```bash
cd worker
rm -rf .wrangler .dev.vars
cat > .dev.vars <<'VARS'
JWT_SECRET=ci-test-secret-do-not-use-in-production
ADMIN_EMAILS=admin@ci.test
CREATE_ADMIN=ci-create-admin-secret
VARS
../node_modules/.bin/wrangler d1 migrations apply transcommunity --local
../node_modules/.bin/wrangler d1 execute transcommunity --local --file test/seed.sql
../node_modules/.bin/wrangler dev --port 8787
# 新终端：
API_BASE=http://localhost:8787 node test/api.test.mjs
```

### 7.4 首个管理员初始化

1. Worker secret 设置 `CREATE_ADMIN`。
2. 前端 `/sign-up` 输入管理员邮箱 + `CREATE_ADMIN` 密钥。
3. 如果数据库还没有 `ADMIN`，Worker 会创建/提级该邮箱为 ADMIN。
4. 一旦已有 ADMIN，再使用同一初始化密钥会返回 409。

---

## 8. 部署 checklist

### 8.1 Worker

- [ ] 选定唯一 wrangler 配置与执行目录。
- [ ] 创建/确认 D1 database `transcommunity`。
- [ ] 应用 `worker/migrations`。
- [ ] 创建/确认 R2 bucket `transcommunity`。
- [ ] 配置 Workers Email route 与 `SEND_EMAIL` binding。
- [ ] 设置 secrets/vars：
  - [ ] `JWT_SECRET`
  - [ ] `FRONTEND_URL`
  - [ ] `EMAIL_FROM`
  - [ ] `APP_NAME`
  - [ ] `ADMIN_EMAILS`
  - [ ] `CREATE_ADMIN`（初始化后可轮换/移除）
  - [ ] `TURNSTILE_SECRET_KEY`
- [ ] 确认生产没有 `DEBUG`。
- [ ] 部署后跑 `/api/health`。

### 8.2 前端

- [ ] 设置 `NEXT_PUBLIC_API_URL` 指向 Worker。
- [ ] 设置 `NEXT_PUBLIC_API_FALLBACK_URL`（可选）。
- [ ] GitHub Pages 子路径部署时设置 `NEXT_PUBLIC_BASE_PATH=/community`。
- [ ] 设置 Turnstile site key。
- [ ] 解决 Google Fonts build 依赖，或确保 CI 可访问。
- [ ] 跑 `pnpm frontend` 并检查 `frontend-artifact`。

### 8.3 安全上线前

- [ ] 修复邀请码消费/提权闭环。
- [ ] 增加基础 rate limit。
- [ ] 明确 JWT TTL 与二次验证策略。
- [ ] 检查所有 markdown/用户输入渲染路径。
- [ ] 加强文件上传 magic-byte 校验、图片重编码与 EXIF 抹除。
- [ ] 禁止生产 `DEBUG`。
- [ ] 复核 CORS 策略。

---

## 9. 建议路线图

### 第 1 阶段：安全闭环

1. 修复邀请码 claim/consume。
2. 给申请、登录、邀请码、举报、联系方式申请增加 rate limit。
3. 修复 lint hook warnings。
4. 明确 JWT TTL、token version 与账号禁用后的 token 失效策略。

### 第 2 阶段：工程卫生

1. 统一 wrangler 配置。
2. 整理 Prisma legacy 文件。
3. 迁移 `next lint` 到 ESLint CLI。
4. 把 Worker endpoint harness 接入 `pnpm test:api`。
5. 为 access predicates 建共享测试。

### 第 3 阶段：部署稳定性

1. 本地化字体，避免 build 依赖 Google Fonts。
2. 给 GitHub Pages 静态站增加可配置 headers/CSP（如托管平台支持）。
3. 为 R2 文件读取增加缓存头和更细粒度访问控制。
4. 建立定期备份 D1 / 导出流程。

### 第 4 阶段：产品增强

1. 活动提醒 cron。
2. 活动发布审核（可选）。
3. 多城市/地区运营模型。
4. 更完整的 admin audit/report dashboard。
5. 可配置申请问卷。

---

## 10. 文件索引

最常看的文件：

- `README.md`：项目入口说明与本地开发。
- `worker/src/index.ts`：Worker app 入口。
- `worker/src/routes/auth.ts`：登录、注册、邀请码、认证安全。
- `worker/src/routes/events.ts`：活动主流程。
- `worker/src/routes/users.ts`：个人资料、联系方式、邀请码、屏蔽、导出。
- `worker/src/routes/admin.ts`：管理后台 API。
- `worker/migrations/0001_init.sql`：D1 初始 schema。
- `src/lib/api.ts`：前端 API client。
- `src/contexts/AuthContext.tsx`：前端 JWT 会话。
- `src/lib/query-routing.ts`：静态导出路由。
- `src/lib/access/index.ts` 与 `worker/src/lib/access.ts`：权限模型。
- `.github/workflows/api-test.yml`：Worker API 集成测试的权威运行方式。
- `.github/workflows/deploy-pages.yml`：前端静态部署。
