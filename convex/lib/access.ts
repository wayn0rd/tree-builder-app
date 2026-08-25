// Access-control helpers — spec D3 (admin email constant), D4 (server-side
// whitelist enforcement), §3 gate rule.

import { getAuthUserId } from '@convex-dev/auth/server';
import type { Doc, Id } from '../_generated/dataModel';
import type { MutationCtx, QueryCtx } from '../_generated/server';

// D3: frozen constant; not a secret. Exactly one admin this cycle.
export const ADMIN_EMAIL = 'trixiematic415@gmail.com';

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export interface CallerStatus {
  userId: Id<'users'>;
  user: Doc<'users'>;
  email: string;
  isAdmin: boolean;
  isWhitelisted: boolean;
}

/** Resolve the caller from auth context; null when unauthenticated. */
export async function callerStatus(
  ctx: QueryCtx | MutationCtx
): Promise<CallerStatus | null> {
  const userId = await getAuthUserId(ctx);
  if (userId === null) return null;
  const user = await ctx.db.get(userId);
  if (user === null) return null;
  const email = normalizeEmail(user.email ?? '');
  // D3: admin by case-insensitive email match, implicitly whitelisted.
  const isAdmin = email !== '' && email === ADMIN_EMAIL;
  let isWhitelisted = isAdmin;
  if (!isWhitelisted && email !== '') {
    const row = await ctx.db
      .query('whitelist')
      .withIndex('by_email', (q) => q.eq('email', email))
      .unique();
    isWhitelisted = row !== null;
  }
  return { userId, user, email, isAdmin, isWhitelisted };
}

/**
 * §3 gate rule: every protected function rejects when the caller is
 * unauthenticated OR authenticated-but-not-whitelisted (re-checked on every
 * invocation, D4).
 */
export async function requireWhitelisted(
  ctx: QueryCtx | MutationCtx
): Promise<CallerStatus> {
  const status = await callerStatus(ctx);
  if (status === null) {
    throw new Error('Not signed in');
  }
  if (!status.isWhitelisted) {
    throw new Error('Not on the invite list');
  }
  return status;
}

/** F5: admin-only gate (rejects for whitelisted non-admins too). */
export async function requireAdmin(
  ctx: QueryCtx | MutationCtx
): Promise<CallerStatus> {
  const status = await requireWhitelisted(ctx);
  if (!status.isAdmin) {
    throw new Error('Admin only');
  }
  return status;
}
