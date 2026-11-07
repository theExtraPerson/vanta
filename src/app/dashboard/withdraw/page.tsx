import { redirect } from "next/navigation";

/** Legacy route — the withdrawal form now lives on the wallet screen. */
export default function WithdrawRedirect() {
  redirect("/dashboard/wallet?tab=withdraw");
}