import { getExpensesData } from "@/lib/reports";
import { monthStartYmd, monthEndYmd } from "@/lib/tashkent";
import { ExpensesView } from "@/components/views/ExpensesView";

export const revalidate = 0;

export default async function ExpensesPage({
  searchParams,
}: {
  searchParams: { from?: string; to?: string };
}) {
  const from = searchParams.from ?? monthStartYmd();
  const to = searchParams.to ?? monthEndYmd();
  const data = await getExpensesData(from, to);
  return <ExpensesView data={data} from={from} to={to} />;
}
