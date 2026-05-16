# TransHistoria/community — 跨性别社群活动平台

私域、邀请制、隐私可控的跨性别社群活动发布、报名与社交轻平台。项目目标是把社群安全默认值写进产品：不公开索引、不强制真实姓名、联系方式按可见性分层、线下精确地址/线上会议链接只给报名通过者。

> **当前实现形态（2026-05-16 代码审阅后确认）**：静态导出的 Next.js 前端 + Cloudflare Workers/Hono API + D1 数据库 + R2/Workers Email 集成点。旧的 Prisma/NextAuth 目录仍保留为历史/本地验证资料，不是当前线上主路径。

## 功能范围

- **准入机制**：邀请码预校验、申请审核、首个管理员 `CREATE_ADMIN` 初始化通道。
- **认证方式**：邮箱魔法链接、TOTP、密码、TOTP/密码组合策略（`EITHER` / `PASSWORD_ONLY` / `TOTP_ONLY` / `BOTH_REQUIRED`）。
- **成员分级**：`GUEST` / `UNVERIFIED` / `VERIFIED` / `TRUSTED` / `ADMIN`。
- **活动闭环**：活动列表、详情、创建、编辑、取消、报名、报名审核、取消报名、评论、隐藏评论。
- **社交安全**：公开主页、联系方式可见性、联系方式申请查看、屏蔽、举报、通知。
- **管理后台**：申请审核、用户管理、重置用户认证材料、改邮箱、举报处理、Turnstile/邮件测试、审计日志。
- **静态托管适配**：前端 `output: "export"`，通过 query-route 兼容 GitHub Pages 的单入口静态站点。

## 技术栈

| 层 | 当前主路径 |
|---|---|
| 前端 | Next.js 15.5 App Router、React 18、TypeScript、Tailwind CSS、Radix Primitives、自研 UI 组件 |
| API | Cloudflare Workers、Hono、D1、R2、Workers Email、JWT (`jose`) |
| 表单/校验 | React Hook Form、Zod |
| 邮件 | Workers Email MIME 发送；React Email 模板目录保留 |
| 安全辅助 | Cloudflare Turnstile、TOTP、PBKDF2 密码哈希；文件上传当前仅 MIME/大小校验，需补 magic-byte/重压缩 |
| 测试/CI | TypeScript、Next lint、Worker endpoint 脚本测试、GitHub Actions Pages/API workflows |
| 历史/备用 | Prisma SQLite schema、seed、admin/invite 脚本（当前不在 Worker 主链路中） |

## 目录结构

```text
.
├─ src/
│  ├─ app/                     # 静态导出的 Next App Router 页面
│  │  ├─ (marketing)/          # 首页、关于页
│  │  ├─ (auth)/               # 登录、注册、申请、验证页
│  │  ├─ (app)/                # 应用区（客户端鉴权 + Worker 数据）
│  │  └─ admin/                # 管理后台（客户端校验 ADMIN，API 再强制鉴权）
│  ├─ components/              # layout/ui/event/user/moderation/security 组件
│  ├─ contexts/AuthContext.tsx # localStorage JWT 会话上下文
│  ├─ lib/api.ts               # Worker API typed client 与 fallback host 逻辑
│  ├─ lib/access/              # 前端可复用权限谓词
│  ├─ lib/query-routing.ts     # GitHub Pages 静态导出路由编码/解析
│  └─ styles/globals.css       # 主题、排版与全局样式
├─ worker/
│  ├─ src/index.ts             # Hono app、CORS、debug instrumentation、route mounts
│  ├─ src/routes/              # auth/events/users/applications/admin/reports/files/notifications
│  ├─ src/auth/                # JWT、magic token、TOTP、password helpers
│  ├─ src/lib/                 # access、Turnstile、utils、enum helpers
│  ├─ migrations/              # D1 schema migrations（当前后端事实 schema）
│  └─ test/                    # D1 seed + endpoint integration harness
├─ prisma/                     # 历史/本地验证 SQLite Prisma schema 与 seed
├─ scripts/                    # Prisma-era 管理脚本 + frontend artifact builder
├─ verify-screenshots/         # 手工/浏览器验证截图
├─ .github/workflows/          # GitHub Pages 部署与 Worker API 测试
├─ next.config.mjs             # 静态导出配置
├─ wrangler.jsonc              # repo-root Worker deploy config
└─ worker/wrangler.jsonc       # worker 子目录本地/dev config
```

