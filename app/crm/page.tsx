import { getCounterparties, getCustomerAbc } from "@/lib/reports";
import { monthStartYmd, monthEndYmd, todayYmd, daysAgoYmd } from "@/lib/tashkent";
import { CrmView } from "@/components/views/CrmView";

export const revalidate = 0;

export default async function CrmPage({
  searchParams,
}: {
  searchParams: { from?: string; to?: string };
}) {
  const from = searchParams.from ?? monthStartYmd();
  const to = searchParams.to ?? monthEndYmd();
  const [rows, abc] = await Promise.all([getCounterparties(), getCustomerAbc(from, to)]);
  return (
    <CrmView
      rows={rows}
      abc={abc}
      from={from}
      to={to}
      today={todayYmd()}
      oneMonthAgo={daysAgoYmd(30)}
      threeMonthsAgo={daysAgoYmd(90)}
    />
  );
}
