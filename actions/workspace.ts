"use server";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { ACTIVE_TRIP_COOKIE, ALL_TRIPS } from "@/lib/config";
import { fail, ok } from "@/actions/_util";
import type { ActionResult } from "@/lib/types";

export async function setActiveTrip(value: string): Promise<ActionResult> {
  try {
    await requireUser();
    const v = value === ALL_TRIPS ? ALL_TRIPS : z.uuid().parse(value);
    const store = await cookies();
    store.set(ACTIVE_TRIP_COOKIE, v, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax", httpOnly: true, secure: process.env.NODE_ENV === "production" });
    revalidatePath("/", "layout");
    return ok();
  } catch (e) {
    return fail(e);
  }
}
