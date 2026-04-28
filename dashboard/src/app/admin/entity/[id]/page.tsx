import { redirect } from "next/navigation";

export default function EntityPage({ params }: { params: { id: string } }) {
  redirect(`/pnl?entity=${params.id}`);
}
