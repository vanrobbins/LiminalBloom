"use server";

// Changing your own password (0.7.0 task 11, DECISIONS 11-02). Better Auth's browser route
// /change-password is closed (lib/auth.ts), because only the server call can be made to
// always revoke the person's other sessions: a leaked password must not leave an old
// session open. Any signed-in member may do this, whatever their role, so the guard is
// requireMember rather than a switch (app/server-actions-guard.test.ts lists the reason).

import { APIError } from "better-auth/api";
import { headers } from "next/headers";

import { auth } from "@/lib/auth";
import { applyAuthCookies } from "@/lib/auth-cookies";
import { keepShortSessionShort } from "@/lib/change-password";
import { requireMember } from "@/lib/current-member";
import { claimGuess, clearWrongGuesses } from "@/lib/password-guesses";
import { MAX_PASSWORD, MIN_PASSWORD } from "@/lib/password-limits";

export type PasswordReply = { status: "saved"; message: string } | { status: "refused"; message: string; field?: "current" | "new" | "confirm" };

const refuse = (message: string, field?: "current" | "new" | "confirm"): PasswordReply => ({ status: "refused", message, field });

export async function changePasswordAction(currentPassword: unknown, newPassword: unknown, confirmPassword: unknown): Promise<PasswordReply> {
  const { user } = await requireMember();
  if (typeof currentPassword !== "string" || currentPassword === "" || currentPassword.length > MAX_PASSWORD) return refuse("Enter your current password.", "current");
  if (typeof newPassword !== "string" || newPassword.length < MIN_PASSWORD) return refuse(`Use at least ${MIN_PASSWORD} characters.`, "new");
  if (newPassword.length > MAX_PASSWORD) return refuse(`Use at most ${MAX_PASSWORD} characters.`, "new");
  if (newPassword !== confirmPassword) return refuse("The two new passwords don't match.", "confirm");
  if (newPassword === currentPassword) return refuse("Choose a password different from your current one.", "new");

  // Server-side calls skip Better Auth's HTTP rate limiter, so wrong guesses are limited here
  // (lib/password-guesses.ts): the try is counted before Better Auth is asked anything.
  if (!(await claimGuess(user.id))) return refuse("Too many tries. Try again in a few minutes.");

  const requestHeaders = await headers();
  let result: { headers: Headers; response: { token: string | null } };
  try {
    result = await auth.api.changePassword({
      body: { currentPassword, newPassword, revokeOtherSessions: true },
      headers: requestHeaders,
      returnHeaders: true,
    });
  } catch (error) {
    if (error instanceof APIError && error.body?.code === "INVALID_PASSWORD") {
      return refuse("That isn't your current password.", "current");
    }
    // Not Better Auth's own message: it can name server configuration.
    return refuse("Couldn't change the password. Try again.");
  }
  // The password is changed: nothing below may fail the change, or the person would be told it failed.
  try {
    await clearWrongGuesses(user.id);
    if (typeof result.response.token === "string") await keepShortSessionShort(result.response.token, requestHeaders);
  } catch (error) {
    console.error("change password: follow-up steps failed", error);
  }
  // Better Auth deleted every session of this person, this one too, and started a new one:
  // its cookie has to reach the browser or the person is signed out as well.
  await applyAuthCookies(result.headers);
  return { status: "saved", message: "Password changed. Your other sessions were signed out." };
}
