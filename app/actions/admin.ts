"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";

export async function markCollected(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("orderId") ?? "");
  await db.order.updateMany({ where: { id, status: "READY" }, data: { status: "COLLECTED", collectedAt: new Date() } });
  revalidatePath("/admin");
}

/** Send a FAILED (or already printed) order back to the printer queue. */
export async function reprintOrder(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("orderId") ?? "");
  await db.order.updateMany({
    where: { id, status: { in: ["FAILED", "READY"] } },
    data: { status: "PAID", attempts: 0, failureReason: null, readyAt: null },
  });
  revalidatePath("/admin");
}

export async function updateSettings(formData: FormData) {
  await requireAdmin();
  const int = (name: string, min: number, max: number) => {
    const n = Number(formData.get(name));
    if (!Number.isInteger(n) || n < min || n > max) throw new Error(`Invalid ${name}`);
    return n;
  };
  const rateRupees = Number(formData.get("rateRupees"));
  if (!Number.isFinite(rateRupees) || rateRupees <= 0 || rateRupees > 100) throw new Error("Invalid rate");
  await db.settings.upsert({
    where: { id: 1 },
    create: { id: 1 },
    update: {
      ratePerPagePaise: Math.round(rateRupees * 100),
      maxCopies: int("maxCopies", 1, 10),
      maxFileMB: int("maxFileMB", 1, 100),
      maxPages: int("maxPages", 1, 2000),
    },
  });
  revalidatePath("/admin");
}

export async function setAcceptingOrders(formData: FormData) {
  await requireAdmin();
  const accepting = formData.get("accepting") === "true";
  await db.settings.upsert({ where: { id: 1 }, create: { id: 1, acceptingOrders: accepting }, update: { acceptingOrders: accepting } });
  revalidatePath("/admin");
}

export async function setUserBlocked(formData: FormData) {
  const admin = await requireAdmin();
  const id = String(formData.get("userId") ?? "");
  const blocked = formData.get("blocked") === "true";
  if (id === admin.id) throw new Error("You can't block yourself");
  await db.user.update({ where: { id }, data: { blocked } });
  if (blocked) await db.session.deleteMany({ where: { userId: id } });
  revalidatePath("/admin/users");
}
