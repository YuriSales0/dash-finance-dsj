import { redirect } from "next/navigation";

export default function EntityPage({ params }: { params: { id: string } }) {
  redirect(`/admin/pnl?entity=${params.id}`);
}
