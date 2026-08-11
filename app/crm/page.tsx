import { getCounterparties } from "@/lib/reports";
import { CrmView } from "@/components/views/CrmView";

export const revalidate = 0;

export default async function CrmPage() {
  const rows = await getCounterparties();
  return <CrmView rows={rows} />;
}
