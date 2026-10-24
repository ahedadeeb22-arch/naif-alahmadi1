"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createVoucherAction } from "@/features/operations/actions";
import { newIdempotencyKey } from "@/lib/rpc";
import { inputClass } from "@/components/ui/primitives";
import type { StoreRow, SupplierRow } from "@/lib/supabase/types";

export function VoucherForm({ stores, suppliers, date }: { stores: ReadonlyArray<Pick<StoreRow, "id" | "name" | "code">>; suppliers: ReadonlyArray<Pick<SupplierRow, "id" | "name">>; date: string }) {
  const router = useRouter();
  const [type, setType] = useState<"receipt_from_store" | "payment_to_supplier">("receipt_from_store");
  const [partyId, setPartyId] = useState("");
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("");
  const [reference, setReference] = useState("");
  const [memo, setMemo] = useState("");
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
  const [idempotencyKey, setIdempotencyKey] = useState("");
  const parties = type === "receipt_from_store" ? stores.map((store) => ({ id: store.id, name: `${store.code} · ${store.name}` })) : suppliers;

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPending(true);
    const key = idempotencyKey || newIdempotencyKey("voucher");
    setIdempotencyKey(key);
    try {
      const result = await createVoucherAction({ type, storeId: type === "receipt_from_store" ? partyId : null, supplierId: type === "payment_to_supplier" ? partyId : null, amount, date, method: method || null, reference: reference || null, memo: memo || null, idempotencyKey: key });
      setMessage(result.message);
      if (result.ok) { setAmount(""); setReference(""); setMemo(""); setIdempotencyKey(""); router.refresh(); }
    } catch {
      setMessage("انقطع الرد. أعد المحاولة بنفس البيانات لتجنب تكرار السند.");
    } finally {
      setPending(false);
    }
  };

  return <form onSubmit={submit} className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
    <label className="text-sm">نوع السند<select value={type} onChange={(event) => { const next = event.target.value as typeof type; setType(next); setPartyId(""); setIdempotencyKey(""); }} className={`${inputClass} mt-1`}><option value="receipt_from_store">قبض من بقالة</option><option value="payment_to_supplier">صرف لمورد</option></select></label>
    <label className="text-sm">الطرف<select required value={partyId} onChange={(event) => { setPartyId(event.target.value); setIdempotencyKey(""); }} className={`${inputClass} mt-1`}><option value="">اختر الطرف</option>{parties.map((party) => <option key={party.id} value={party.id}>{party.name}</option>)}</select></label>
    <label className="text-sm">المبلغ<input required inputMode="decimal" value={amount} onChange={(event) => { setAmount(event.target.value); setIdempotencyKey(""); }} className={`${inputClass} num mt-1`} placeholder="0.00" /></label>
    <label className="text-sm">وسيلة الدفع<input value={method} onChange={(event) => { setMethod(event.target.value); setIdempotencyKey(""); }} className={`${inputClass} mt-1`} placeholder="نقد / تحويل" /></label>
    <label className="text-sm">مرجع الدفع<input value={reference} onChange={(event) => { setReference(event.target.value); setIdempotencyKey(""); }} className={`${inputClass} mt-1`} /></label>
    <label className="text-sm md:col-span-2">ملاحظة<input value={memo} onChange={(event) => { setMemo(event.target.value); setIdempotencyKey(""); }} className={`${inputClass} mt-1`} /></label>
    <div className="flex flex-wrap items-end gap-3"><button disabled={pending || !partyId} className="rounded-lg bg-brand-900 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{pending ? "جارٍ الترحيل…" : "ترحيل السند"}</button>{message ? <span role="status" className="text-sm text-slate-600">{message}</span> : null}</div>
  </form>;
}