import { redirect } from "next/navigation";

export default function RedirectReconciliation() {
  redirect("/admin/transactions?tab=reconciliation");
}
