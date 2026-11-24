"use client";

import { SessionProvider as Provider } from "next-auth/react";

export function SessionProvider({ children }: { children: React.ReactNode }) {
  // Mounted under /leadcaller: without basePath, next-auth/react calls
  // the DOMAIN-ROOT /api/auth/* routes (the main CRM), so the login
  // form posts this app's credentials to the wrong application and
  // every sign-in fails with "Invalid email or password". Pin the
  // app's own auth routes. (Same fix as foreclosure's SessionProvider.)
  return <Provider basePath="/leadcaller/api/auth">{children}</Provider>;
}
