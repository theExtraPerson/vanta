import { AdminPanel } from "@/components/admin/AdminPanel";
import { getAdminDashboard } from "@/lib/admin/data";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const data = await getAdminDashboard();

  // The layout has already confirmed this session is an admin, so a null
  // payload here means the desk RPCs are missing from the database.
  if (!data) {
    return (
      <div className="px-4 pt-6">
        <div className="surface mx-auto max-w-sm rounded-2xl px-5 py-8 text-center">
          <p className="font-display text-[15px] font-bold text-white">Desk offline</p>
          <p className="mt-2 text-[12px] leading-relaxed text-mist">
            The admin RPCs are not in the ledger yet. Run <span className="font-mono text-gold">supabase/admin.sql</span>{" "}
            (after schema.sql and rpc.sql) in the Supabase SQL editor, then reload this page.
          </p>
        </div>
      </div>
    );
  }

  return <AdminPanel initial={data} />;
}
