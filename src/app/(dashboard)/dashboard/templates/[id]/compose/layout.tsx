import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { canUseRichtext } from "@/lib/features";

export default async function ComposeTemplateLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { id: string };
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  if (!(await canUseRichtext(session.user.id))) {
    redirect(`/dashboard/templates/${params.id}/edit`);
  }
  return <>{children}</>;
}
