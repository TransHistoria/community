import { Text } from "@react-email/components";
import { EmailLayout, styles } from "./_layout";

export default function ApplicationRejectedEmail({
  appName,
  note,
}: {
  appName: string;
  note?: string;
}) {
  return (
    <EmailLayout preview={`${appName} 入站申请回复`}>
      <Text style={styles.h1}>关于你的入站申请</Text>
      <Text style={styles.p}>
        感谢你对 {appName} 的关注。在审核当前的注册资料后，我们暂时无法通过这次申请。
      </Text>
      <Text style={styles.p}>
        我们的审核机制是为了维持社区的安全感，并不构成对你身份的判断。
        如果你认识社区内的成员，可以请对方为你出具邀请码作为另一种入站路径；
        也可以稍后再次提交申请。
      </Text>
      {note ? (
        <Text style={{ ...styles.p, color: "#6B655E", fontSize: 14 }}>
          管理员留言：{note}
        </Text>
      ) : null}
    </EmailLayout>
  );
}
