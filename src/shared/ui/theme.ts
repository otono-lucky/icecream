import tokens from "./tokens.json";

/** Hex values for props that can't take a className (icon colours, gradients). */
export const colors = {
  wine: tokens.colors.wine.DEFAULT,
  wineDark: tokens.colors.wine.dark,
  ivory: tokens.colors.ivory,
  sand: tokens.colors.sand.DEFAULT,
  ink: tokens.colors.ink.DEFAULT,
  inkMuted: tokens.colors.ink.muted,
  inkFaint: tokens.colors.ink.faint,
  verified: tokens.colors.verified.DEFAULT,
  review: tokens.colors.review.DEFAULT,
  danger: tokens.colors.danger.DEFAULT,
  white: tokens.colors.white,
} as const;

export type ColorName = keyof typeof colors;
