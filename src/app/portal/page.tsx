import { Card } from "@/components/ui/primitives";
import { Alert } from "@/components/ui/status";
import { StatementView, type StatementData } from "@/features/operations/statement-view";
import { businessDate, isIsoDate } from "@/features/accounting/domain/period";
import { createServerSupabase } from "@/lib/supabase/server";
import { callRpc } from "@/lib/rpc";
import type { StoreMembershipRow, StoreRow } from "@/lib/supabase/types";

export const metadata = { title: "كشف حسابي" };

export default async function StorePortalPage({ searchParams }: { searchParams: Promise<{ from?: string; to?: string }> }) {
  const params = await searchParams;
  const today = businessDate();
  const from = params.from && isIsoDate(params.from) ? params.from : today;
  const to = params.to && isIsoDate(params.to) ? params.to : today;
  const client = await createServerSupabase();
  const { data: membershipData, error: membershipError } = await client.from("store_memberships").select("user_id,store_id,active,created_at,created_by").eq("active", true);
  if (membershipError) return <Alert title="تعذر تحميل عضويات الحساب">تحقق من تسجيل الدخول وسياسات قاعدة البيانات.</Alert>;
  const memberships = (membershipData ?? []) as StoreMembershipRow[];
  if (!memberships.length) return <Card title="لا توجد بقالات مرتبطة"><p className="text-sm text-slate-600">اطلب من المدير ربط حسابك ببقالة قبل عرض كشف الحساب.</p></Card>;

  const { data: storeData, error: storeError } = await client.from("stores").select("id,code,name,sort_order,active,created_at,updated_at").in("id", memberships.map((item) => item.store_id)).order("sort_order");
  if (storeError) return <Alert title="تعذر تحميل بيانات البقالة">أعد المحاولة أو تواصل مع المدير.</Alert>;
  const stores = (storeData ?? []) as StoreRow[];
  const results = await Promise.all(stores.map(async (store) => {
    try {
      const statement = await callRpc<StatementData>(client, "store_statement", { p_store_id: store.id, p_from: from, p_to: to });
      return { store, statement };
    } catch {
      return { store, statement: null };
    }
  }));

  return <div className="space-y-5"><form className="flex flex-wrap items-end gap-2"><label className="text-sm">من<input type="date" name="from" defaultValue={from} className="mt-1 block rounded-lg border border-border-subtle px-3 py-2" /></label><label className="text-sm">إلى<input type="date" name="to" defaultValue={to} className="mt-1 block rounded-lg border border-border-subtle px-3 py-2" /></label><button className="rounded-lg bg-brand-900 px-4 py-2 text-sm font-semibold text-white">تحديث الكشف</button></form>{results.map(({ store, statement }) => statement ? <StatementView key={store.id} statement={statement} partyName={`${store.code} · ${store.name}`} partyKind="store" /> : <Alert key={store.id} title={`تعذر تحميل كشف ${store.name}`}>تحقق من عضوية البقالة في قاعدة البيانات.</Alert>)}</div>;
}