import { redirect } from "next/navigation";
import { getActiveWorkspace } from "@/lib/active-workspace";
import { UserDetail } from "@/components/UserDetail";

export default async function UserDetailPage({
  params,
}: {
  params: { userId: string };
}) {
  const { workspace } = await getActiveWorkspace();

  if (!workspace) redirect("/login");

  return <UserDetail userId={decodeURIComponent(params.userId)} />;
}
