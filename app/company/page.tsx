import { getDebtsData } from "@/lib/reports";
import { CompanyView } from "@/components/views/CompanyView";

export const revalidate = 0;

export default async function CompanyPage() {
  const data = await getDebtsData();
  return <CompanyView data={data} />;
}
