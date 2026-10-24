"use server";

import { z } from "zod";
import { createServerSupabase } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/session";
import { callRpc } from "@/lib/rpc";
import type { MutationResult } from "@/features/daily-sheets/action-types";

const uuid = z.string().uuid();

const lineInput = z.object({
  id: uuid.optional(),
  product_id: uuid,
  supplier_id: uuid.nullable(),
  purchase_status: z.enum(["purchased", "cancelled", "free_sample"]),
  purchased_quantity: z.string().regex(/^\d{1,9}(\.\d{1,3})?$/, "كمية غير صالحة"),
  basket_unit_price: z
    .string()
    .regex(/^\d{1,9}(\.\d{1,2})?$/, "سعر غير صالح")
    .nullable(),
  note: z.string().max(500).nullable().optional(),
  cancellation_reason: z.string().max(500).nullable().optional(),
  free_reason: z.string().max(500).nullable().optional(),
});

const dispositionInput = z.object({
  disposition_type: z.enum(["store_distribution", "inventory_remaining", "damaged"]),
  store_id: uuid.nullable(),
  quantity: z.string().regex(/^\d{1,9}(\.\d{1,3})?$/, "كمية توزيع غير صالحة"),
  reason: z.string().max(500).nullable().optional(),
});



function normalizeLine(raw: z.infer<typeof lineInput>) {
  const isCancelled = raw.purchase_status === "cancelled";
  return {
    id: raw.id ?? null,
    product_id: raw.product_id,
    supplier_id: raw.supplier_id,
    purchase_status: raw.purchase_status,
    purchased_quantity: raw.purchased_quantity,
    basket_unit_price: isCancelled ? null : raw.basket_unit_price,
    note: raw.note ?? null,
    cancellation_reason: raw.cancellation_reason ?? null,
    free_reason: raw.free_reason ?? null,
  };
}

export async function saveLineAction(input: unknown): Promise<MutationResult<{ lineId: string; version: number }>> {
  const parsed = z
    .object({ revisionId: uuid, expectedVersion: z.number().int().nonnegative(), line: lineInput })
    .safeParse(input);
  if (!parsed.success) return { ok: false, error: "بيانات السطر غير صالحة" };

  try {
    await requireRole(["admin", "worker"]);
    const supabase = await createServerSupabase();
    const result = await callRpc<{ line_id: string; version: number }>(
      supabase,
      "save_purchase_line",
      {
        p_revision_id: parsed.data.revisionId,
        p_expected_version: parsed.data.expectedVersion,
        p_line: normalizeLine(parsed.data.line),
      },
    );
    return { ok: true, data: { lineId: result.line_id, version: result.version } };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "تعذر حفظ السطر" };
  }
}

export async function saveDispositionsAction(
  input: unknown,
): Promise<MutationResult<{ version: number; remaining: string }>> {
  const parsed = z
    .object({
      lineId: uuid,
      expectedVersion: z.number().int().nonnegative(),
      dispositions: z.array(dispositionInput),
    })
    .safeParse(input);
  if (!parsed.success) return { ok: false, error: "بيانات التوزيع غير صالحة" };

  try {
    await requireRole(["admin", "worker"]);
    const supabase = await createServerSupabase();
    const result = await callRpc<{
      allocated_quantity: string | number;
      remaining_quantity: string | number;
      version: number;
    }>(supabase, "replace_line_dispositions", {
      p_line_id: parsed.data.lineId,
      p_expected_version: parsed.data.expectedVersion,
      p_dispositions: parsed.data.dispositions.map((item) => ({
        ...item,
        reason: item.reason ?? null,
      })),
    });
    return {
      ok: true,
      data: { version: result.version, remaining: String(result.remaining_quantity) },
    };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "تعذر حفظ التوزيع" };
  }
}

export async function cancelLineAction(
  input: unknown,
): Promise<MutationResult<{ version: number }>> {
  const parsed = z
    .object({ lineId: uuid, expectedVersion: z.number().int().nonnegative(), reason: z.string().min(1).max(500) })
    .safeParse(input);
  if (!parsed.success) return { ok: false, error: "سبب الإلغاء مطلوب (حتى 500 حرف)" };

  try {
    await requireRole(["admin", "worker"]);
    const supabase = await createServerSupabase();
    const result = await callRpc<{ version: number }>(supabase, "cancel_purchase_line", {
      p_line_id: parsed.data.lineId,
      p_expected_version: parsed.data.expectedVersion,
      p_reason: parsed.data.reason,
    });
    return { ok: true, data: { version: result.version } };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "تعذر إلغاء السطر" };
  }
}

export async function submitAction(
  input: unknown,
): Promise<MutationResult<{ status: string; version: number }>> {
  const parsed = z.object({ revisionId: uuid, expectedVersion: z.number().int().nonnegative() }).safeParse(input);
  if (!parsed.success) return { ok: false, error: "طلب غير صالح" };

  try {
    await requireRole(["admin", "worker"]);
    const supabase = await createServerSupabase();
    const result = await callRpc<{ status: string; version: number }>(supabase, "submit_revision", {
      p_revision_id: parsed.data.revisionId,
      p_expected_version: parsed.data.expectedVersion,
    });
    return { ok: true, data: { status: result.status, version: result.version } };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "تعذر تقديم اليومية" };
  }
}

export async function postAction(
  input: unknown,
): Promise<MutationResult<{ status: string; journalEntryId: string; purchaseTotal: string }>> {
  const parsed = z
    .object({
      revisionId: uuid,
      expectedVersion: z.number().int().nonnegative(),
      idempotencyKey: z.string().min(8).max(120),
    })
    .safeParse(input);
  if (!parsed.success) return { ok: false, error: "طلب ترحيل غير صالح" };

  try {
    await requireRole(["admin"]);
    const supabase = await createServerSupabase();
    const result = await callRpc<{
      status: string;
      journal_entry_id: string;
      purchase_total: string | number;
    }>(supabase, "post_revision", {
      p_revision_id: parsed.data.revisionId,
      p_expected_version: parsed.data.expectedVersion,
      p_idempotency_key: parsed.data.idempotencyKey,
    });
    return {
      ok: true,
      data: {
        status: result.status,
        journalEntryId: result.journal_entry_id,
        purchaseTotal: String(result.purchase_total),
      },
    };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "تعذر اعتماد اليومية" };
  }
}

export async function postCorrectionAction(
  input: unknown,
): Promise<MutationResult<{ status: string; journalEntryId: string; purchaseTotal: string }>> {
  const parsed = z.object({
    revisionId: uuid,
    expectedVersion: z.number().int().nonnegative(),
    idempotencyKey: z.string().min(8).max(120),
  }).safeParse(input);
  if (!parsed.success) return { ok: false, error: "طلب تصحيح غير صالح" };

  try {
    await requireRole(["admin"]);
    const supabase = await createServerSupabase();
    const result = await callRpc<{
      status: string;
      journal_entry_id: string;
      purchase_total: string | number;
    }>(supabase, "post_correction", {
      p_revision_id: parsed.data.revisionId,
      p_expected_version: parsed.data.expectedVersion,
      p_idempotency_key: parsed.data.idempotencyKey,
    });
    return {
      ok: true,
      data: {
        status: result.status,
        journalEntryId: result.journal_entry_id,
        purchaseTotal: String(result.purchase_total),
      },
    };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "تعذر ترحيل التصحيح" };
  }
}
