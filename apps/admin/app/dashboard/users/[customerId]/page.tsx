import { AdminCustomerDetail } from "../../../../components/admin-customer-detail";

export default async function AdminCustomerDetailPage({ params }: { params: Promise<{ customerId: string }> }) {
  const { customerId } = await params;
  return <AdminCustomerDetail customerId={customerId}/>;
}
