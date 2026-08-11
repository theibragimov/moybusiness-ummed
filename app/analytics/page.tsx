import { getAnalyticsData } from "@/lib/reports";
import { monthStartYmd, monthEndYmd } from "@/lib/tashkent";
import { AnalyticsView } from "@/components/views/AnalyticsView";

export const revalidate = 0;

export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams: { from?: string; to?: string };
}) {
  const from = searchParams.from ?? monthStartYmd();
  const to = searchParams.to ?? monthEndYmd();
  const data = await getAnalyticsData(from, to);
  return <AnalyticsView data={data} from={from} to={to} />;
}
