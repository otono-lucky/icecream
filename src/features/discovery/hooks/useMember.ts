import { useAsync } from "@/shared/lib/useAsync";

import { getMember } from "../api/discoveryApi";

export function useMember(id: string) {
  return useAsync(() => getMember(id), [id]);
}
