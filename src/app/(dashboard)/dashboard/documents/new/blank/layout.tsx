import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { canUseRichtext } from "@/lib/features";

export default async function BlankDocumentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  if (!(await canUseRichtext(session.user.id))) redirect("/dashboard/upload");
  return <>{children}</>;
}
