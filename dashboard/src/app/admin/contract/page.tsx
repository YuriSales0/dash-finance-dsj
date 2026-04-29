import { redirect } from "next/navigation";

export default function RedirectContract() {
  redirect("/admin/settings?tab=contract");
}
