import { SheetPage } from "@/features/daily-sheets/sheet-page";

export const metadata = { title: "الكشف اليومي" };

export default async function AdminSheetsPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const params = await searchParams;
  return <SheetPage role="admin" searchDate={params.date} />;
}
