import type { MyProfile } from "@contracts";
import { useFocusEffect } from "expo-router";
import { useCallback, useState, useSyncExternalStore } from "react";

import { useMe } from "@/features/auth";
import { errorMessage } from "@/shared/lib/apiClient";

import { getMyProfile } from "../api/profileApi";

// One copy of the member's profile shared by every profile screen, so saving a section on one screen
// shows straight away on the others (Me tab, preview, intro checklist). Keyed by member, so signing in
// as someone else never shows the previous member's answers.
let cached: { userId: string; profile: MyProfile } | undefined;
const listeners = new Set<() => void>();

export function storeMyProfile(userId: string, profile: MyProfile) {
  cached = { userId, profile };
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** The member's profile, fetched again each time a screen using it comes into view. */
export function useMyProfile() {
  const userId = useMe().user.id;
  const snapshot = useSyncExternalStore(subscribe, () => cached);
  const profile = snapshot?.userId === userId ? snapshot.profile : undefined;
  const [error, setError] = useState<string>();

  const reload = useCallback(async () => {
    try {
      storeMyProfile(userId, await getMyProfile());
      setError(undefined);
    } catch (e) {
      setError(errorMessage(e));
    }
  }, [userId]);

  useFocusEffect(
    useCallback(() => {
      void reload();
    }, [reload]),
  );

  const save = useCallback((next: MyProfile) => storeMyProfile(userId, next), [userId]);

  return { profile, error, reload, save };
}
