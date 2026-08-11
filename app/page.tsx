import { getDashboardData } from "@/lib/reports";
import { todayYmd, monthStartYmd } from "@/lib/tashkent";
import { DashboardView } from "@/components/views/DashboardView";

export const revalidate = 0;

export default async function DashboardPage() {
  const today = todayYmd();
  const monthStart = monthStartYmd();
  const data = await getDashboardData(today, monthStart);
  return <DashboardView data={data} />;
}
