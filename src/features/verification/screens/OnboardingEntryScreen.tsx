import { Redirect } from "expo-router";

import { useMe } from "@/features/auth";

import { STEP_ROUTES } from "../onboardingSteps";

/** Entry point of the onboarding group: resumes wherever the server says the member is. */
export function OnboardingEntryScreen() {
  const { nextStep } = useMe().onboarding;
  return nextStep === "done" ? null : <Redirect href={STEP_ROUTES[nextStep]} />;
}
