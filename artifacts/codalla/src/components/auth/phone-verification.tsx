import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";
import { generateDeviceFingerprint, formatPhoneNumber, isValidPhoneNumber } from "@/lib/device-fingerprint";

interface PhoneVerificationProps {
  onVerificationComplete: () => void;
  onError?: (error: string) => void;
}

export function PhoneVerification({ onVerificationComplete, onError }: PhoneVerificationProps) {
  const [step, setStep] = useState<"request-otp" | "verify-otp">("request-otp");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [otp, setOtp] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [deviceFingerprint] = useState(() => generateDeviceFingerprint());
  const { toast } = useToast();

  const handleRequestOTP = async () => {
    if (!isValidPhoneNumber(phoneNumber)) {
      toast({
        title: "Invalid phone number",
        description: "Please enter a valid phone number (10-15 digits)",
        variant: "destructive"
      });
      return;
    }

    setIsLoading(true);
    try {
      const formattedPhone = formatPhoneNumber(phoneNumber);
      const response = await fetch("/api/phone-auth/request-otp", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phoneNumber: formattedPhone,
          deviceFingerprint
        })
      });

      const data = await response.json();

      if (!response.ok) {
        if (data.code === "PHONE_ALREADY_REGISTERED") {
          onError?.(data.error);
          toast({
            title: "Phone already registered",
            description: "This phone number is linked to another account. Please use a different phone number.",
            variant: "destructive"
          });
        } else if (data.code === "DEVICE_ALREADY_LINKED") {
          onError?.(data.error);
          toast({
            title: "Device already linked",
            description: "This device is linked to another account. For security, each device can only have one account.",
            variant: "destructive"
          });
        } else {
          throw new Error(data.error);
        }
        return;
      }

      setStep("verify-otp");
      toast({
        title: "OTP sent",
        description: "Check your phone for the verification code"
      });
    } catch (err: any) {
      toast({
        title: "Error",
        description: err.message || "Failed to send OTP",
        variant: "destructive"
      });
      onError?.(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyOTP = async () => {
    if (!otp || otp.length !== 6) {
      toast({
        title: "Invalid OTP",
        description: "Please enter a 6-digit code",
        variant: "destructive"
      });
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch("/api/phone-auth/verify-otp", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          otp,
          deviceFingerprint
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to verify OTP");
      }

      toast({
        title: "Verified!",
        description: "Your phone has been verified successfully"
      });
      onVerificationComplete();
    } catch (err: any) {
      toast({
        title: "Verification failed",
        description: err.message,
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full max-w-sm mx-auto p-6 bg-card border border-border rounded-lg">
      <h2 className="text-lg font-semibold mb-4">Verify Your Phone</h2>
      <p className="text-sm text-muted-foreground mb-6">
        We need to verify your phone number to complete your account setup. This helps us prevent fraud and ensure account security.
      </p>

      {step === "request-otp" ? (
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium">Phone Number</label>
            <Input
              type="tel"
              placeholder="+1 (555) 123-4567"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              disabled={isLoading}
              className="mt-1"
            />
            <p className="text-xs text-muted-foreground mt-1">Include country code (e.g., +1 for US)</p>
          </div>
          <Button
            onClick={handleRequestOTP}
            disabled={isLoading || !phoneNumber}
            className="w-full"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Sending...
              </>
            ) : (
              "Send Verification Code"
            )}
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium">Verification Code</label>
            <Input
              type="text"
              placeholder="000000"
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
              disabled={isLoading}
              maxLength={6}
              className="mt-1 font-mono text-center text-lg"
            />
            <p className="text-xs text-muted-foreground mt-1">Enter the 6-digit code sent to your phone</p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setStep("request-otp");
                setOtp("");
              }}
              disabled={isLoading}
              className="flex-1"
            >
              Back
            </Button>
            <Button
              onClick={handleVerifyOTP}
              disabled={isLoading || otp.length !== 6}
              className="flex-1"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Verifying...
                </>
              ) : (
                "Verify"
              )}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
