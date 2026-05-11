# 跨性别社群活动平台

私域跨性别社群的活动发布、报名与社交平台。门槛清晰、隐私可控、按信任分层。

> 本期专注前后端代码实现，不绑定具体部署环境。

## 技术栈

- **Next.js 14 (App Router)** + TypeScript
- **Cloudflare Workers (Hono) + D1**
- **Wrangler** 本地运行与部署（`wrangler dev` / `wrangler deploy`）
- **Tailwind CSS** + 自研 UI 组件（基于 Radix Primitives）
- **React Hook Form + Zod** 表单与校验
- **Resend / SMTP** 邮件
- **本地 fs / S3 兼容** 文件存储抽象

## 本地开发

1. **依赖**：Node.js 20+、pnpm（或 npm / yarn）
2. **安装前端依赖**
   ```bash
   pnpm install
   ```
3. **安装并启动后端（Wrangler）**
   ```bash
   cd worker
   pnpm install
   pnpm run setup
   pnpm run dev
   ```
4. **启动前端**
   ```bash
   pnpm dev
   # http://localhost:3000
   ```

## 关键命令

| 命令 | 说明 |
|---|---|
| `pnpm dev` | 启动开发服务器 |
| `cd worker && pnpm run dev` | 本地运行 Worker 后端（Wrangler） |
| `cd worker && pnpm run setup` | 部署前执行 D1 migration/setup |
| `cd worker && pnpm run deploy` | 部署到 Cloudflare（包含 setup） |
| `pnpm typecheck` | TS 类型检查 |
| `pnpm test` | 单元测试 |
| `pnpm test:e2e` | Playwright 端到端 |

## 环境变量

后端环境变量统一通过 `worker/wrangler.jsonc` 的 `vars` 与 Wrangler secrets 配置，不再使用 `.env.example`。
前端默认 API 地址为 `https://transcommunity.cyanmint.workers.dev`（可通过 `NEXT_PUBLIC_API_URL` 覆盖）。

## 目录结构

```
src/
├─ app/                 # Next.js App Router 页面
│  ├─ (marketing)/      # 公开着陆页
│  ├─ (auth)/           # 注册/登录/申请
│  ├─ (app)/            # 受保护的应用区
│  ├─ admin/            # 管理后台
│  └─ api/              # Route Handlers
├─ components/          # UI 组件
│  ├─ ui/               # 基础原子组件
│  ├─ event/            # 活动相关
│  ├─ user/             # 用户相关
│  └─ layout/           # 布局
├─ lib/
│  ├─ db.ts             # Prisma client 单例
│  ├─ auth.ts           # Auth.js 配置
│  ├─ access/           # 权限断言函数
│  ├─ mail/             # 邮件发送 + 模板
│  ├─ moderation/       # 关键词过滤、举报处理
│  ├─ storage/          # 文件存储抽象
│  └─ validators/       # Zod schemas
├─ emails/              # React Email 模板
├─ middleware.ts        # 全局路由中间件
└─ styles/globals.css
prisma/
├─ schema.prisma
└─ seed.ts
scripts/
├─ create-admin.ts
└─ issue-invite.ts
worker/
├─ wrangler.jsonc
├─ migrations/
└─ src/
```

## 用户分级

| Tier | 浏览 | 报名 | 评论 | 发布 | 管理 |
|---|---|---|---|---|---|
| GUEST 游客 | 仅公开摘要 | × | × | × | × |
| UNVERIFIED 已注册 | 同游客 + 申请状态 | × | × | × | × |
| VERIFIED 已认证 | + 认证活动 | √ | √ | √ | × |
| TRUSTED 信任成员 | + 信任活动 | √ | √ | √ | 部分 |
| ADMIN 管理员 | 全部 | √ | √ | √ | √ |

## 隐私承诺要点

- 不收集真实姓名；展示用昵称
- 联系方式默认仅认证成员可见，可设为「申请查看」
- 线下精确地址永不在公开范围内展示，仅报名通过后可见
- 无私信功能（避免成为骚扰温床）
- 数据可导出，账号可注销（30 天软删）
- 管理员操作全程审计

## License

MIT — 但请尊重社群安全：分叉/改造时请保留隐私设计的核心默认值。
