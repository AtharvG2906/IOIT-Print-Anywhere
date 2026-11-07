import Link from "next/link";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { setUserBlocked } from "@/app/actions/admin";
import { Card, buttonClass, inputClass, secondaryButtonClass } from "@/components/ui";

export default async function AdminUsersPage({ searchParams }: PageProps<"/admin/users">) {
  const admin = await requireAdmin();
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.trim() : "";

  const users = await db.user.findMany({
    where: q
      ? {
          OR: [
            { fullName: { contains: q, mode: "insensitive" } },
            { prn: { contains: q.toUpperCase() } },
            { email: { contains: q.toLowerCase() } },
            { phone: { contains: q.replace(/\D/g, "") || q } },
          ],
        }
      : undefined,
    orderBy: { createdAt: "desc" },
    take: 100,
    include: { _count: { select: { orders: { where: { paidAt: { not: null } } } } } },
  });

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Students</h1>
        <Link href="/admin" className={secondaryButtonClass}>← Desk</Link>
      </div>
      <form className="flex gap-2" action="/admin/users">
        <input name="q" defaultValue={q} placeholder="Search name, PRN, email or phone" className={`${inputClass} max-w-md`} />
        <button className={buttonClass}>Search</button>
      </form>
      <Card className="overflow-x-auto p-0">
        <table className="w-full min-w-[760px] text-sm">
          <thead className="border-b border-stone-200 bg-stone-50 text-left text-xs uppercase tracking-wide text-stone-500">
            <tr>
              <th className="px-4 py-2.5">Name</th>
              <th className="px-4 py-2.5">PRN</th>
              <th className="px-4 py-2.5">Dept / year / class / batch</th>
              <th className="px-4 py-2.5">Contact</th>
              <th className="px-4 py-2.5">Paid orders</th>
              <th className="px-4 py-2.5">College ID</th>
              <th className="px-4 py-2.5"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            {users.length === 0 && (
              <tr><td colSpan={7} className="px-4 py-6 text-center text-stone-500">No students found.</td></tr>
            )}
            {users.map((u) => (
              <tr key={u.id} className={u.blocked ? "bg-red-50/60" : ""}>
                <td className="px-4 py-2.5 font-medium">{u.fullName}{u.blocked && <span className="ml-2 text-xs font-semibold text-red-700">BLOCKED</span>}</td>
                <td className="px-4 py-2.5 font-mono">{u.prn}</td>
                <td className="px-4 py-2.5">{u.department || "—"} / {u.academicYear} / {u.className} / {u.batch}</td>
                <td className="px-4 py-2.5">{u.email}<div className="text-xs text-stone-500">+91 {u.phone}</div></td>
                <td className="px-4 py-2.5">{u._count.orders}</td>
                <td className="px-4 py-2.5">
                  {u.collegeIdKey ? (
                    <a href={`/api/admin/college-id/${u.id}`} target="_blank" className="font-semibold underline">View</a>
                  ) : (
                    <span className="text-stone-400">Missing</span>
                  )}
                </td>
                <td className="px-4 py-2.5 text-right">
                  {u.id !== admin.id && (
                    <form action={setUserBlocked}>
                      <input type="hidden" name="userId" value={u.id} />
                      <input type="hidden" name="blocked" value={String(!u.blocked)} />
                      <button className="text-xs font-semibold underline">{u.blocked ? "Unblock" : "Block"}</button>
                    </form>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
