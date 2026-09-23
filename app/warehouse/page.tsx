import { getWarehouseData, getSuppliers } from "@/lib/reports";
import { WarehouseView } from "@/components/views/WarehouseView";

export const revalidate = 0;

export default async function WarehousePage() {
  const [data, suppliers] = await Promise.all([getWarehouseData(), getSuppliers()]);
  return <WarehouseView data={data} suppliers={suppliers} />;
}
