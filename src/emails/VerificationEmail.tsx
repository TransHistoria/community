import { Button, Text } from "@react-email/components";
import { EmailLayout, styles } from "./_layout";

export default function VerificationEmail({
  url,
  appName,
}: {
  url: string;
  appName: string;
}) {
  return (
    <EmailLayout preview={`登录 ${appName}`}>
      <Text style={styles.h1}>登录 {appName}</Text>
      <Text style={styles.p}>
        点击下面的按钮即可登录。这条链接 30 分钟内有效，仅可使用一次。
      </Text>
      <Button href={url} style={styles.button}>
        登录
      </Button>
      <Text style={{ ...styles.p, marginTop: 16, color: "#6B655E" }}>
        如果按钮无法点击，请复制以下链接到浏览器：
      </Text>
      <Text style={{ ...styles.p, ...styles.link, fontSize: 13 }}>{url}</Text>
      <Text style={{ ...styles.p, marginTop: 16, color: "#6B655E", fontSize: 13 }}>
        如果不是你本人的操作，可以忽略这封邮件——没有人能用它登录到你的账号之外的地方。
      </Text>
    </EmailLayout>
  );
}
