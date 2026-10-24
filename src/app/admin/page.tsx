import Link from "next/link";
import { Card, StatCard } from "@/components/ui/primitives";
import { Alert } from "@/components/ui/status";
import { businessDate } from "@/features/accounting/domain/period";
import { createServerSupabase } from "@/lib/supabase/server";
import { callRpc } from "@/lib/rpc";
import { formatAmount, formatDate } from "@/lib/format";

export const metadata = { title: "لوحة المدير" };

interface DashboardSummary {
  date: string;
  purchase_today: number | string;
  supplier_due: number | string;
  store_due: number | string;
  inventory_balance: number | string;
  damage_expense: number | string;
  sheet: { id: string; status: string; version: number; business_date: string; revision_no: number } | null;
}

export default async function AdminDashboardPage() {
  const date = businessDate();
  const client = await createServerSupabase();
  let summary: DashboardSummary;
  try {
    summary = await callRpc<DashboardSummary>(client, "dashboard_summary", { p_date: date });
  } catch {
    return <Alert title="تعذر تحميل لوحة المدير">تحقق من تطبيق migrations وصلاحية حساب المدير ثم أعد تحميل الصفحة.</Alert>;
  }

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-brand-900">لوحة المدير</h1>
          <p className="text-sm text-slate-600">ملخص الدفتر حتى {formatDate(date)}</p>
        </div>
        <Link href="/admin/sheets" className="rounded-lg bg-brand-900 px-4 py-2.5 text-sm font-semibold text-white">فتح كشف اليوم</Link>
      </header>
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <StatCard label="مشتريات اليوم" value={formatAmount(summary.purchase_today)} />
        <StatCard label="المستحق للموردين" value={formatAmount(summary.supplier_due)} tone="gold" />
        <StatCard label="المستحق على البقالات" value={formatAmount(summary.store_due)} tone="green" />
        <StatCard label="رصيد المخزون" value={formatAmount(summary.inventory_balance)} tone="violet" />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="حالة اليومية">
          {summary.sheet ? (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm">الحالة: <strong>{summary.sheet.status}</strong> · الإصدار {summary.sheet.revision_no}</p>
              <Link href={`/admin/sheets?date=${date}`} className="text-sm font-semibold text-brand-800 underline">عرض اليومية</Link>
            </div>
          ) : <p className="text-sm text-slate-600">لا توجد يومية لهذا اليوم.</p>}
        </Card>
        <Card title="مؤشرات دفترية">
          <dl className="grid grid-cols-2 gap-3 text-sm">
            <div><dt className="text-slate-500">خسائر التلف</dt><dd className="num mt-1 font-semibold">{formatAmount(summary.damage_expense)}</dd></div>
            <div><dt className="text-slate-500">تاريخ التقرير</dt><dd className="mt-1 font-semibold">{formatDate(summary.date)}</dd></div>
          </dl>
        </Card>
      </div>
      <Card title="اختصارات العمل">
        <div className="flex flex-wrap gap-2 text-sm">
          {([["طلبات الليل", "/admin/night-orders"], ["الأرشيف", "/admin/archive"], ["السندات", "/admin/vouchers"], ["كشوف البقالات", "/admin/statements/stores"], ["كشوف الموردين", "/admin/statements/suppliers"], ["الكتالوج", "/admin/stores"]] as const).map(([label, href]) => (
            <Link key={href} href={href} className="rounded-lg border border-border-subtle px-3 py-2 hover:bg-surface">{label}</Link>
          ))}
        </div>
      </Card>
    </div>
  );
}