"use server";

// Changing roles (spec 0.7, 4.7 and 4.8). Each action starts with the roles.manage
// guard and then hands the person's own rank and permissions to the writes in
// lib/access/roles-*.ts, which refuse what they must however the call was made:
// hiding a control is a courtesy. The store is the session's active store (CODESTYLE
// rule 8), never a requested one. Every argument is parsed here before use.

import { z } from "zod";

import { actorOf } from "@/lib/access/people";
import { deleteRole, type DeleteOutcome } from "@/lib/access/roles-delete";
import { createRole, moveRole, renameRole, type CreateOutcome, type MoveOutcome, type RenameOutcome } from "@/lib/access/roles-structure";
import { setRequiresTwoFactor, type RequireTwoFactorOutcome } from "@/lib/access/roles-two-factor";
import { resetRole, saveSwitches, type ResetOutcome, type SaveOutcome } from "@/lib/access/roles-switches";
import type { RolesActor } from "@/lib/access/roles-write";
import { SWITCHES } from "@/lib/access/switches";
import { requireSwitchForAction, type Member } from "@/lib/current-member";

const id = z.string().min(1).max(200);
const version = z.number().int().min(1).max(2_000_000_000);
const count = z.number().int().min(0).max(100_000);
const switches = z.array(z.enum(SWITCHES)).max(50);

const INVALID = { status: "invalid" } as const;
const FORBIDDEN = { status: "forbidden" } as const;

function actorFor(member: Member): RolesActor {
  return { ...actorOf(member), userId: member.user.id, name: member.user.name };
}

export async function saveSwitchesAction(edits: unknown): Promise<SaveOutcome> {
  const check = await requireSwitchForAction("roles.manage");
  if (check.status === "forbidden") return FORBIDDEN;
  const parsed = z.array(z.object({ roleId: id, version, switches })).min(1).max(100).safeParse(edits);
  if (!parsed.success) return INVALID;
  return saveSwitches(check.member.activeStoreId, actorFor(check.member), parsed.data);
}

export async function requireTwoFactorAction(roleId: unknown, expectedVersion: unknown, on: unknown): Promise<RequireTwoFactorOutcome> {
  const check = await requireSwitchForAction("roles.manage");
  if (check.status === "forbidden") return FORBIDDEN;
  const parsed = z.tuple([id, version, z.boolean()]).safeParse([roleId, expectedVersion, on]);
  if (!parsed.success) return INVALID;
  return setRequiresTwoFactor(check.member.activeStoreId, actorFor(check.member), ...parsed.data);
}

export async function createRoleAction(name: unknown, belowId: unknown, chosen: unknown): Promise<CreateOutcome> {
  const check = await requireSwitchForAction("roles.manage");
  if (check.status === "forbidden") return FORBIDDEN;
  const parsed = z.tuple([z.string().max(500), id, switches]).safeParse([name, belowId, chosen]);
  if (!parsed.success) return INVALID;
  const [roleName, below, list] = parsed.data;
  return createRole(check.member.activeStoreId, actorFor(check.member), { name: roleName, belowId: below, switches: list });
}

export async function renameRoleAction(roleId: unknown, expectedVersion: unknown, name: unknown): Promise<RenameOutcome> {
  const check = await requireSwitchForAction("roles.manage");
  if (check.status === "forbidden") return FORBIDDEN;
  const parsed = z.tuple([id, version, z.string().max(500)]).safeParse([roleId, expectedVersion, name]);
  if (!parsed.success) return INVALID;
  return renameRole(check.member.activeStoreId, actorFor(check.member), ...parsed.data);
}

export async function moveRoleAction(roleId: unknown, direction: unknown, neighbourId: unknown): Promise<MoveOutcome> {
  const check = await requireSwitchForAction("roles.manage");
  if (check.status === "forbidden") return FORBIDDEN;
  const parsed = z.tuple([id, z.enum(["up", "down"]), id]).safeParse([roleId, direction, neighbourId]);
  if (!parsed.success) return INVALID;
  return moveRole(check.member.activeStoreId, actorFor(check.member), ...parsed.data);
}

export async function resetRoleAction(roleId: unknown, expectedVersion: unknown): Promise<ResetOutcome> {
  const check = await requireSwitchForAction("roles.manage");
  if (check.status === "forbidden") return FORBIDDEN;
  const parsed = z.tuple([id, version]).safeParse([roleId, expectedVersion]);
  if (!parsed.success) return INVALID;
  return resetRole(check.member.activeStoreId, actorFor(check.member), ...parsed.data);
}

export async function deleteRoleAction(roleId: unknown, expectedVersion: unknown, moveToId: unknown, members: unknown, invitations: unknown): Promise<DeleteOutcome> {
  const check = await requireSwitchForAction("roles.manage");
  if (check.status === "forbidden") return FORBIDDEN;
  const parsed = z.tuple([id, version, id.nullable(), count, count]).safeParse([roleId, expectedVersion, moveToId, members, invitations]);
  if (!parsed.success) return INVALID;
  const [role, v, moveTo, m, i] = parsed.data;
  return deleteRole(check.member.activeStoreId, actorFor(check.member), { roleId: role, version: v, moveToId: moveTo, members: m, invitations: i });
}
