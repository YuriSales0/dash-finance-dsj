import { redirect } from "next/navigation";

export default function RedirectIntegrations() {
  redirect("/admin/settings?tab=integrations");
}
