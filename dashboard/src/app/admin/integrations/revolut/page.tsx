import { redirect } from "next/navigation";

export default function RedirectRevolut({
  searchParams,
}: {
  searchParams: { [key: string]: string | undefined };
}) {
  const qs = new URLSearchParams();
  qs.set("tab", "integrations");
  if (searchParams.success) qs.set("success", searchParams.success);
  if (searchParams.error) qs.set("error", searchParams.error);
  if (searchParams.account) qs.set("account", searchParams.account);
  redirect(`/admin/settings?${qs.toString()}`);
}
