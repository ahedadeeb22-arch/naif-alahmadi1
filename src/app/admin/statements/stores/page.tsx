import { Card } from "@/components/ui/primitives";
import { Alert } from "@/components/ui/status";
import { StatementView, type StatementData } from "@/features/operations/statement-view";
import { businessDate, isIsoDate } from "@/features/accounting/domain/period";
import { createServerSupabase } from "@/lib/supabase/server";
import { callRpc } from "@/lib/rpc";
import type { StoreRow } from "@/lib/supabase/types";

export const metadata = { title: "كشوف البقالات" };

export default async function StoreStatementsPage({ searchParams }: { searchParams: Promise<{ store?: string; from?: string; to?: string }> }) {
  const params = await searchParams;
  const today = businessDate();
  const from = params.from && isIsoDate(params.from) ? params.from : today;
  const to = params.to && isIsoDate(params.to) ? params.to : today;
  const client = await createServerSupabase();
  const { data, error } = await client.from("stores").select("id,code,name,sort_order,active,created_at,updated_at").order("sort_order");
  if (error) return <Alert title="تعذر تحميل البقالات">تحقق من صلاحية المدير واتصال قاعدة البيانات.</Alert>;
  const stores = (data ?? []) as StoreRow[];
  const storeId = params.store ?? stores[0]?.id;
  const store = stores.find((item) => item.id === storeId);
  if (!store) return <Card title="كشف البقالة"><p className="text-sm text-slate-600">لا توجد بقالات مسجلة.</p></Card>;

  let statement: StatementData;
  try {
    statement = await callRpc<StatementData>(client, "store_statement", { p_store_id: store.id, p_from: from, p_to: to });
  } catch {
    return <Alert title="تعذر تحميل كشف البقالة">راجع الفترة وتأكد من صلاحية المدير ووجود migrations مطبقة.</Alert>;
  }

  return <div className="space-y-4"><form className="flex flex-wrap items-end gap-2"><label className="text-sm">البقالة<select name="store" defaultValue={store.id} className="mt-1 block rounded-lg border border-border-subtle px-3 py-2">{stores.map((item) => <option key={item.id} value={item.id}>{item.code} · {item.name}</option>)}</select></label><label className="text-sm">من<input type="date" name="from" defaultValue={from} className="mt-1 block rounded-lg border border-border-subtle px-3 py-2" /></label><label className="text-sm">إلى<input type="date" name="to" defaultValue={to} className="mt-1 block rounded-lg border border-border-subtle px-3 py-2" /></label><button className="rounded-lg bg-brand-900 px-4 py-2 text-sm font-semibold text-white">عرض الكشف</button></form><StatementView statement={statement} partyName={`${store.code} · ${store.name}`} partyKind="store" /></div>;
}