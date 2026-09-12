import { createClient } from "@/lib/supabase/server";
import { Logo } from "@/components/Logo";
import { SignupForm } from "./SignupForm";

interface InviteSummary {
  org_name: string;
  role: string;
  valid: boolean;
}

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ invite?: string }>;
}) {
  const { invite: inviteToken } = await searchParams;

  let invite: InviteSummary | null = null;
  if (inviteToken) {
    const supabase = await createClient();
    const { data } = await supabase.rpc("get_invite_by_token", { p_token: inviteToken });
    invite = (data?.[0] as InviteSummary | undefined) ?? null;
  }

  const validInvite = invite?.valid ? invite : null;

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-6 px-6">
      <Logo label="ETVET" />
      <div>
        <h1 className="text-2xl font-semibold">
          {validInvite ? `Join ${validInvite.org_name}` : "Create your ETVET organization"}
        </h1>
        <p className="mt-1 text-sm text-black/60 dark:text-white/60">
          {validInvite
            ? `You've been invited to join as ${validInvite.role}.`
            : "Starts on the FREE tier. Upgrade to PRO or MAXPRO any time."}
        </p>
        {inviteToken && !validInvite && (
          <p className="mt-1 text-sm text-red-600">
            This invite link is invalid or has expired. You can still create your own
            organization below.
          </p>
        )}
      </div>
      <SignupForm inviteToken={validInvite ? inviteToken! : undefined} />
    </main>
  );
}
