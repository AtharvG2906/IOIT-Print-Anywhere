import type { Metadata } from "next";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { logout } from "@/app/actions/auth";
import "./globals.css";

export const metadata: Metadata = {
  title: "Print Anywhere",
  description: "Upload a PDF, pay online and collect your prints from the desk.",
};

async function Header() {
  const user = await getCurrentUser();
  const link = "rounded-md px-2.5 py-1.5 text-sm font-medium text-stone-700 hover:bg-stone-100";
  return (
    <header className="border-b border-stone-200 bg-white">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-2 px-4 py-3">
        <Link href="/" className="flex items-center gap-2 text-lg font-bold tracking-tight">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-stone-900 text-sm text-white">PA</span>
          Print Anywhere
        </Link>
        <nav className="flex flex-wrap items-center gap-1">
          {user ? (
            <>
              <Link href="/print" className={link}>Print</Link>
              <Link href="/orders" className={link}>My orders</Link>
              {user.isAdmin && <Link href="/admin" className={link}>Desk</Link>}
              <span className="hidden px-2 text-sm text-stone-500 sm:inline">{user.fullName.split(" ")[0]}</span>
              <form action={logout}>
                <button className={link}>Log out</button>
              </form>
            </>
          ) : (
            <>
              <Link href="/login" className={link}>Log in</Link>
              <Link href="/signup" className="rounded-md bg-stone-900 px-3 py-1.5 text-sm font-semibold text-white hover:bg-stone-700">
                Create account
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en">
      <body className="flex min-h-screen flex-col">
        <Header />
        <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">{children}</main>
        <footer className="py-6 text-center text-xs text-stone-500">Print Anywhere · A4 · Black &amp; white</footer>
      </body>
    </html>
  );
}
