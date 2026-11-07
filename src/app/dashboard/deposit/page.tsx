import { redirect } from "next/navigation";

/** Legacy route — the deposit form now lives on the wallet screen. */
export default function DepositRedirect() {
  redirect("/dashboard/wallet?tab=deposit");
}