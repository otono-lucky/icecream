import type { ContentfulStatusCode } from "hono/utils/http-status";

import type { ApiErrorBody } from "../../../contracts";

/** An error the client is meant to see. Anything else becomes a generic 500. */
export class ApiError extends Error {
  constructor(
    readonly status: ContentfulStatusCode,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }

  toBody(): ApiErrorBody {
    return { error: { code: this.code, message: this.message } };
  }
}

export const unauthorized = () => new ApiError(401, "unauthorized", "Please sign in again.");
