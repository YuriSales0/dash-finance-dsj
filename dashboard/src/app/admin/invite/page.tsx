import { redirect } from "next/navigation";

export default function RedirectInvite() {
  redirect("/admin/investments?tab=invites");
}
