// Convex Auth JWT validation config (standard @convex-dev/auth setup).
export default {
  providers: [
    {
      domain: process.env.CONVEX_SITE_URL,
      applicationID: 'convex',
    },
  ],
};
