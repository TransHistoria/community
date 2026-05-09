import { Text, Button } from "@react-email/components";
import { EmailLayout, styles } from "./_layout";

const STATUS_LABEL: Record<string, string> = {
  CONFIRMED: "已确认",
  WAITLIST: "已加入候补名单",
  DECLINED: "未通过",
  PENDING: "等待审核",
};

export default function RegistrationStatusEmail({
  appName,
  eventTitle,
  eventUrl,
  status,
}: {
  appName: string;
  eventTitle: string;
  eventUrl: string;
  status: "CONFIRMED" | "WAITLIST" | "DECLINED" | "PENDING";
}) {
  return (
    <EmailLayout preview={`「${eventTitle}」报名状态：${STATUS_LABEL[status]}`}>
      <Text style={styles.h1}>报名状态更新</Text>
      <Text style={styles.p}>
        你在 <strong>{appName}</strong> 报名的活动「{eventTitle}」状态已更新为：
      </Text>
      <Text style={{ ...styles.p, fontSize: 18, fontWeight: 600 }}>
        {STATUS_LABEL[status]}
      </Text>
      {status === "CONFIRMED" ? (
        <Text style={styles.p}>
          活动详情页面已经解锁完整信息，包括精确地点（线下活动）或会议链接（线上活动）。
        </Text>
      ) : null}
      <Button href={eventUrl} style={styles.button}>
        查看活动
      </Button>
    </EmailLayout>
  );
}
