"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  ACCESS_COOKIE,
  RETURN_COOKIE,
  accessToken,
  passwordMatches,
  safeDestination,
} from "@/lib/server/access";

export type UnlockState = { error: string | null };

export async function unlockAction(
  _previous: UnlockState,
  formData: FormData,
): Promise<UnlockState> {
  const password = String(formData.get("password") ?? "");
  if (!passwordMatches(password)) {
    return { error: "That password is not correct." };
  }

  const jar = await cookies();
  jar.set(ACCESS_COOKIE, await accessToken(), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });

  // The middleware recorded where the visitor was heading before the gate.
  const destination = safeDestination(jar.get(RETURN_COOKIE)?.value);
  jar.delete(RETURN_COOKIE);
  redirect(destination);
}
