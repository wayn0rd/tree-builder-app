// users.me — spec F1: public query; null when unauthenticated, otherwise
// { email, isAdmin, isWhitelisted } for the caller (admin ⇒ both flags true
// regardless of whitelist table contents, D3).

import { query } from './_generated/server';
import { callerStatus } from './lib/access';

export const me = query({
  args: {},
  handler: async (ctx) => {
    const status = await callerStatus(ctx);
    if (status === null) return null;
    return {
      email: status.email,
      isAdmin: status.isAdmin,
      isWhitelisted: status.isWhitelisted,
    };
  },
});
