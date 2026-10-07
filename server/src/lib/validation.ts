import type { Context } from "hono";
import type { z } from "zod";

import { ApiError } from "./errors";

export async function parseJson<T extends z.ZodType>(c: Context, schema: T): Promise<z.infer<T>> {
  const body: unknown = await c.req.json().catch(() => undefined);
  const result = schema.safeParse(body);
  if (!result.success) {
    const issue = result.error.issues[0];
    const field = issue?.path.join(".");
    throw new ApiError(400, "invalid_request", field ? `${field}: ${issue.message}` : "Invalid request body.");
  }
  return result.data;
}
