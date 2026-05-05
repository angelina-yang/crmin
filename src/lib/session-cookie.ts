// Edge-runtime safe constant. Anything imported by middleware.ts must avoid
// Node-only modules like `node:crypto` and `next/headers` cookies(), so we
// keep the cookie name in its own file that the middleware can import.
export const SESSION_COOKIE = "crmin_session";
