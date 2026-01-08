"use client";

import { signIn, useSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, Suspense } from "react";
import Image from "next/image";

function LoginContent() {
  const { status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const error = searchParams.get("error");
  const [isLoading, setIsLoading] = useState(false);

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
    setIsLoading(true);
    signIn("azure-ad", { callbackUrl: "/" });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--bg-deep)] px-4">
      <div className="w-full max-w-md">
        {/* Login Card */}
        <div className="bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded p-8 animate-fade-up delay-1">

          {/* Error Message */}
          {error && (
            <div role="alert" className="mb-6 p-4 bg-[var(--danger-bg)] border border-[rgba(199,90,90,0.3)] rounded">
              <p className="text-sm text-[var(--danger)]">
                {error === "NotAuthorized" && "Your account is not authorized to access this application. Please contact your administrator."}
                {error === "AccountDeactivated" && "Your account has been deactivated. Please contact your administrator."}
                {error === "OAuthSignin" && "Error starting sign in. Please try again."}
                {error === "OAuthCallback" && "Error during sign in. Please try again."}
                {error === "OAuthCreateAccount" && "Could not create account. Contact admin."}
                {error === "Callback" && "Sign in failed. Please try again."}
                {error === "AccessDenied" && "Access denied. Contact your administrator."}
                {!["NotAuthorized", "AccountDeactivated", "OAuthSignin", "OAuthCallback", "OAuthCreateAccount", "Callback", "AccessDenied"].includes(error) && "An error occurred. Please try again."}
              </p>
            </div>
          )}

          {/* Logo */}
        <div className="text-center mb-6 animate-fade-up">
          <Image
            src="/logo.svg"
            alt="Veda Legal"
            width={280}
            height={112}
            priority
            className="mx-auto mb-3"
          />
          <p className="text-sm text-[var(--text-muted)] uppercase tracking-[3px]">
            Practice Management
          </p>
        </div>

          {/* Microsoft Sign In Button */}
          <button
            onClick={handleMicrosoftSignIn}
            disabled={isLoading}
            className="
              w-full flex items-center justify-center gap-3
              px-6 py-4 rounded
              bg-[var(--bg-surface)] border border-[var(--border-subtle)]
              text-[var(--text-primary)] font-medium
              hover:border-[var(--border-accent)] hover:bg-[var(--bg-hover)]
              transition-all duration-200
              group
              disabled:opacity-70 disabled:cursor-not-allowed disabled:hover:border-[var(--border-subtle)] disabled:hover:bg-[var(--bg-surface)]
            "
          >
            {isLoading ? (
              <svg className="w-5 h-5 animate-spin text-[var(--accent-pink)]" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
            ) : (
              <svg className="w-5 h-5" viewBox="0 0 21 21" fill="none">
                <rect x="1" y="1" width="9" height="9" fill="#F25022" />
                <rect x="11" y="1" width="9" height="9" fill="#7FBA00" />
                <rect x="1" y="11" width="9" height="9" fill="#00A4EF" />
                <rect x="11" y="11" width="9" height="9" fill="#FFB900" />
              </svg>
            )}
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
            Only authorized VEDA Legal employees can sign in
          </p>
        </div>

        {/* Footer */}
        <p className="text-xs text-[var(--text-muted)] text-center mt-8">
          &copy; {new Date().getFullYear()} VEDA Legal. All rights reserved.
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
