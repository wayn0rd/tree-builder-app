// Convex Auth configuration — spec D2 (Google front door), D10 (env-gated
// test-login provider), F8 (auth actions).
//
// T-S1 guard: the `test-login` provider is registered ONLY when the Convex
// deployment env var E2E_TEST_SECRET is set. Production never sets it (H5).

import Google from '@auth/core/providers/google';
import {
  convexAuth,
  createAccount,
  retrieveAccount,
} from '@convex-dev/auth/server';
import { ConvexCredentials } from '@convex-dev/auth/providers/ConvexCredentials';
import type { DataModel } from './_generated/dataModel';

// D10: credentials-style provider taking { email, secret }. Signs in
// (creating if needed) the user with that email iff `secret` equals the
// deployment env var E2E_TEST_SECRET. Any other secret — or the env var
// being unset — fails sign-in.
const testLogin = ConvexCredentials<DataModel>({
  id: 'test-login',
  authorize: async (credentials, ctx) => {
    const secret = process.env.E2E_TEST_SECRET;
    if (!secret) return null; // env var unset → always fail (D10)
    if (
      typeof credentials.secret !== 'string' ||
      credentials.secret !== secret
    ) {
      return null;
    }
    if (typeof credentials.email !== 'string') return null;
    const email = credentials.email.trim().toLowerCase();
    if (!email) return null;

    // Get-or-create the account keyed by email for this provider.
    try {
      const retrieved = await retrieveAccount(ctx, {
        provider: 'test-login',
        account: { id: email },
      });
      if (retrieved !== null) {
        return { userId: retrieved.user._id };
      }
    } catch {
      // Fall through to account creation.
    }
    const created = await createAccount(ctx, {
      provider: 'test-login',
      account: { id: email },
      profile: { email },
    });
    return { userId: created.user._id };
  },
});

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [
    Google,
    // T-S1: registration of test-login is guarded on E2E_TEST_SECRET.
    ...(process.env.E2E_TEST_SECRET ? [testLogin] : []),
  ],
});
