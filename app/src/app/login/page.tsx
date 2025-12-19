"use client";

import { signIn, useSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, Suspense } from "react";

function LoginContent() {
  const { status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const error = searchParams.get("error");

  useEffect(() => {
    if (status === "authenticated") {
      router.push("/");
    }
  }, [status, router]);

  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--bg-deep)]">
        <div className="text-[var(--text-muted)]">Loading...</div>
      </div>
    );
  }

  const handleMicrosoftSignIn = () => {
    signIn("azure-ad", { callbackUrl: "/" });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--bg-deep)] px-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-12 animate-fade-up">
          <h1 className="font-heading text-5xl font-semibold tracking-tight mb-2">
            <span className="text-[var(--accent-pink)]">Veda</span>{" "}
            <span className="text-[var(--text-primary)]">Legal</span>
          </h1>
          <p className="text-sm text-[var(--text-muted)] uppercase tracking-[3px]">
            Practice Management
          </p>
        </div>

        {/* Login Card */}
        <div className="bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded p-8 animate-fade-up delay-1">
          <h2 className="font-heading text-2xl font-medium text-[var(--text-primary)] text-center mb-2">
            Welcome back
          </h2>
          <p className="text-sm text-[var(--text-secondary)] text-center mb-8">
            Sign in with your Microsoft 365 account to continue
          </p>

          {/* Error Message */}
          {error && (
            <div className="mb-6 p-4 bg-[var(--danger-bg)] border border-[rgba(199,90,90,0.3)] rounded">
              <p className="text-sm text-[var(--danger)]">
                {error === "OAuthSignin" && "Error starting sign in. Please try again."}
                {error === "OAuthCallback" && "Error during sign in. Please try again."}
                {error === "OAuthCreateAccount" && "Could not create account. Contact admin."}
                {error === "Callback" && "Sign in failed. Please try again."}
                {error === "AccessDenied" && "Access denied. Contact your administrator."}
                {!["OAuthSignin", "OAuthCallback", "OAuthCreateAccount", "Callback", "AccessDenied"].includes(error) && "An error occurred. Please try again."}
              </p>
            </div>
          )}

          {/* Microsoft Sign In Button */}
          <button
            onClick={handleMicrosoftSignIn}
            className="
              w-full flex items-center justify-center gap-3
              px-6 py-4 rounded
              bg-[var(--bg-surface)] border border-[var(--border-subtle)]
              text-[var(--text-primary)] font-medium
              hover:border-[var(--border-accent)] hover:bg-[var(--bg-hover)]
              transition-all duration-200
              group
            "
          >
            {/* Microsoft Logo */}
            <svg className="w-5 h-5" viewBox="0 0 21 21" fill="none">
              <rect x="1" y="1" width="9" height="9" fill="#F25022" />
              <rect x="11" y="1" width="9" height="9" fill="#7FBA00" />
              <rect x="1" y="11" width="9" height="9" fill="#00A4EF" />
              <rect x="11" y="11" width="9" height="9" fill="#FFB900" />
            </svg>
            <span>Sign in with Microsoft 365</span>
            <svg
              className="w-4 h-4 text-[var(--text-muted)] group-hover:translate-x-1 transition-transform"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
            </svg>
          </button>

          <p className="text-xs text-[var(--text-muted)] text-center mt-6">
            Only authorized Veda Legal employees can sign in
          </p>
        </div>

        {/* Footer */}
        <p className="text-xs text-[var(--text-muted)] text-center mt-8">
          &copy; {new Date().getFullYear()} Veda Legal. All rights reserved.
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-[var(--bg-deep)]">
        <div className="text-[var(--text-muted)]">Loading...</div>
      </div>
    }>
      <LoginContent />
    </Suspense>
  );
}
