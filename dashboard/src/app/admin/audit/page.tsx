import { redirect } from "next/navigation";

export default function RedirectAudit() {
  redirect("/admin/transactions?tab=audit");
}
