import Link from "next/link";
import { Card } from "@/components/ui/primitives";
import { Alert } from "@/components/ui/status";
import { ReopenSheetButton } from "@/features/operations/reopen-sheet-button";
import { CloseSheetButton } from "@/features/operations/close-sheet-button";
import { createServerSupabase } from "@/lib/supabase/server";
import { formatDate, formatDateTime } from "@/lib/format";
import type { DailySheetRow } from "@/lib/supabase/types";

export const metadata = { title: "أرشيف اليوميات" };

export default async function AdminArchivePage() {
  const client = await createServerSupabase();
  const { data, error } = await client.from("daily_sheets").select("id,business_date,status,version,current_revision_id,created_by,submitted_by,posted_by,closed_by,posted_at,closed_at,created_at,updated_at").order("business_date", { ascending: false }).limit(100);
  if (error) return <Alert title="تعذر تحميل الأرشيف">تحقق من اتصال قاعدة البيانات وصلاحية المدير.</Alert>;
  const sheets = (data ?? []) as DailySheetRow[];

  return <div className="space-y-4"><header><h1 className="text-xl font-bold text-brand-900">أرشيف اليوميات</h1><p className="text-sm text-slate-600">آخر 100 يومية. التعديل ينشئ إصدارًا جديدًا ولا يغير القيود السابقة.</p></header><Card>{sheets.length === 0 ? <p className="py-5 text-center text-sm text-slate-500">لا توجد يوميات محفوظة.</p> : <div className="overflow-x-auto"><table className="w-full min-w-[700px] text-sm"><thead className="border-b border-border-subtle bg-surface"><tr><th className="px-3 py-2 text-start">تاريخ العمل</th><th className="px-3 py-2 text-start">الحالة</th><th className="px-3 py-2 text-start">آخر تحديث</th><th className="px-3 py-2 text-start">النسخة</th><th className="px-3 py-2 text-start">الإجراءات</th></tr></thead><tbody>{sheets.map((sheet) => <tr key={sheet.id} className="border-b border-border-subtle"><td className="px-3 py-2">{formatDate(sheet.business_date)}</td><td className="px-3 py-2">{sheet.status}</td><td className="px-3 py-2">{formatDateTime(sheet.updated_at)}</td><td className="num px-3 py-2">{sheet.version}</td><td className="px-3 py-2"><div className="flex flex-wrap items-center gap-2"><Link className="text-brand-800 underline" href={`/admin/sheets?date=${sheet.business_date}`}>عرض</Link>{sheet.status === "posted" || sheet.status === "closed" ? <ReopenSheetButton sheetId={sheet.id} version={sheet.version} /> : null}{sheet.status === "posted" ? <CloseSheetButton sheetId={sheet.id} version={sheet.version} /> : null}</div></td></tr>)}</tbody></table></div>}</Card></div>;
}