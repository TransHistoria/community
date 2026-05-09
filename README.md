# 跨性别社群活动平台

私域跨性别社群的活动发布、报名与社交平台。门槛清晰、隐私可控、按信任分层。

> 本期专注前后端代码实现，不绑定具体部署环境。

## 技术栈

- **Next.js 14 (App Router)** + TypeScript
- **PostgreSQL + Prisma** ORM
- **Auth.js v5** 邮箱魔法链接登录
- **Tailwind CSS** + 自研 UI 组件（基于 Radix Primitives）
- **React Hook Form + Zod** 表单与校验
- **Resend / SMTP** 邮件
- **本地 fs / S3 兼容** 文件存储抽象

## 本地开发

1. **依赖**：Node.js 20+、PostgreSQL 14+、pnpm（或 npm / yarn）
2. **安装**
   ```bash
   pnpm install
   cp .env.example .env.local
   # 修改 .env.local 中的 DATABASE_URL 等
   ```
3. **数据库**
   ```bash
   pnpm db:migrate      # 应用迁移
   pnpm db:seed         # 写入分类等基础数据
   ```
4. **创建首位管理员**
   ```bash
   pnpm create-admin admin@example.com
   ```
5. **启动**
   ```bash
   pnpm dev
   # http://localhost:3000
   ```

## 关键命令

| 命令 | 说明 |
|---|---|
| `pnpm dev` | 启动开发服务器 |
| `pnpm db:migrate` | 应用迁移（开发） |
| `pnpm db:reset` | 重置数据库（销毁数据） |
| `pnpm db:studio` | Prisma Studio 数据浏览 |
| `pnpm create-admin <email>` | 创建/提升管理员 |
| `pnpm issue-invite <email>` | 命令行签发邀请码 |
| `pnpm typecheck` | TS 类型检查 |
| `pnpm test` | 单元测试 |
| `pnpm test:e2e` | Playwright 端到端 |

## 环境变量

见 `.env.example` 中的注释。最少需要：

- `DATABASE_URL`
- `AUTH_SECRET`
- 邮件渠道二选一：`RESEND_API_KEY` 或 `SMTP_*`（开发期都不填会输出到控制台）

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
