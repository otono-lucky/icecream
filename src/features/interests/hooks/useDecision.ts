import type { Decision, MemberCard } from "@contracts";
import { useState } from "react";

import { errorMessage } from "@/shared/lib/apiClient";

import { decideOn } from "../api/interestsApi";

/** A member card plus the viewer's decision about it, kept in sync with the server. */
export function useDecision(member: MemberCard) {
  const [card, setCard] = useState(member);
  const [saving, setSaving] = useState<Decision>();
  const [error, setError] = useState<string>();

  /** Resolves true once saved. */
  async function decide(decision: Decision): Promise<boolean> {
    if (saving) return false;
    if (card.decision === decision) return true;
    setSaving(decision);
    setError(undefined);
    try {
      setCard(await decideOn(card.id, decision));
      return true;
    } catch (e) {
      setError(errorMessage(e));
      return false;
    } finally {
      setSaving(undefined);
    }
  }

  return { card, decide, saving, error };
}
