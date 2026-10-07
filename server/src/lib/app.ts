import { Hono } from "hono";

export type AppEnv = {
  Bindings: Env;
  Variables: { userId: string };
};

export const createRouter = () => new Hono<AppEnv>();
