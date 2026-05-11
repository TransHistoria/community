import { PageHeader } from "@/components/ui/page-header";

export default function AboutPage() {
  return (
    <article className="max-w-3xl mx-auto space-y-12">
      <PageHeader
        eyebrow="关于平台"
        title="关于 跨性别社群"
        description="一个为跨性别社群打造的私域空间。这里记录我们的设计原则、社区守则和隐私承诺。"
      />

      <section className="prose-trans space-y-4">
        <p>
          跨性别社群是一个由社群成员发起、面向跨性别社群的私域活动平台。
          我们不追求增长、不追求曝光，只希望为社群里愿意组织和参与活动的成员提供一个相对安全的空间。
        </p>
        <p>
          在中文互联网上，跨性别社群长期面临两难：要么躲在更隐蔽但更脆弱的群聊里，
          要么暴露在算法之下被陌生人围观。这两种状态都不健康。
          我们尝试在中间做一个折中：进来需要门槛，进来后看到什么、被谁看到，由你自己控制。
        </p>
      </section>

      <section id="community-guidelines" className="space-y-4">
        <h2 className="font-serif text-h1 tracking-tight">社区守则</h2>
        <ul className="space-y-3 text-ink leading-relaxed">
          <li>
            <strong>尊重彼此的身份与边界。</strong>
            <span className="text-ink-muted">
              {" "}使用对方声明的代词与名字。不质疑对方的身份合法性，不以「真／假」论断。
            </span>
          </li>
          <li>
            <strong>不提倡医疗建议。</strong>
            <span className="text-ink-muted">
              {" "}激素、手术等议题可分享个人经验，但请明确「这是我的经验，不是建议」。涉及具体方案请咨询专业医生。
            </span>
          </li>
          <li>
            <strong>不讨论破解、规避、偷渡身份。</strong>
            <span className="text-ink-muted">
              {" "}本平台不参与法律灰色地带的指引。
            </span>
          </li>
          <li>
            <strong>不收集、不索取、不传播他人真实身份。</strong>
            <span className="text-ink-muted">
              {" "}包括但不限于真实姓名、身份证、住址、工作单位。
            </span>
          </li>
          <li>
            <strong>线下见面，循序渐进。</strong>
            <span className="text-ink-muted">
              {" "}首次见面建议公共场所、白天、与熟人共享行程。组织者有权拒绝任何让其他成员感到不适的报名。
            </span>
          </li>
        </ul>
      </section>

      <section id="privacy" className="space-y-4">
        <h2 className="font-serif text-h1 tracking-tight">隐私承诺</h2>
        <ul className="space-y-3 text-ink leading-relaxed">
          <li>
            <strong>不收集真实姓名。</strong>
            <span className="text-ink-muted">
              {" "}注册仅需邮箱。展示给他人的是你自己设的昵称与代词。
            </span>
          </li>
          <li>
            <strong>不公开搜索。</strong>
            <span className="text-ink-muted">
              {" "}本站启用 noindex，不会被搜索引擎收录。
            </span>
          </li>
          <li>
            <strong>没有私信。</strong>
            <span className="text-ink-muted">
              {" "}所有交流发生在公开评论或你主动展示的联系方式上。
            </span>
          </li>
          <li>
            <strong>线下精确地址、线上会议链接，仅报名通过后可见。</strong>
            <span className="text-ink-muted">
              {" "}无论活动可见性设为「公开」还是「认证可见」，精确位置永远受报名审批保护。
            </span>
          </li>
          <li>
            <strong>数据可导出，账号可注销。</strong>
            <span className="text-ink-muted">
              {" "}你可以随时下载属于你的数据。注销账号后，30 天内可恢复，超过期限将硬删除。
            </span>
          </li>
          <li>
            <strong>管理员操作有审计。</strong>
            <span className="text-ink-muted">
              {" "}提升等级、隐藏内容、封禁账号等所有动作均有日志，可追溯。
            </span>
          </li>
        </ul>
      </section>

      <section id="safety" className="space-y-4">
        <h2 className="font-serif text-h1 tracking-tight">安全提示</h2>
        <ul className="space-y-3 text-ink-muted leading-relaxed">
          <li>请不要在平台上转账或接受任何要求转账的请求。</li>
          <li>请警惕任何要求你提供身份证、护照、医疗记录的行为。</li>
          <li>遇到不当言论或行为，请使用举报入口；情况紧急可直接退出对话/活动。</li>
          <li>本平台不替代专业心理 / 医疗 / 法律服务。</li>
        </ul>
      </section>

      <section className="space-y-4">
        <h2 className="font-serif text-h1 tracking-tight">用户分级</h2>
        <p className="text-ink-muted">
          注册后你将以「未认证」身份进入。通过邀请码或申请审核后成为「已认证」，可参加活动、发布活动、留言。
          长期活跃且无举报记录的成员会被升级为「信任成员」，获得更多权限（例如更多邀请码额度、设置仅信任成员可见的活动）。
        </p>
        <p className="text-ink-muted">
          这种分级不是评判你「好不好」，只是让平台知道在多大程度上扩展你的可见性与能力。
        </p>
      </section>
    </article>
  );
}
