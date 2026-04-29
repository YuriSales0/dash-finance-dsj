import { redirect } from "next/navigation";

export default function RedirectPreview() {
  redirect("/admin/investments?tab=preview");
}
