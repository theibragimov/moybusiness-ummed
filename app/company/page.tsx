import { getDebtsData, getCompanyHealth } from "@/lib/reports";
import { todayYmd, monthStartYmd } from "@/lib/tashkent";
import { CompanyView } from "@/components/views/CompanyView";

export const revalidate = 0;

export default async function CompanyPage() {
  const today = todayYmd();
  const monthStart = monthStartYmd();
  const [data, health] = await Promise.all([getDebtsData(), getCompanyHealth(today, monthStart)]);
  return <CompanyView data={data} health={health} />;
}
