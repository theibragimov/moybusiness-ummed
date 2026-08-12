import { getWarehouseData } from "@/lib/reports";
import { WarehouseView } from "@/components/views/WarehouseView";

export const revalidate = 0;

export default async function WarehousePage() {
  const data = await getWarehouseData();
  return <WarehouseView data={data} />;
}
