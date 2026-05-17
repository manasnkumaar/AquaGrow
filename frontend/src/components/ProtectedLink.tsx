import Link from "next/link";
import { ReactNode } from "react";

export function PageLink({ href, children }: { href: string; children: ReactNode }) {
  return <Link href={href} className="text-brand-600 dark:text-brand-300 hover:underline">{children}</Link>;
}
