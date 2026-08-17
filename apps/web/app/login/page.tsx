import { LoginForm } from "./LoginForm";

export default function LoginPage() {
  return (
    <div className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-6 px-6">
      <h1 className="text-2xl font-semibold">Sign in to ETVET</h1>
      <LoginForm />
    </div>
  );
}
