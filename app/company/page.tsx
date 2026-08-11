import { getDebtsData } from "@/lib/reports";
import { listManualDebts } from "@/lib/manualDebts";
import { CompanyView } from "@/components/views/CompanyView";

export const revalidate = 0;

export default async function CompanyPage() {
  const [data, manualDebts] = await Promise.all([getDebtsData(), listManualDebts()]);
  return <CompanyView data={data} manualDebts={manualDebts} />;
}
