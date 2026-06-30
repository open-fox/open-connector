import type { Context, MiddlewareHandler } from "hono";

import { getCookie, setCookie } from "hono/cookie";
import { jsonError } from "./http-utils.ts";

const authCookieName = "oomol_connect_api_token";

/**
 * Optional local API authentication for HTTP, web console, and MCP callers.
 */
export type LocalAuthOptions = {
  token?: string;
};

export function createLocalAuthMiddleware(options: LocalAuthOptions): MiddlewareHandler {
  const token = options.token?.trim();
  if (!token) {
    return async (_context, next) => {
      await next();
    };
  }

  return async (context, next) => {
    if (isPublicPath(context.req.path) || hasValidToken(context, token)) {
      await next();
      return;
    }

    return jsonError(context, 401, "unauthorized", "A valid local API token is required.");
  };
}

export function installLocalAuthCookie(context: Context, options: LocalAuthOptions): void {
  const token = options.token?.trim();
  if (!token) {
    return;
  }

  setCookie(context, authCookieName, token, {
    httpOnly: true,
    sameSite: "Strict",
    secure: context.req.url.startsWith("https://"),
    path: "/",
  });
}

function isPublicPath(path: string): boolean {
  return path === "/health" || path.startsWith("/oauth/callback/");
}

function hasValidToken(context: Context, token: string): boolean {
  const authorization = context.req.header("authorization") ?? "";
  if (authorization === `Bearer ${token}`) {
    return true;
  }

  return getCookie(context, authCookieName) === token;
}
