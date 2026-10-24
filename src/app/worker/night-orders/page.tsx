import { NightOrderEditor } from "@/features/operations/night-order-editor";
import { Alert } from "@/components/ui/status";
import { businessDate, isIsoDate } from "@/features/accounting/domain/period";
import { createServerSupabase } from "@/lib/supabase/server";
import type { NightOrderLineRow, NightOrderRow, ProductRow, StoreRow } from "@/lib/supabase/types";
import { formatDate } from "@/lib/format";

export const metadata = { title: "طلبات الليل" };

export default async function WorkerNightOrdersPage({ searchParams }: { searchParams: Promise<{ date?: string; store?: string }> }) {
  const params = await searchParams;
  const date = params.date && isIsoDate(params.date) ? params.date : businessDate();
  const client = await createServerSupabase();
  const [storesResult, productsResult, ordersResult] = await Promise.all([
    client.from("stores").select("id,code,name,sort_order,active,created_at,updated_at").eq("active", true).order("sort_order"),
    client.from("products").select("id,code,name,unit_name,sort_order,active,created_at,updated_at").eq("active", true).order("sort_order"),
    client.from("night_orders").select("id,business_date,store_id,status,version,created_by,submitted_at,created_at,updated_at").eq("business_date", date),
  ]);
  if (storesResult.error || productsResult.error || ordersResult.error) return <Alert title="تعذر تحميل الطلبات">تحقق من الاتصال والصلاحيات.</Alert>;
  const stores = (storesResult.data ?? []) as StoreRow[];
  const products = (productsResult.data ?? []) as ProductRow[];
  const orders = (ordersResult.data ?? []) as NightOrderRow[];
  const selectedStore = params.store ?? stores[0]?.id ?? "";
  const order = orders.find((item) => item.store_id === selectedStore);
  const linesResult = order ? await client.from("night_order_lines").select("id,night_order_id,product_id,quantity,note,created_at").eq("night_order_id", order.id) : { data: [] };
  const lines = (linesResult.data ?? []) as NightOrderLineRow[];

  return <div className="space-y-4"><header><h1 className="text-xl font-bold text-brand-900">طلبات الليل</h1><p className="text-sm text-slate-600">طلبات {formatDate(date)} مستقلة عن الرصيد المالي.</p></header><form className="flex flex-wrap items-end gap-2"><label className="text-sm">التاريخ<input type="date" name="date" defaultValue={date} className="mt-1 block rounded-lg border border-border-subtle px-3 py-2" /></label><label className="text-sm">البقالة<select name="store" defaultValue={selectedStore} className="mt-1 block rounded-lg border border-border-subtle px-3 py-2">{stores.map((store) => <option key={store.id} value={store.id}>{store.code} · {store.name}</option>)}</select></label><button className="rounded-lg border border-brand-900 px-3 py-2 text-sm">عرض</button></form><NightOrderEditor key={`${date}-${selectedStore}-${order?.id ?? "new"}`} date={date} stores={stores} products={products} initialStoreId={selectedStore} initialStatus={order?.status ?? null} initialLines={lines.map((line) => ({ product_id: line.product_id, quantity: line.quantity, note: line.note }))} /></div>;
}