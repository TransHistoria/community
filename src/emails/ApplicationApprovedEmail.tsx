import { Text, Button } from "@react-email/components";
import { EmailLayout, styles } from "./_layout";

export default function ApplicationApprovedEmail({ appName }: { appName: string }) {
  return (
    <EmailLayout preview="入站申请已通过">
      <Text style={styles.h1}>欢迎加入 {appName}</Text>
      <Text style={styles.p}>
        你的入站申请已经通过审核。现在可以登录、浏览活动、报名参加，也可以在准备好之后发布自己的活动。
      </Text>
      <Text style={styles.p}>
        进入前，建议先完善你的主页（昵称、代词、自我介绍），以及调整联系方式的可见范围——
        这些设置都可以随时修改。
      </Text>
      <Button href="/me/profile" style={styles.button}>
        完善主页
      </Button>
      <Text style={{ ...styles.p, color: "#6B655E", fontSize: 13, marginTop: 16 }}>
        重要提醒：本平台没有私信功能。任何要求加私聊、转账、提供个人证件的行为都请保持警惕，
        遇到问题可在用户主页或活动页发起举报。
      </Text>
    </EmailLayout>
  );
}
