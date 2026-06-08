import {
  Body,
  Column,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Preview,
  Row,
  Section,
  Text,
} from "@react-email/components";
import * as React from "react";
import type { DailySummaryData, LifecycleStage } from "@/types";

interface DailySummaryEmailProps {
  data: DailySummaryData;
}

const STAGE_LABELS: Record<LifecycleStage, string> = {
  signup: "New Signups",
  onboarding: "Onboarding",
  active: "Active",
  going_quiet: "Going Quiet",
  conversion_ready: "Ready to Convert",
  paid: "Paid",
  churned: "Churned",
};

export function DailySummaryEmail({ data }: DailySummaryEmailProps) {
  const date = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  return (
    <Html>
      <Head />
      <Preview>
        {`Daily summary — ${data.emails_sent_today} emails sent, ${data.conversion_rate_7d}% conversion rate this week`}
      </Preview>
      <Body style={main}>
        <Container style={container}>
          <Text style={dateLabel}>{date}</Text>
          <Heading style={h1}>
            {data.workspace.name} — Daily Summary
          </Heading>

          {/* Key metrics row */}
          <Section style={metricsSection}>
            <Row>
              <Column style={metricCard}>
                <Text style={metricValue}>{data.new_signups_today}</Text>
                <Text style={metricLabel}>New signups today</Text>
              </Column>
              <Column style={metricCard}>
                <Text style={metricValue}>{data.emails_sent_today}</Text>
                <Text style={metricLabel}>Emails sent today</Text>
              </Column>
              <Column style={metricCard}>
                <Text style={metricValue}>{data.conversion_rate_7d}%</Text>
                <Text style={metricLabel}>7-day conversion</Text>
              </Column>
              <Column style={metricCard}>
                <Text style={metricValue}>
                  ${data.revenue_this_week.toLocaleString()}
                </Text>
                <Text style={metricLabel}>Revenue this week</Text>
              </Column>
            </Row>
          </Section>

          <Hr style={hr} />

          {/* Stage breakdown */}
          <Heading style={h2}>Stage Breakdown</Heading>
          <Section>
            {Object.entries(STAGE_LABELS).map(([stage, label]) => {
              const count =
                data.stage_breakdown[stage as LifecycleStage] ?? 0;
              if (count === 0) return null;
              return (
                <Row key={stage} style={stageRow}>
                  <Column style={stageLabelCol}>
                    <Text style={stageText}>{label}</Text>
                  </Column>
                  <Column style={stageCountCol}>
                    <Text style={stageCount}>{count}</Text>
                  </Column>
                </Row>
              );
            })}
          </Section>

          <Hr style={hr} />

          <Text style={footer}>
            ConversionCRM · Automated daily summary
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

export default DailySummaryEmail;

const main: React.CSSProperties = {
  backgroundColor: "#f6f9fc",
  fontFamily:
    '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
};

const container: React.CSSProperties = {
  backgroundColor: "#ffffff",
  margin: "40px auto",
  padding: "40px",
  borderRadius: "8px",
  maxWidth: "600px",
  border: "1px solid #e6ebf1",
};

const dateLabel: React.CSSProperties = {
  color: "#9ca3af",
  fontSize: "13px",
  margin: "0 0 8px",
};

const h1: React.CSSProperties = {
  color: "#1a1a2e",
  fontSize: "22px",
  fontWeight: "700",
  margin: "0 0 32px",
};

const h2: React.CSSProperties = {
  color: "#1a1a2e",
  fontSize: "16px",
  fontWeight: "600",
  margin: "0 0 16px",
};

const metricsSection: React.CSSProperties = {
  margin: "0 0 24px",
};

const metricCard: React.CSSProperties = {
  textAlign: "center",
  padding: "12px",
  backgroundColor: "#f8fafc",
  borderRadius: "6px",
  margin: "0 4px",
};

const metricValue: React.CSSProperties = {
  color: "#6366f1",
  fontSize: "28px",
  fontWeight: "700",
  margin: "0 0 4px",
};

const metricLabel: React.CSSProperties = {
  color: "#6b7280",
  fontSize: "12px",
  margin: 0,
};

const hr: React.CSSProperties = {
  borderColor: "#e6ebf1",
  margin: "24px 0",
};

const stageRow: React.CSSProperties = {
  borderBottom: "1px solid #f3f4f6",
  padding: "8px 0",
};

const stageLabelCol: React.CSSProperties = {};
const stageCountCol: React.CSSProperties = { textAlign: "right" };

const stageText: React.CSSProperties = {
  color: "#374151",
  fontSize: "14px",
  margin: 0,
};

const stageCount: React.CSSProperties = {
  color: "#1a1a2e",
  fontSize: "14px",
  fontWeight: "600",
  margin: 0,
};

const footer: React.CSSProperties = {
  color: "#9ca3af",
  fontSize: "12px",
  textAlign: "center",
  margin: 0,
};
