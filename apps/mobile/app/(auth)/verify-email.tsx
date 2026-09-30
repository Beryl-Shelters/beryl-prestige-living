import { useEffect, useState } from "react";
import { router } from "expo-router";
import { Button, Card, LoadingState, Screen, SectionHeading, TextField } from "@/components/ui";
import { authApi } from "@/lib/auth-api";
import { friendlyError } from "@/lib/api-error";
import { useAuth } from "@/providers/auth-provider";

export default function VerifyEmailScreen() {
  const { verifyEmail } = useAuth();
  const [maskedEmail, setMaskedEmail] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void authApi
      .verificationContext()
      .then((result) => setMaskedEmail(result.maskedEmail))
      .catch((failure) => setError(friendlyError(failure)))
      .finally(() => setLoading(false));
  }, []);

  async function submit() {
    setError("");
    setLoading(true);
    try {
      await verifyEmail(code);
      router.replace("/account");
    } catch (failure) {
      setError(friendlyError(failure));
    } finally {
      setLoading(false);
    }
  }

  if (loading && !maskedEmail) {
    return (
      <Screen edges={["top", "left", "right"]}>
        <LoadingState label="Loading verification" />
      </Screen>
    );
  }

  return (
    <Screen keyboard edges={["top", "left", "right"]}>
      <SectionHeading
        title="Verify your email"
        description={
          maskedEmail
            ? `Enter the six-digit code sent to ${maskedEmail}.`
            : "Enter the six-digit verification code sent to your account email."
        }
      />
      <Card>
        <TextField
          label="Verification code"
          keyboardType="number-pad"
          autoComplete="one-time-code"
          maxLength={6}
          value={code}
          onChangeText={(value) => setCode(value.replace(/\D/g, ""))}
          error={error || undefined}
        />
        <Button
          label="Verify email"
          loading={loading}
          disabled={code.length !== 6}
          onPress={() => void submit()}
        />
        <Button
          label="Resend code"
          variant="secondary"
          disabled={loading}
          onPress={() =>
            void authApi
              .resendVerification()
              .catch((failure) => setError(friendlyError(failure)))
          }
        />
      </Card>
    </Screen>
  );
}
