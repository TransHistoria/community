import {
  Body,
  Container,
  Head,
  Html,
  Preview,
  Section,
  Text,
} from "@react-email/components";
import type { ReactNode } from "react";

export function EmailLayout({
  preview,
  children,
}: {
  preview: string;
  children: ReactNode;
}) {
  return (
    <Html>
      <Head />
      <Preview>{preview}</Preview>
      <Body
        style={{
          backgroundColor: "#FAF7F2",
          fontFamily:
            "Inter, 'PingFang SC', 'Source Han Sans SC', system-ui, sans-serif",
          color: "#1F1B17",
          margin: 0,
          padding: "32px 0",
        }}
      >
        <Container
          style={{
            backgroundColor: "#FFFFFF",
            borderRadius: 12,
            border: "1px solid #E8E2D8",
            padding: 32,
            maxWidth: 540,
          }}
        >
          {children}
          <Section
            style={{
              marginTop: 32,
              paddingTop: 16,
              borderTop: "1px solid #E8E2D8",
            }}
          >
            <Text style={{ fontSize: 12, color: "#9A938A", margin: 0 }}>
              你收到这封邮件是因为你在跨性别社群平台上的相关操作。
              如果你认为这是误投，请直接忽略此邮件。
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

export const styles = {
  h1: {
    fontFamily: "'Source Serif 4', 'Source Han Serif SC', Georgia, serif",
    fontSize: 24,
    fontWeight: 500,
    margin: "0 0 16px",
    letterSpacing: "-0.01em",
  } as const,
  p: {
    fontSize: 15,
    lineHeight: 1.6,
    margin: "0 0 12px",
  } as const,
  button: {
    display: "inline-block",
    backgroundColor: "#3CB6E8",
    color: "#FFFFFF",
    padding: "12px 24px",
    borderRadius: 8,
    textDecoration: "none",
    fontWeight: 500,
    fontSize: 15,
    margin: "16px 0",
  } as const,
  link: {
    color: "#3CB6E8",
    textDecoration: "underline",
    wordBreak: "break-all" as const,
  } as const,
};
