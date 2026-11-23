// Every authentication request lands here: sign-up, sign-in, sign-out,
// session checks, organization calls. The [...all] folder name is a catch-all,
// so /api/auth/anything routes to this one file and Better Auth decides what
// to do with it.
//
// A closed path (lib/auth-closed-paths.ts) is answered 404 here, in any spelling (case, a trailing
// or doubled slash, percent-encoding), before Better Auth's per-IP rate limiter counts it: Better
// Auth's own `disabledPaths` matches only the exact spelling, so the others would reach the limiter
// (3 per 10 s under /two-factor/*) and get 429 instead of 404.

import { toNextJsHandler } from "better-auth/next-js";

import { auth } from "@/lib/auth";
import { isClosedAuthPath } from "@/lib/auth-closed-paths";

const handlers = toNextJsHandler(auth);

const refuseClosed = (handler: (request: Request) => Promise<Response>) => (request: Request) =>
  isClosedAuthPath(new URL(request.url).pathname) ? Promise.resolve(new Response("Not Found", { status: 404 })) : handler(request);

export const GET = refuseClosed(handlers.GET);
export const POST = refuseClosed(handlers.POST);
