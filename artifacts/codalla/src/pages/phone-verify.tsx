import { useState, useEffect } from "react";
import { Redirect, useLocation } from "wouter";
import { useAuth } from "@/contexts/auth-context";
import { PhoneVerification } from "@/components/auth/phone-verification";
import { CodallaLogo } from "@/components/logo";
import { AlertCircle } from "lucide-react";

export function PhoneVerifyPage() {
  const { user, loading } = useAuth();
  const [, setLocation] = useLocation();
  const [isPhoneVerified, setIsPhoneVerified] = useState(false);
  const [isChecking, setIsChecking] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Check if user's phone is already verified
  useEffect(() => {
    if (!loading && user) {
      checkPhoneVerificationStatus();
    }
  }, [user, loading]);

  const checkPhoneVerificationStatus = async () => {
    try {
      const response = await fetch("/api/phone-auth/status", {
        credentials: "include"
      });

      if (!response.ok) {
        throw new Error("Failed to check phone verification status");
      }

      const data = await response.json();
      setIsPhoneVerified(data.phoneVerified);
      setIsChecking(false);
    } catch (err) {
      console.error("Error checking phone status:", err);
      setIsChecking(false);
    }
  };

  // Not logged in → redirect to login
  if (!loading && !user) {
    return <Redirect to="/login" />;
  }

  // Already verified → redirect to dashboard
  if (!isChecking && isPhoneVerified) {
    return <Redirect to="/" />;
  }

  // Loading state
  if (loading || isChecking) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Checking verification status...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background text-foreground font-sans px-6">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center text-center mb-8">
          <CodallaLogo className="h-9 w-auto" />
          <p className="mt-3 text-[13px] text-muted-foreground">
            Complete your account setup
          </p>
        </div>

        {error && (
          <div className="mb-6 rounded-lg border border-destructive/40 bg-destructive/10 p-4 flex gap-3">
            <AlertCircle className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
            <div className="text-sm text-destructive">{error}</div>
          </div>
        )}

        <PhoneVerification
          onVerificationComplete={() => {
            setIsPhoneVerified(true);
            setTimeout(() => {
              setLocation("/");
            }, 1500);
          }}
          onError={(err) => setError(err)}
        />

        <p className="text-center text-xs text-muted-foreground mt-6">
          Logged in as <span className="font-medium">{user?.email}</span>
        </p>
      </div>
    </div>
  );
}
