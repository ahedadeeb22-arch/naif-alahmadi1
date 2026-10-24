import { Card } from "@/components/ui/primitives";
import { Alert } from "@/components/ui/status";
import { NightOrderEditor } from "@/features/operations/night-order-editor";
import { businessDate, isIsoDate } from "@/features/accounting/domain/period";
import { createServerSupabase } from "@/lib/supabase/server";
import type { NightOrderLineRow, NightOrderRow, ProductRow, StoreRow } from "@/lib/supabase/types";
import { formatDate, formatQuantity } from "@/lib/format";

export const metadata = { title: "طلبات الليل" };

export default async function AdminNightOrdersPage({ searchParams }: { searchParams: Promise<{ date?: string; store?: string }> }) {
  const params = await searchParams;
  const date = params.date && isIsoDate(params.date) ? params.date : businessDate();
  const client = await createServerSupabase();
  const [storesResult, productsResult, ordersResult] = await Promise.all([
    client.from("stores").select("id,code,name,sort_order,active,created_at,updated_at").eq("active", true).order("sort_order"),
    client.from("products").select("id,code,name,unit_name,sort_order,active,created_at,updated_at").eq("active", true).order("sort_order"),
    client.from("night_orders").select("id,business_date,store_id,status,version,created_by,submitted_at,created_at,updated_at").eq("business_date", date),
  ]);
  if (storesResult.error || productsResult.error || ordersResult.error) return <Alert title="تعذر تحميل الطلبات">تحقق من تطبيق migrations والاتصال بقاعدة البيانات.</Alert>;
  const stores = (storesResult.data ?? []) as StoreRow[];
  const products = (productsResult.data ?? []) as ProductRow[];
  const orders = (ordersResult.data ?? []) as NightOrderRow[];
  const selectedStore = params.store ?? stores[0]?.id ?? "";
  const selectedOrder = orders.find((order) => order.store_id === selectedStore);
  const linesResult = selectedOrder ? await client.from("night_order_lines").select("id,night_order_id,product_id,quantity,note,created_at").eq("night_order_id", selectedOrder.id) : { data: [] };
  const lines = (linesResult.data ?? []) as NightOrderLineRow[];
  const storeNames = new Map(stores.map((store) => [store.id, `${store.code} · ${store.name}`]));
  const productNames = new Map(products.map((product) => [product.id, product.name]));
  const linesByOrder = orders.length ? await client.from("night_order_lines").select("id,night_order_id,product_id,quantity,note,created_at").in("night_order_id", orders.map((order) => order.id)) : { data: [] };
  const allLines = (linesByOrder.data ?? []) as NightOrderLineRow[];

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-end justify-between gap-3"><div><h1 className="text-xl font-bold text-brand-900">طلبات الليل</h1><p className="text-sm text-slate-600">طلبات غير مالية ليوم {formatDate(date)}</p></div><form className="flex items-end gap-2"><label className="text-sm">التاريخ<input type="date" name="date" defaultValue={date} className="mt-1 block rounded-lg border border-border-subtle px-3 py-2" /></label><button className="rounded-lg border border-brand-900 px-3 py-2 text-sm">عرض</button></form></header>
      <NightOrderEditor key={`${date}-${selectedStore}-${selectedOrder?.id ?? "new"}`} date={date} stores={stores} products={products} initialStoreId={selectedStore} initialStatus={selectedOrder?.status ?? null} initialLines={lines.map((line) => ({ product_id: line.product_id, quantity: line.quantity, note: line.note }))} />
      <Card title="ملخص الطلبات بحسب البقالة">
        {orders.length === 0 ? <p className="text-sm text-slate-500">لا توجد طلبات محفوظة لهذا التاريخ.</p> : <div className="overflow-x-auto"><table className="w-full min-w-[600px] text-sm"><thead className="border-b border-border-subtle bg-surface"><tr><th className="px-3 py-2 text-start">البقالة</th><th className="px-3 py-2 text-start">الحالة</th><th className="px-3 py-2 text-start">الصنف</th><th className="px-3 py-2 text-start">الكمية المطلوبة</th><th className="px-3 py-2 text-start">إجراء</th></tr></thead><tbody>{orders.flatMap((order) => {
          const orderLines = allLines.filter((line) => line.night_order_id === order.id);
          return (orderLines.length ? orderLines : [null]).map((line, index) => <tr key={`${order.id}-${line?.id ?? "empty"}`} className="border-b border-border-subtle"><td className="px-3 py-2">{index === 0 ? storeNames.get(order.store_id) ?? "—" : ""}</td><td className="px-3 py-2">{index === 0 ? order.status : ""}</td><td className="px-3 py-2">{line ? productNames.get(line.product_id) ?? "صنف غير نشط" : "لا توجد أصناف"}</td><td className="num px-3 py-2">{formatQuantity(line?.quantity)}</td><td className="px-3 py-2">{index === 0 ? <a className="text-brand-800 underline" href={`/admin/night-orders?date=${date}&store=${order.store_id}`}>فتح</a> : null}</td></tr>);
        })}</tbody></table></div>}
      </Card>
    </div>
  );
}