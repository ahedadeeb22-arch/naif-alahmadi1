import { Card } from "@/components/ui/primitives";
import { Alert } from "@/components/ui/status";
import { StatementView, type StatementData } from "@/features/operations/statement-view";
import { businessDate, isIsoDate } from "@/features/accounting/domain/period";
import { createServerSupabase } from "@/lib/supabase/server";
import { callRpc } from "@/lib/rpc";
import type { SupplierRow } from "@/lib/supabase/types";

export const metadata = { title: "كشوف الموردين" };

export default async function SupplierStatementsPage({ searchParams }: { searchParams: Promise<{ supplier?: string; from?: string; to?: string }> }) {
  const params = await searchParams;
  const today = businessDate();
  const from = params.from && isIsoDate(params.from) ? params.from : today;
  const to = params.to && isIsoDate(params.to) ? params.to : today;
  const client = await createServerSupabase();
  const { data, error } = await client.from("suppliers").select("id,code,name,active,notes,created_at,updated_at").order("name");
  if (error) return <Alert title="تعذر تحميل الموردين">تحقق من صلاحية المدير واتصال قاعدة البيانات.</Alert>;
  const suppliers = (data ?? []) as SupplierRow[];
  const supplierId = params.supplier ?? suppliers[0]?.id;
  const supplier = suppliers.find((item) => item.id === supplierId);
  if (!supplier) return <Card title="كشف المورد"><p className="text-sm text-slate-600">لا يوجد موردون مسجلون.</p></Card>;

  let statement: StatementData;
  try {
    statement = await callRpc<StatementData>(client, "supplier_statement", { p_supplier_id: supplier.id, p_from: from, p_to: to });
  } catch {
    return <Alert title="تعذر تحميل كشف المورد">راجع الفترة وصلاحية المدير وسجل migrations.</Alert>;
  }

  return <div className="space-y-4"><form className="flex flex-wrap items-end gap-2"><label className="text-sm">المورد<select name="supplier" defaultValue={supplier.id} className="mt-1 block rounded-lg border border-border-subtle px-3 py-2">{suppliers.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><label className="text-sm">من<input type="date" name="from" defaultValue={from} className="mt-1 block rounded-lg border border-border-subtle px-3 py-2" /></label><label className="text-sm">إلى<input type="date" name="to" defaultValue={to} className="mt-1 block rounded-lg border border-border-subtle px-3 py-2" /></label><button className="rounded-lg bg-brand-900 px-4 py-2 text-sm font-semibold text-white">عرض الكشف</button></form><StatementView statement={statement} partyName={supplier.name} partyKind="supplier" /></div>;
}