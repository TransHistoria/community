"use client";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/contexts/AuthContext";
import { ShieldCheck, Users, Lock, Sparkles, type LucideIcon } from "lucide-react";
import { toQueryRoute } from "@/lib/query-routing";

export default function HomePage() {
  const { user } = useAuth();

  return (
    <div className="space-y-24 py-6 md:py-12">
      {/* Hero */}
      <section className="grid gap-10 md:grid-cols-[1.1fr_0.9fr] md:items-center">
        <div className="space-y-6">
          <Badge variant="pink" className="rounded-full">
            私域 · 邀请制
          </Badge>
          <h1 className="font-serif text-display-lg text-balance leading-[1.05] tracking-tight">
            为社群而建的
            <br />
            <span className="bg-trans-gradient bg-clip-text text-transparent">
              活动空间
            </span>
            。
          </h1>
          <p className="max-w-xl text-lg text-ink-muted leading-relaxed">
            跨性别社群是一个面向跨性别社群的私域活动平台。
            邀请制注册、可控的可见性、温和的对话边界。
            没有私信、没有公开搜索、没有多余的元素干扰你与社群之间的连接。
          </p>
          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            {user ? (
                <Button size="lg" asChild>
                  <Link href={toQueryRoute("/events")}>浏览活动</Link>
                </Button>
            ) : (
              <>
                <Button size="lg" asChild>
                  <Link href={toQueryRoute("/sign-up")}>加入社群</Link>
                </Button>
                <Button size="lg" variant="outline" asChild>
                  <Link href={toQueryRoute("/sign-in")}>已有账号</Link>
                </Button>
              </>
            )}
          </div>
          <p className="text-xs text-ink-subtle">
            注册需要邀请码或通过申请审核。我们不收集真实姓名。
          </p>
        </div>
        <div className="relative aspect-[4/5] rounded-2xl bg-trans-gradient-soft p-1 shadow-lift">
          <div className="h-full w-full rounded-[14px] bg-card flex items-center justify-center p-8">
            <div className="text-center space-y-4 max-w-xs">
              <div className="mx-auto h-16 w-16 rounded-full bg-trans-gradient" />
              <p className="font-serif text-h2 leading-tight text-balance">
                这里没有 KPI、没有曝光算法、没有陌生人的窥探。
              </p>
              <p className="text-sm text-ink-muted">
                只有想要与同社群一起做点什么的人，和他们组织的事。
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Principles */}
      <section className="space-y-10">
        <div className="space-y-2">
          <div className="text-xs uppercase tracking-[0.18em] text-trans-blue-deep">
            设计原则
          </div>
          <h2 className="font-serif text-display tracking-tight">
            把安全感写进默认值
          </h2>
        </div>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          <Principle
            icon={Lock}
            title="可见性按需开放"
            body="活动、联系方式、个人主页的每一项，都可以分别设置：公开、认证可见、信任可见，或仅在被申请并同意后可见。"
          />
          <Principle
            icon={Users}
            title="不做私信"
            body="所有交流都在公开页面、活动评论或经审批的联系方式上发生。这让私下骚扰失去通道。"
          />
          <Principle
            icon={ShieldCheck}
            title="精确地址受保护"
            body="线下活动的精确地址、线上活动的会议链接，永远只对报名通过的成员可见。"
          />
          <Principle
            icon={Sparkles}
            title="信任来自时间"
            body="新成员通过邀请或审核加入。在社群里持续参与，你会被授予更高的信任级别和更多的能力。"
          />
        </div>
      </section>

      {/* Categories preview */}
      <section className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 border-b border-border pb-4">
          <div className="space-y-1">
            <div className="text-xs uppercase tracking-[0.18em] text-trans-blue-deep">
              活动类型
            </div>
            <h2 className="font-serif text-h1 tracking-tight">
              社群里在发生什么
            </h2>
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 text-sm">
          {[
            ["心理支持", "互助小组、咨询资源分享、议题陪伴"],
            ["聚会游玩", "城市集合、咖啡馆、桌游、徒步"],
            ["运动", "球类、跑步、瑜伽、攀岩"],
            ["线上游戏组队", "稳定车队、新手向、合作通关"],
            ["学习读书", "议题阅读、语言互助、考试学习"],
            ["工作坊", "技能、表达、形象、写作"],
            ["倡导/公共", "公共议题学习与讨论"],
            ["其他", "其他社群成员组织的活动"],
          ].map(([title, sub]) => (
            <div
              key={title}
              className="rounded-lg border border-border bg-card p-4 hover:shadow-soft transition-shadow"
            >
              <div className="font-medium">{title}</div>
              <div className="text-ink-muted mt-1 text-xs leading-relaxed">
                {sub}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      {!user ? (
        <section className="rounded-2xl bg-trans-gradient-soft p-8 md:p-12 text-center space-y-5">
          <h2 className="font-serif text-display tracking-tight text-balance">
            如果你属于这里，欢迎进来。
          </h2>
          <p className="text-ink-muted max-w-xl mx-auto">
            如果你有现成的邀请码，几分钟内就能完成加入。
            如果没有，也可以提交一份简单的入站申请。
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
            <Button size="lg" asChild>
              <Link href={toQueryRoute("/sign-up")}>开始加入</Link>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <Link href={toQueryRoute("/about")}>先了解一下</Link>
            </Button>
          </div>
        </section>
      ) : null}
    </div>
  );
}

function Principle({
  icon: Icon,
  title,
  body,
}: {
  icon: LucideIcon;
  title: string;
  body: string;
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-6 space-y-3 hover:shadow-soft transition-shadow">
      <div className="h-9 w-9 rounded-md bg-trans-gradient-soft flex items-center justify-center">
        <Icon className="h-5 w-5 text-trans-blue-deep" strokeWidth={1.8} />
      </div>
      <div className="font-serif text-h3 tracking-tight">{title}</div>
      <p className="text-sm text-ink-muted leading-relaxed">{body}</p>
    </div>
  );
}
