import { getDebtsData, getCompanyHealth } from "@/lib/reports";
import { listManualDebts } from "@/lib/manualDebts";
import { todayYmd, monthStartYmd } from "@/lib/tashkent";
import { CompanyView } from "@/components/views/CompanyView";

export const revalidate = 0;

export default async function CompanyPage() {
  const today = todayYmd();
  const monthStart = monthStartYmd();
  const [data, manualDebts, health] = await Promise.all([
    getDebtsData(),
    listManualDebts(),
    getCompanyHealth(today, monthStart),
  ]);
  return <CompanyView data={data} manualDebts={manualDebts} health={health} />;
}
