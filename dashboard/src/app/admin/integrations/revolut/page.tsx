import { redirect } from "next/navigation";

export default function RedirectRevolut() {
  redirect("/admin/settings?tab=integrations");
}
