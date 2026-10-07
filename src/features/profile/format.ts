import { LABELS, type ProfileAnswers, type ProfileSection } from "@contracts";

import type { IconName } from "@/shared/ui";

/** Whose profile a sentence is about: the member's own ("me"), or another member's ("her"/"him"). */
export type Pronoun = "me" | "her" | "him";

const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? "" : "ren"}`;

function liveWith(answers: ProfileAnswers, who: Pronoun) {
  const count = answers.childrenCount ?? 0;
  switch (answers.childrenLiveWith) {
    case "all":
      return count === 1 ? `lives with ${who}` : count === 2 ? `both live with ${who}` : `all live with ${who}`;
    case "some":
      return `some live with ${who}`;
    case "none":
      return "live elsewhere or are grown";
    default:
      return null;
  }
}

/** "Has 2 children (both live with me)", or "No children". */
export function childrenLine(answers: ProfileAnswers, who: Pronoun): string | null {
  if (answers.hasChildren === null) return null;
  if (!answers.hasChildren) return "No children";
  const where = liveWith(answers, who);
  return `Has ${plural(answers.childrenCount ?? 0, "child")}${where ? ` (${where})` : ""}`;
}

export function partnerChildrenLine(answers: ProfileAnswers): string | null {
  switch (answers.openToPartnerWithChildren) {
    case "yes":
      return "Open to partner with children";
    case "maybe":
      return "Maybe open to partner with children";
    case "no":
      return "Prefers partner without children";
    default:
      return null;
  }
}

/** "Christian (Practising)". */
export function faithLine(answers: ProfileAnswers): string | null {
  if (!answers.faith) return null;
  if (answers.faith === "none") return LABELS.faith.none;
  const practice = answers.faithPractice ? ` (${LABELS.faithPractice[answers.faithPractice]})` : "";
  return `${LABELS.faith[answers.faith]}${practice}`;
}

export function partnerFaithLine(answers: ProfileAnswers): string | null {
  switch (answers.partnerFaithImportance) {
    case "must_match":
      return "Partner’s faith must match";
    case "prefer_match":
      return "Prefers partner’s faith to match";
    case "doesnt_matter":
      return "Partner’s faith doesn’t matter";
    default:
      return null;
  }
}

export function relocateLine(answers: ProfileAnswers): string | null {
  switch (answers.relocate) {
    case "yes":
      return "Open to relocate";
    case "maybe":
      return "Open to relocate for the right person";
    case "no":
      return "Not looking to relocate";
    default:
      return null;
  }
}

const join = (...parts: (string | null | undefined)[]) => parts.filter(Boolean).join(" • ");

/** One section's answers in a line or two, for the Me tab and the preview. Null when unanswered. */
export function sectionSummary(section: ProfileSection, answers: ProfileAnswers, city: string | null): string | null {
  switch (section) {
    case "marital-history":
      return answers.maritalStatus ? LABELS.maritalStatus[answers.maritalStatus] : null;
    case "children":
      return answers.hasChildren === null ? null : join(childrenLine(answers, "me"), partnerChildrenLine(answers));
    case "faith":
      return answers.faith ? join(faithLine(answers), partnerFaithLine(answers)) : null;
    case "location":
      return answers.relocate ? join(city, relocateLine(answers)) : null;
    case "work":
      return answers.occupation ? join(answers.occupation, answers.typicalWeek) : null;
    case "looking-for":
      return answers.lookingFor ? join(LABELS.lookingFor[answers.lookingFor], answers.ownWords) : null;
  }
}

export type Fact = { icon: IconName; label: string };

/** The key facts shown as chips under a member's name. */
export function profileFacts(answers: ProfileAnswers, who: Pronoun): Fact[] {
  const facts: Fact[] = [];
  if (answers.maritalStatus) facts.push({ icon: "heart-outline", label: LABELS.maritalStatus[answers.maritalStatus] });
  if (answers.hasChildren === false) facts.push({ icon: "human-male-female-child", label: "No children" });
  if (answers.hasChildren && answers.childrenCount) {
    const living = answers.childrenLiveWith === "all" ? `, live with ${who}` : "";
    facts.push({ icon: "human-male-female-child", label: `${plural(answers.childrenCount, "child")}${living}` });
  }
  if (answers.faith) {
    const practice = answers.faith !== "none" && answers.faithPractice ? ` · ${LABELS.faithPractice[answers.faithPractice]}` : "";
    facts.push({ icon: "hands-pray", label: `${LABELS.faith[answers.faith]}${practice}` });
  }
  if (answers.relocate === "yes" || answers.relocate === "maybe") {
    facts.push({ icon: "map-marker-radius-outline", label: answers.relocate === "yes" ? "Open to relocate" : "May relocate" });
  }
  return facts;
}

/** A few facts on one line for the Today card, e.g. "Divorced · 2 children · Christian". */
export function shortFacts(answers: ProfileAnswers): string {
  const children =
    answers.hasChildren === false ? "No children" : answers.childrenCount ? plural(answers.childrenCount, "child") : null;
  return [
    answers.maritalStatus && LABELS.maritalStatus[answers.maritalStatus],
    children,
    answers.faith && LABELS.faith[answers.faith],
  ]
    .filter(Boolean)
    .join(" · ");
}
