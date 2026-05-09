import { Text, Button } from "@react-email/components";
import { EmailLayout, styles } from "./_layout";

export default function ContactRequestEmail({
  appName,
  requesterName,
  reason,
  url,
}: {
  appName: string;
  requesterName: string;
  reason: string;
  url: string;
}) {
  return (
    <EmailLayout preview={`${requesterName} 想查看你的联系方式`}>
      <Text style={styles.h1}>有人想查看你的联系方式</Text>
      <Text style={styles.p}>
        <strong>{requesterName}</strong> 在 {appName} 申请查看你设为「需申请」的联系方式。
      </Text>
      <Text
        style={{
          ...styles.p,
          padding: "12px 16px",
          backgroundColor: "#FAF7F2",
          borderRadius: 8,
          borderLeft: "3px solid #5BCEFA",
          fontSize: 14,
          color: "#1F1B17",
        }}
      >
        理由：{reason}
      </Text>
      <Text style={{ ...styles.p, color: "#6B655E", fontSize: 13 }}>
        是否同意完全由你决定。同意后，对方仅能看到你已勾选授权的具体几项。
      </Text>
      <Button href={url} style={styles.button}>
        查看申请
      </Button>
    </EmailLayout>
  );
}
