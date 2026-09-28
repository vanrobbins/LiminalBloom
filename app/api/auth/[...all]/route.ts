// Every authentication request lands here: sign-up, sign-in, sign-out,
// session checks, organization calls. The [...all] folder name is a catch-all,
// so /api/auth/anything routes to this one file and Better Auth decides what
// to do with it.

import { toNextJsHandler } from "better-auth/next-js";

import { auth } from "@/lib/auth";

export const { GET, POST } = toNextJsHandler(auth);