## 本地开发

### 环境要求

- Node.js 20+（API CI 使用 Node 22；前端 Pages CI 使用 Node 20）
- pnpm（lockfile 为 pnpm）
- Wrangler（通过项目依赖调用即可）

### 安装

```bash
pnpm install
```

### 启动 Worker API（本地 D1）

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

如需测试夹具：

```bash
cd worker
../node_modules/.bin/wrangler d1 execute transcommunity --local --file test/seed.sql
node test/api.test.mjs
```

### 启动前端

```bash
NEXT_PUBLIC_API_URL=http://localhost:8787 pnpm dev
# http://localhost:3000
```

> 前端不会在 Next.js 服务器上处理业务 API；所有读写都经 `NEXT_PUBLIC_API_URL` 指向 Worker。

## 关键命令

| 命令 | 说明 |
|---|---|
| `pnpm dev` | 启动 Next 前端开发服务器 |
| `pnpm frontend` | `next build` + 生成 GitHub Pages artifact（当前会联网拉取 next/font 的 Google Fonts） |
| `pnpm typecheck` | 前端 TypeScript 检查 |
| `pnpm typecheck:worker` | Worker TypeScript 检查 |
| `pnpm lint` | `next lint`（Next 15 已提示该命令将在 Next 16 移除） |
| `pnpm exec vitest run` | 当前会失败：`worker/test/api.test.mjs` 不是 Vitest suite |
| `cd worker && ../node_modules/.bin/wrangler d1 migrations apply transcommunity --local` | 应用本地 D1 migrations |
| `cd worker && ../node_modules/.bin/wrangler dev --port 8787` | 本地运行 Worker API |
| `cd worker && node test/api.test.mjs` | 对运行中的 Worker 执行 endpoint 集成测试 |
| `pnpm run setup` | 对远端 D1 应用 migrations（repo-root wrangler 配置） |
| `pnpm run deploy` | 远端 migration + Worker deploy |

## 环境变量与配置

### 前端公开变量

