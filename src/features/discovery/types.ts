import type { MaritalStatus } from "@contracts";

export type DiscoveryFilters = {
  minAge: number;
  maxAge: number;
  cities: string[];
  faiths: string[];
  maritalStatuses: MaritalStatus[];
  hasChildren?: boolean;
};
