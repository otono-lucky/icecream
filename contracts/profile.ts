export type MaritalStatus = "never_married" | "divorced" | "separated" | "widowed";
export type YesMaybeNo = "yes" | "maybe" | "no";
export type ChildrenLiveWith = "all" | "some" | "none";
export type Faith = "christian" | "muslim" | "traditional" | "other" | "none";
export type FaithPractice = "devout" | "practising" | "occasional" | "not_religious";
export type PartnerFaithImportance = "must_match" | "prefer_match" | "doesnt_matter";
export type LookingFor = "marriage" | "committed" | "companionship";

export const PROFILE_SECTIONS = ["marital-history", "children", "faith", "location", "work", "looking-for"] as const;
export type ProfileSection = (typeof PROFILE_SECTIONS)[number];

/** A member's profile answers. Null until that section is answered. */
export type ProfileAnswers = {
  maritalStatus: MaritalStatus | null;
  hasChildren: boolean | null;
  childrenCount: number | null;
  childrenLiveWith: ChildrenLiveWith | null;
  openToPartnerWithChildren: YesMaybeNo | null;
  faith: Faith | null;
  faithPractice: FaithPractice | null;
  partnerFaithImportance: PartnerFaithImportance | null;
  relocate: YesMaybeNo | null;
  occupation: string | null;
  typicalWeek: string | null;
  lookingFor: LookingFor | null;
  ownWords: string | null;
};

export type MyProfile = {
  answers: ProfileAnswers;
  /** Sections fully answered, in PROFILE_SECTIONS order. */
  sectionsDone: ProfileSection[];
  /** Published profiles are the ones introduced to other members. */
  publishedAt: number | null;
};

/** Request bodies for PUT /v1/me/profile/:section. */
export type ProfileSectionBody = {
  "marital-history": { maritalStatus: MaritalStatus };
  children: {
    hasChildren: boolean;
    childrenCount?: number;
    childrenLiveWith?: ChildrenLiveWith;
    openToPartnerWithChildren: YesMaybeNo;
  };
  faith: { faith: Faith; faithPractice: FaithPractice; partnerFaithImportance: PartnerFaithImportance };
  location: { city?: string; relocate: YesMaybeNo };
  work: { occupation: string; typicalWeek?: string };
  "looking-for": { lookingFor: LookingFor; ownWords?: string };
};

export const MAX_TYPICAL_WEEK = 300;
export const MAX_OWN_WORDS = 500;

// Wording reviewed for dignity (PRD 4.2): plain words, no euphemism.
export const LABELS = {
  maritalStatus: { never_married: "Never married", divorced: "Divorced", separated: "Separated", widowed: "Widowed" },
  childrenLiveWith: {
    all: "Yes, all of them",
    some: "Some of them",
    none: "No, they live elsewhere or are grown",
  },
  yesMaybeNo: { yes: "Yes", maybe: "Maybe", no: "No" },
  relocate: { yes: "Yes", maybe: "Maybe, for the right person", no: "No" },
  faith: { christian: "Christian", muslim: "Muslim", traditional: "Traditional", other: "Other", none: "No religion" },
  faithPractice: { devout: "Devout", practising: "Practising", occasional: "Occasionally", not_religious: "Not religious" },
  partnerFaithImportance: {
    must_match: "It must match mine",
    prefer_match: "I'd prefer it to match",
    doesnt_matter: "It doesn't matter to me",
  },
  lookingFor: { marriage: "Marriage", committed: "A committed relationship", companionship: "Companionship" },
} as const;