| 变量 | 用途 |
|---|---|
| `NEXT_PUBLIC_API_URL` | Worker API 主地址（无尾斜杠） |
| `NEXT_PUBLIC_API_FALLBACK_URL` | 主地址 404/405 或网络异常时尝试的备用 API 地址 |
| `NEXT_PUBLIC_BASE_PATH` | GitHub Pages 子路径，例如 `/community` |
| `TURNSTILE_SITE_KEY` / `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | 编译进前端的 Turnstile site key |
| `NEXT_PUBLIC_DEBUG` / `DEBUG` | 开启前端 debug 展示与 Worker debug 响应字段 |

### Worker 变量/secret

| 变量 | 用途 |
|---|---|
| `JWT_SECRET` | JWT 签发/校验密钥，生产必须用 secret 配置 |
| `FRONTEND_URL` | 邮件链接回跳的前端站点 URL |
| `EMAIL_FROM` | 发件人 |
| `APP_NAME` / `APP_LOCALE` | 邮件和 UI 文案辅助 |
| `ADMIN_EMAILS` | 逗号分隔的管理员邮箱白名单 |
| `CREATE_ADMIN` | 首个管理员初始化密钥；已有 ADMIN 后会被拒绝 |
| `TURNSTILE_SECRET_KEY` | Worker 端 Turnstile 校验密钥 |
| `DEBUG` | Worker 响应中附带 debug 日志；生产慎用 |

Cloudflare 绑定：

- `DB`：D1 database `transcommunity`
- `FILES`：R2 bucket `transcommunity`
- `SEND_EMAIL`：Workers Email binding

## 权限模型

| Tier | 浏览 | 报名 | 评论 | 发布活动 | 管理 |
|---|---|---|---|---|---|
| `GUEST` | 公开活动概要/公开用户页有限内容 | × | × | × | × |
| `UNVERIFIED` | 同游客 + 本人申请/登录状态 | × | × | × | × |
| `VERIFIED` | `PUBLIC` + `VERIFIED` 范围 | √ | √ | √ | × |
| `TRUSTED` | `PUBLIC` + `VERIFIED` + `TRUSTED` | √ | √ | √ | 部分产品语义，API 当前多数管理仍限 ADMIN |
| `ADMIN` | 全部 | √ | √ | √ | √ |

活动精确地址与线上链接不由活动 `visibility` 直接公开，需满足：组织者、ADMIN，或报名状态为 `CONFIRMED` / `CHECKED_IN`。

## 隐私与安全默认值

- 根布局设置 `robots: { index: false, follow: false }`，平台默认不被搜索引擎收录。
- 前端静态页只做体验级路由保护；敏感数据必须以后端 Worker 鉴权结果为准。
- JWT 存在浏览器 `localStorage` 的 `tc_token`，无服务端 session/cookie。
- 联系方式默认 `VERIFIED` 可见，可设为 `PUBLIC`、`TRUSTED` 或 `HIDDEN_REQUEST`。
- 无私信功能；联系方式申请只有理由与同意/拒绝流。
- 文件上传走 Worker/R2；当前只按浏览器提供的 MIME type 和 4MB 大小限制校验，尚未做 magic-byte 校验、重压缩或 EXIF 抹除。
- Turnstile 未配置 secret 时后端会放行，适合本地开发；生产需要配置。

## 已知问题 / 代码审阅结论摘要

更完整的审阅记录见 [`HANDOVER.md`](HANDOVER.md)。当前最值得优先处理的问题：

1. **邀请码只预校验，未在 magic-link 登录链路中消费，也未把受邀新用户提升为 `VERIFIED`**；`verify-invite` 写入 `INVITE_PRECHECK` 通知，但 `/api/auth/verify` 没读取它。
2. **文档/历史代码曾混用 Prisma/NextAuth 叙述**；当前 README/HANDOVER 已按 Worker/D1 主路径重写，但 `prisma/` 与脚本仍需决定保留还是移除。
3. **前端 build 依赖 Google Fonts 网络访问**；离线/受限 CI 会因 `next/font/google` 拉取失败而构建失败。
4. **`pnpm test` / Vitest 配置不匹配**；真实 API 测试应按 workflow 使用 `node worker/test/api.test.mjs`。
5. **文件上传校验弱于旧文档承诺**：当前仅检查 MIME type/大小，未做 magic-byte、重压缩、EXIF 抹除。
6. **Next lint 命令已弃用且有 2 条 hook dependency warning**。

## 部署概览

### 前端（GitHub Pages）

`.github/workflows/deploy-pages.yml` 在默认分支或 `copilot/*` 分支构建：

1. `pnpm install --frozen-lockfile`
2. `pnpm run frontend`
3. 上传 `frontend-artifact`
4. Deploy Pages

若 repo 不是根域名，设置 `NEXT_PUBLIC_BASE_PATH=/community`。

### Worker API

使用 repo-root `wrangler.jsonc` 或 `worker/wrangler.jsonc` 均可，但两者的 `main` / `migrations_dir` 路径不同。部署前确认工作目录：

```bash
pnpm run setup
pnpm run deploy
```

生产部署前必须设置 `JWT_SECRET`、`FRONTEND_URL`、`EMAIL_FROM`、`TURNSTILE_SECRET_KEY`（如启用 Turnstile）并确认 D1/R2/Workers Email 绑定存在。

## License

MIT — 但请尊重社群安全：分叉/改造时请保留隐私设计的核心默认值。
