import { businessDate, isIsoDate } from "@/features/accounting/domain/period";
import { createServerSupabase } from "@/lib/supabase/server";
import { loadCatalog, loadSheetByDate } from "@/features/daily-sheets/data";
import { SheetEditor } from "@/features/daily-sheets/sheet-editor";
import { Alert } from "@/components/ui/status";
import type { AppRole } from "@/lib/auth/session";

export async function SheetPage({ role, searchDate }: { role: AppRole; searchDate?: string }) {
  const date = searchDate && isIsoDate(searchDate) ? searchDate : businessDate();
  const supabase = await createServerSupabase();
  let sheet = null as Awaited<ReturnType<typeof loadSheetByDate>>;
  let catalog: Awaited<ReturnType<typeof loadCatalog>> | null = null;
  let loadError: unknown;

  try {
    [sheet, catalog] = await Promise.all([loadSheetByDate(supabase, date), loadCatalog(supabase)]);
  } catch (error) {
    loadError = error;
  }

  if (loadError || !catalog) {
    return (
      <Alert title="تعذر تحميل اليومية">
        {loadError instanceof Error && loadError.message.includes("إعداد Supabase")
          ? "أضف متغيرات Supabase في .env.local وطبّق ترحيلات قاعدة البيانات أولًا."
          : "حدث خطأ في قراءة البيانات. تحقق من الاتصال والصلاحيات وحاول مجددًا."}
      </Alert>
    );
  }

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-brand-900">الكشف اليومي</h1>
          <p className="text-sm text-slate-600">
            إدخال مشتريات السوق وتوزيع الكميات على البقالات مع حساب التكلفة الفعلية لكل مصدر.
          </p>
        </div>
        <form className="flex items-end gap-2" action="" method="get">
          <label className="text-sm">
            <span className="mb-1 block text-slate-600">يوم العمل</span>
            <input type="date" name="date" defaultValue={date} className="num rounded-lg border-border-subtle px-3 py-2" />
          </label>
          <button type="submit" className="rounded-lg border-brand-900 px-3 py-2 text-sm font-semibold text-brand-900">
            عرض
          </button>
        </form>
      </header>
      <SheetEditor
        initialSheet={sheet}
        products={catalog.products}
        suppliers={catalog.suppliers}
        stores={catalog.stores}
        role={role === "worker" ? "worker" : "admin"}
        date={date}
      />
    </div>
  );
}
