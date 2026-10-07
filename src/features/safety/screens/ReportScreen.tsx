import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Text } from "react-native";

import { Button, Card, Field, Screen } from "@/shared/ui";

import { REPORT_REASON_LABELS, reportMember, type ReportReason } from "../api/safetyApi";

export function ReportScreen() {
  const { memberId } = useLocalSearchParams<{ memberId: string }>();
  const [reason, setReason] = useState<ReportReason>();
  const [details, setDetails] = useState("");
  const [submitted, setSubmitted] = useState(false);

  async function handleSubmit() {
    if (!reason) return;
    await reportMember(memberId, reason, details);
    setSubmitted(true);
  }

  if (submitted) {
    return (
      <Screen title="Thank you for telling us">
        <Card>
          <Text className="text-neutral-700">
            Our safety team is reviewing your report. The member isn’t told who reported them.
          </Text>
        </Card>
        <Button label="Done" onPress={() => router.back()} />
      </Screen>
    );
  }

  return (
    <Screen title="Report this member" subtitle="What happened?">
      {(Object.keys(REPORT_REASON_LABELS) as ReportReason[]).map((key) => (
        <Button
          key={key}
          label={REPORT_REASON_LABELS[key]}
          variant={reason === key ? "primary" : "secondary"}
          onPress={() => setReason(key)}
        />
      ))}
      <Field label="Anything else we should know? (optional)" multiline value={details} onChangeText={setDetails} />
      <Button label="Send report" disabled={!reason} onPress={handleSubmit} />
    </Screen>
  );
}
