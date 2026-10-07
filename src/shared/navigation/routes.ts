/**
 * Every cross-feature navigation target lives here, so features never hard-code
 * each other's URLs and a route can move without hunting through the codebase.
 */
export const routes = {
  welcome: "/welcome",
  signIn: "/sign-in",
  otp: (to: string) => ({ pathname: "/otp", params: { to } }) as const,

  ageGate: "/age-gate",
  basicDetails: "/basic-details",
  photos: "/photos",
  liveness: "/liveness",
  idVerification: "/id-verification",
  verificationPending: "/verification-pending",
  notEligible: "/not-eligible",

  // The profile screens open both while verification is pending and after approval.
  profileIntro: "/profile-intro",
  profileSection: (section: string) => ({ pathname: "/profile-section/[section]", params: { section } }) as const,
  editProfile: (section: string) =>
    ({ pathname: "/profile-section/[section]", params: { section, mode: "edit" } }) as const,
  profilePreview: "/profile-preview",
  editPhotos: "/edit-photos",
  addId: "/add-id",

  home: "/",
  me: "/me",
  filters: "/filters",
  member: (id: string) => ({ pathname: "/member/[id]", params: { id } }) as const,
  chat: (memberId: string) => ({ pathname: "/chat/[memberId]", params: { memberId } }) as const,
  paywall: (memberId: string, memberName: string) =>
    ({ pathname: "/paywall", params: { memberId, memberName } }) as const,
  report: (memberId: string) => ({ pathname: "/report", params: { memberId } }) as const,

  settings: "/settings",
  subscription: "/settings/subscription",
  paymentHistory: "/settings/payment-history",
  privacy: "/settings/privacy",
} as const;
