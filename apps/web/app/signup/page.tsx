import { SignupForm } from "./SignupForm";

export default function SignupPage() {
  return (
    <div className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-6 px-6">
      <div>
        <h1 className="text-2xl font-semibold">Create your ETVET organization</h1>
        <p className="mt-1 text-sm text-black/60 dark:text-white/60">
          Starts on the FREE tier. Upgrade to PRO or MAXPRO any time.
        </p>
      </div>
      <SignupForm />
    </div>
  );
}
