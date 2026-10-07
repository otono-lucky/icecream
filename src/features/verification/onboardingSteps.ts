import type { Me, OnboardingStep } from "@contracts";
import { router } from "expo-router";
import { useCallback } from "react";

import { useSession } from "@/features/auth";
import { routes } from "@/shared/navigation/routes";

/** The screen for each server-computed step. `done` has none: the session moves the member into the app. */
export const STEP_ROUTES: Record<Exclude<OnboardingStep, "done">, string> = {
  "age-gate": routes.ageGate,
  "basic-details": routes.basicDetails,
  photos: routes.photos,
  liveness: routes.liveness,
  "id-verification": routes.idVerification,
  pending: routes.verificationPending,
  ineligible: routes.notEligible,
};

// Steps the member shouldn't be able to go back from.
const TERMINAL_STEPS: OnboardingStep[] = ["pending", "ineligible"];

// The screens in the order a member moves through them.
const FLOW: Exclude<OnboardingStep, "done" | "ineligible">[] = [
  "age-gate",
  "basic-details",
  "photos",
  "liveness",
  "id-verification",
  "pending",
];

/**
 * Stores the server's latest Me and moves on.
 *
 * With `from`, Continue goes to the next screen in order, so a member who has stepped back sees each
 * finished step again (with their saved answers) instead of being thrown to the first unfinished one.
 * It never goes further than the server allows: an unfinished step, or ineligible/done, always wins.
 */
export function useAdvanceOnboarding() {
  const { setMe } = useSession();

  return useCallback(
    (me: Me, from?: OnboardingStep) => {
      setMe(me);
      const serverStep = me.onboarding.nextStep;
      if (serverStep === "done") return;

      let target: Exclude<OnboardingStep, "done"> = serverStep;
      if (from && serverStep !== "ineligible" && from !== "ineligible" && from !== "done") {
        const inOrder = FLOW[FLOW.indexOf(from) + 1];
        if (inOrder && FLOW.indexOf(inOrder) < FLOW.indexOf(serverStep)) target = inOrder;
      }
      if (TERMINAL_STEPS.includes(target)) router.replace(STEP_ROUTES[target]);
      else router.push(STEP_ROUTES[target]);
    },
    [setMe],
  );
}

// Steps a member can move back through, in order. Pending and ineligible have no way back.
const BACKABLE_STEPS = ["age-gate", "basic-details", "photos", "liveness", "id-verification"] as const;
type BackableStep = (typeof BACKABLE_STEPS)[number];

/**
 * The back arrow for an onboarding step. Goes back through history when there is some, and
 * otherwise to the previous step, because a resumed step (after a reload, or straight after
 * sign-in) is the first screen in the stack. The first step has no way back.
 */
export function onboardingBack(step: BackableStep): (() => void) | undefined {
  if (router.canGoBack()) return () => router.back();
  const previous = BACKABLE_STEPS[BACKABLE_STEPS.indexOf(step) - 1];
  return previous ? () => router.replace(STEP_ROUTES[previous]) : undefined;
}
