import { Text, Button } from "@react-email/components";
import { EmailLayout, styles } from "./_layout";

export default function EventReminderEmail({
  appName,
  eventTitle,
  eventUrl,
  startAt,
}: {
  appName: string;
  eventTitle: string;
  eventUrl: string;
  startAt: Date;
}) {
  const formatted = new Intl.DateTimeFormat("zh-CN", {
    dateStyle: "long",
    timeStyle: "short",
  }).format(startAt);

  return (
    <EmailLayout preview={`「${eventTitle}」即将开始`}>
      <Text style={styles.h1}>「{eventTitle}」即将开始</Text>
      <Text style={styles.p}>开始时间：{formatted}</Text>
      <Text style={styles.p}>
        来 {appName} 看一眼活动页，确认地点 / 链接、自己的报名状态，以及组织者发布的最新提醒。
      </Text>
      <Button href={eventUrl} style={styles.button}>
        查看活动
      </Button>
    </EmailLayout>
  );
}
