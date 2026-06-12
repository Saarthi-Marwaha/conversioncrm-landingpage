import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getActiveWorkspace } from "@/lib/active-workspace";
import { workspaceSenderName } from "@/lib/emails/workspace-from";
import { EmailComposer } from "@/components/EmailComposer";

export default async function ComposerPage() {
  const { workspace } = await getActiveWorkspace();

  if (!workspace) redirect("/login");

  return (
    <Suspense
      fallback={
        <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center text-sm text-gray-400">
          Loading composer…
        </div>
      }
    >
      <EmailComposer
        senderName={workspaceSenderName(workspace)}
        replyToConfigured={!!workspace.reply_to_email}
      />
    </Suspense>
  );
}
