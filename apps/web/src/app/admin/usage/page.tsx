import { redirect } from "next/navigation";

/** @deprecated Prefer /admin/unit-economics */
export default function AdminUsageRedirect() {
  redirect("/admin/unit-economics");
}
