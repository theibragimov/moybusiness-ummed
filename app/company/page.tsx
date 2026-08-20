import { getDebtsData, getCompanyHealth, getNetProfitData } from "@/lib/reports";
import { todayYmd, monthStartYmd, monthEndYmd } from "@/lib/tashkent";
import { CompanyView } from "@/components/views/CompanyView";

export const revalidate = 0;

export default async function CompanyPage({
  searchParams,
}: {
  searchParams: { from?: string; to?: string };
}) {
  const today = todayYmd();
  const monthStart = monthStartYmd();
  const from = searchParams.from ?? monthStart;
  const to = searchParams.to ?? monthEndYmd();
  const [data, health, netProfit] = await Promise.all([
    getDebtsData(),
    getCompanyHealth(today, monthStart),
    getNetProfitData(from, to),
  ]);
  return <CompanyView data={data} health={health} netProfit={netProfit} />;
}
