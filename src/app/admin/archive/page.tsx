import Link from "next/link";
import { Alert } from "@/components/ui/status";
import { ReopenSheetButton } from "@/features/operations/reopen-sheet-button";
import { CloseSheetButton } from "@/features/operations/close-sheet-button";
import { createServerSupabase } from "@/lib/supabase/server";
import { formatDate, formatAmount } from "@/lib/format";
import type { DailySheetRow } from "@/lib/supabase/types";
import { Printer, SlidersHorizontal } from "lucide-react";

export const metadata = { title: "تقارير الأيام والأرشيف — التعديل الشامل" };

export default async function AdminArchivePage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const params = await searchParams;
  const client = await createServerSupabase();

  let query = client
    .from("daily_sheets")
    .select(
      "id, business_date, status, version, current_revision_id, created_by, submitted_by, posted_by, closed_by, posted_at, closed_at, created_at, updated_at",
    )
    .order("business_date", { ascending: false })
    .limit(100);

  if (params.from) query = query.gte("business_date", params.from);
  if (params.to) query = query.lte("business_date", params.to);

  const { data, error } = await query;
  if (error) {
    return <Alert title="تعذر تحميل الأرشيف">تحقق من اتصال قاعدة البيانات وصلاحية المدير.</Alert>;
  }

  const sheets = (data ?? []) as DailySheetRow[];

  // جلب مبالغ المراجعة للإصدارات
  const revIds = sheets.map((s) => s.current_revision_id).filter(Boolean) as string[];
  type RevisionSummary = {
    id: string;
    total_purchase_value: string | number;
    total_distributed_value: string | number;
    revision_no: number;
  };
  const { data: revsData } = revIds.length
    ? await client
        .from("daily_sheet_revisions")
        .select("id, total_purchase_value, total_distributed_value, revision_no")
        .in("id", revIds)
    : { data: [] };

  const revMap = new Map(((revsData ?? []) as RevisionSummary[]).map((r) => [r.id, r]));

  return (
    <div className="space-y-5">
      {/* الترويسة الرئيسية */}
      <header className="flex flex-wrap items-end justify-between gap-3 border-b border-border-subtle pb-4">
        <div>
          <h1 className="text-xl font-black text-brand-900">تقارير الأيام السابقة والأرشيف</h1>
          <p className="mt-1 text-xs text-slate-600">
            مراجعة كشوف الأيام السابقة، استخراج التقارير والـ PDF، والتعديل الشامل الآمن مع قيد تصحيح لنفس التاريخ.
          </p>
        </div>

        {/* فلتر التاريخ */}
        <form className="flex flex-wrap items-end gap-2" action="" method="get">
          <label className="text-xs font-semibold text-slate-700">
            من:
            <input
              type="date"
              name="from"
              defaultValue={params.from || ""}
              className="mt-1 block rounded-lg border border-border-subtle bg-white px-2.5 py-1.5 text-xs font-bold"
            />
          </label>
          <label className="text-xs font-semibold text-slate-700">
            إلى:
            <input
              type="date"
              name="to"
              defaultValue={params.to || ""}
              className="mt-1 block rounded-lg border border-border-subtle bg-white px-2.5 py-1.5 text-xs font-bold"
            />
          </label>
          <button
            type="submit"
            className="rounded-lg bg-brand-900 px-3 py-1.5 text-xs font-bold text-white hover:bg-brand-800"
          >
            تصفية
          </button>
        </form>
      </header>

      {/* بطاقات الأيام السابقة مع الإجمالي والأزرار المطلوبة */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {sheets.map((sheet) => {
          const rev = sheet.current_revision_id ? revMap.get(sheet.current_revision_id) : null;
          const isPosted = sheet.status === "posted";
          const isClosed = sheet.status === "closed";

          return (
            <div
              key={sheet.id}
              className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm hover:shadow-md transition-all space-y-3"
            >
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <div>
                  <span className="text-sm font-black text-brand-900">
                    {formatDate(sheet.business_date)}
                  </span>
                  <span className="num block text-[11px] text-slate-400">
                    {sheet.business_date}
                  </span>
                </div>
                <span
                  className={`rounded-full px-2.5 py-0.5 text-xs font-black ${
                    isPosted
                      ? "bg-emerald-100 text-emerald-800"
                      : isClosed
                      ? "bg-slate-200 text-slate-700"
                      : "bg-amber-100 text-amber-800"
                  }`}
                >
                  {isPosted ? "معتمدة" : isClosed ? "مغلقة" : sheet.status}
                </span>
              </div>

              {/* بطاقة الإجمالي والإصدار */}
              <div className="grid grid-cols-2 gap-2 text-xs bg-slate-50 p-2.5 rounded-xl">
                <div>
                  <span className="text-slate-500 block text-[10px]">إجمالي المشتريات</span>
                  <span className="num font-black text-brand-900 text-xs">
                    {rev ? formatAmount(rev.total_purchase_value) : "—"}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px]">الإصدار والنسخة</span>
                  <span className="num font-bold text-slate-700 text-xs">
                    الإصدار {rev?.revision_no || 1} (v{sheet.version})
                  </span>
                </div>
              </div>

              {/* الأزرار والإجراءات المطلوبة: «عرض تقرير الكشف» و «تعديل شامل» */}
              <div className="flex flex-wrap items-center justify-between gap-1.5 pt-1">
                {/* زر عرض تقرير الكشف PDF */}
                <Link
                  href={`/reports/pdf/daily-sheet?date=${sheet.business_date}`}
                  target="_blank"
                  className="flex items-center gap-1 rounded-xl bg-slate-100 px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-200"
                >
                  <Printer size={13} />
                  <span>عرض تقرير الكشف</span>
                </Link>

                {/* زر تعديل شامل للمدير بالشريط البنفسجي */}
                <Link
                  href={`/admin/sheets?date=${sheet.business_date}&edit=true`}
                  className="flex items-center gap-1 rounded-xl bg-purple-700 px-3 py-1.5 text-xs font-bold text-white hover:bg-purple-800 shadow-xs"
                >
                  <SlidersHorizontal size={13} />
                  <span>تعديل شامل</span>
                </Link>

                {/* أزرار إعادة الفتح والإغلاق إن لزم */}
                {(isPosted || isClosed) && (
                  <ReopenSheetButton sheetId={sheet.id} version={sheet.version} />
                )}
                {isPosted && (
                  <CloseSheetButton sheetId={sheet.id} version={sheet.version} />
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
