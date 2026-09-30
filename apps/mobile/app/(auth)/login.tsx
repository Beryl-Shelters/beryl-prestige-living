import { useState } from "react";
import { router, useLocalSearchParams } from "expo-router";
import { Button, Card, Screen, SectionHeading, TextField } from "@/components/ui";
import { friendlyError, MobileApiError } from "@/lib/api-error";
import { useAuth } from "@/providers/auth-provider";

export default function LoginScreen() {
  const { next } = useLocalSearchParams<{ next?: string }>();
  const { login } = useAuth();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit() {
    setError("");
    setLoading(true);
    try {
      await login(identifier, password);
      const destination =
        typeof next === "string" && next.startsWith("/") && !next.startsWith("//")
          ? next
          : "/account";
      router.replace(destination as never);
    } catch (failure) {
      if (failure instanceof MobileApiError && failure.code === "EMAIL_NOT_VERIFIED") {
        router.push("/(auth)/verify-email");
        return;
      }
      setError(friendlyError(failure));
    } finally {
      setLoading(false);
    }
  }

  return (
    <Screen keyboard edges={["top", "left", "right"]}>
      <SectionHeading
        title="Welcome back"
        description="Log in with your customer email address or phone number."
      />
      <Card>
        <TextField
          label="Email or phone"
          autoCapitalize="none"
          autoComplete="username"
          value={identifier}
          onChangeText={setIdentifier}
        />
        <TextField
          label="Password"
          autoCapitalize="none"
          autoComplete="current-password"
          secureTextEntry
          value={password}
          onChangeText={setPassword}
          error={error || undefined}
        />
        <Button
          label="Log in"
          loading={loading}
          disabled={!identifier.trim() || !password}
          onPress={() => void submit()}
        />
        <Button
          label="Create an account"
          variant="secondary"
          onPress={() => router.replace("/(auth)/register")}
        />
      </Card>
    </Screen>
  );
}
