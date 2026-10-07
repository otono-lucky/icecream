import {
  PROFILE_SECTIONS,
  type ChildrenLiveWith,
  type Faith,
  type FaithPractice,
  type LookingFor,
  type MaritalStatus,
  type PartnerFaithImportance,
  type ProfileSection,
} from "@contracts";

import type { IconName } from "@/shared/ui";

type SectionInfo = {
  title: string;
  /** Under the title in the intro checklist. */
  blurb: string;
  icon: IconName;
  /** Under the progress bar while building, e.g. "Section 1 of 6 • Personal background". */
  theme: string;
  /** Small caps heading on the Me tab's Profile details cards. */
  detailsLabel: string;
};

export const SECTION_INFO: Record<ProfileSection, SectionInfo> = {
  "marital-history": {
    title: "Marital history",
    blurb: "Understanding your situation",
    icon: "script-text-outline",
    theme: "Personal background",
    detailsLabel: "Marital history",
  },
  children: {
    title: "Children",
    blurb: "Family context & future openness",
    icon: "account-group-outline",
    theme: "Family & children",
    detailsLabel: "Children",
  },
  faith: {
    title: "Faith",
    blurb: "Religious beliefs & practice",
    icon: "white-balance-sunny",
    theme: "Faith & values",
    detailsLabel: "Faith & values",
  },
  location: {
    title: "Where you live",
    blurb: "Current city & relocation willingness",
    icon: "map-marker-outline",
    theme: "Location & mobility",
    detailsLabel: "Residence & mobility",
  },
  work: {
    title: "Work and daily life",
    blurb: "Profession & typical weekly rhythm",
    icon: "briefcase-outline",
    theme: "Career & routine",
    detailsLabel: "Work & daily rhythm",
  },
  "looking-for": {
    title: "What you’re looking for",
    blurb: "Relationship goals & values",
    icon: "star-four-points-outline",
    theme: "Intentions & partnership",
    detailsLabel: "Intentions & preferences",
  },
};

export const sectionNumber = (section: ProfileSection) => PROFILE_SECTIONS.indexOf(section) + 1;

export const isSection = (value: string | undefined): value is ProfileSection =>
  PROFILE_SECTIONS.includes(value as ProfileSection);

// The answer cards' second lines, as designed.
export const MARITAL_HINTS: Record<MaritalStatus, string> = {
  never_married: "Lifelong single individual",
  divorced: "Legally dissolved prior union",
  separated: "Living independently pending finalisation",
  widowed: "Partner deceased",
};

export const LIVE_WITH_HINTS: Record<ChildrenLiveWith, string> = {
  all: "Full-time living under the same roof",
  some: "Shared parenting or partial custody",
  none: "Adults or based with another parent",
};

export const FAITH_OPTIONS: Record<Faith, { hint: string; icon: IconName }> = {
  christian: { hint: "Catholic, Protestant, Evangelical, Anglican & other denominations", icon: "church" },
  muslim: { hint: "Sunni, Shia, and personal Islamic observance", icon: "mosque" },
  traditional: { hint: "Indigenous ancestral philosophies and customs", icon: "home-variant-outline" },
  other: { hint: "Spiritual or ecumenical belief systems", icon: "star-four-points-outline" },
  none: { hint: "Secular, humanist, or agnostic perspective", icon: "infinity" },
};

export const PRACTICE_HINTS: Record<FaithPractice, string> = {
  devout: "Central to daily choices, leadership, and community gatherings",
  practising: "Regular prayer, service attendance, and living by spiritual tenets",
  occasional: "Festival seasons, family milestones, and contemplative moments",
  not_religious: "Guided primarily by personal philosophy and secular ethics",
};

export const PARTNER_FAITH_OPTIONS: Record<PartnerFaithImportance, { hint: string; icon: IconName }> = {
  must_match: { hint: "Essential requirement for shared worship & home unity", icon: "lock-outline" },
  prefer_match: { hint: "Strong preference, but open to sincere mutual respect", icon: "heart-outline" },
  doesnt_matter: { hint: "Character, honor, and shared life vision take precedence", icon: "handshake-outline" },
};

export const LOOKING_FOR_OPTIONS: Record<LookingFor, { hint: string; icon: IconName }> = {
  marriage: { hint: "Lifelong, solemn legal and personal union", icon: "ring" },
  committed: { hint: "Exclusive, devoted companionship with mutual growth", icon: "heart-outline" },
  companionship: { hint: "Shared companionship, social harmony, and deep friendship", icon: "account-group-outline" },
};
