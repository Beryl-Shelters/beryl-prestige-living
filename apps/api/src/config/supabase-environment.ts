export const deploymentEnvironments = [
  "local",
  "test",
  "preview",
  "production"
] as const;

export type DeploymentEnvironment = (typeof deploymentEnvironments)[number];

export class SupabaseEnvironmentConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SupabaseEnvironmentConfigurationError";
  }
}

type SupabaseEnvironmentInput = {
  deploymentEnvironment?: string;
  supabaseUrl?: string;
  expectedProjectRef?: string;
};

const projectRefPattern = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/;
const hostedSuffix = ".supabase.co";
const protectedEnvironments = new Set<DeploymentEnvironment>([
  "preview",
  "production"
]);
const loopbackHosts = new Set(["localhost", "127.0.0.1", "[::1]"]);

const configurationError = (message: string) =>
  new SupabaseEnvironmentConfigurationError(message);

export const parseDeploymentEnvironment = (
  value?: string
): DeploymentEnvironment => {
  const normalized = value?.trim().toLowerCase();
  if (
    !normalized ||
    !deploymentEnvironments.includes(normalized as DeploymentEnvironment)
  ) {
    throw configurationError(
      "DEPLOYMENT_ENVIRONMENT must be one of local, test, preview, or production"
    );
  }
  return normalized as DeploymentEnvironment;
};

const parseSupabaseUrl = (value?: string) => {
  if (!value?.trim()) {
    throw configurationError("SUPABASE_URL is required");
  }

  try {
    return new URL(value);
  } catch {
    throw configurationError("SUPABASE_URL must be a valid URL");
  }
};

const hostedProjectRef = (url: URL) => {
  if (url.protocol !== "https:") {
    throw configurationError("SUPABASE_URL must use HTTPS");
  }

  const hostname = url.hostname.toLowerCase();
  if (!hostname.endsWith(hostedSuffix)) {
    throw configurationError(
      "SUPABASE_URL must identify a hosted Supabase project"
    );
  }

  const projectRef = hostname.slice(0, -hostedSuffix.length);
  if (!projectRefPattern.test(projectRef)) {
    throw configurationError(
      "SUPABASE_URL must contain a valid Supabase project reference"
    );
  }

  return projectRef;
};

const normalizedExpectedProjectRef = (value?: string) => {
  const normalized = value?.trim().toLowerCase();
  if (!normalized || !projectRefPattern.test(normalized)) {
    throw configurationError(
      "EXPECTED_SUPABASE_PROJECT_REF must contain a valid project reference"
    );
  }
  return normalized;
};

export const validateSupabaseEnvironment = (
  input: SupabaseEnvironmentInput
) => {
  const deploymentEnvironment = parseDeploymentEnvironment(
    input.deploymentEnvironment
  );
  const url = parseSupabaseUrl(input.supabaseUrl);

  if (
    !protectedEnvironments.has(deploymentEnvironment) &&
    loopbackHosts.has(url.hostname.toLowerCase())
  ) {
    return { deploymentEnvironment, projectRef: null };
  }

  const projectRef = hostedProjectRef(url);
  if (protectedEnvironments.has(deploymentEnvironment)) {
    if (!input.expectedProjectRef?.trim()) {
      throw configurationError(
        "EXPECTED_SUPABASE_PROJECT_REF is required for preview and production"
      );
    }

    const expectedProjectRef = normalizedExpectedProjectRef(
      input.expectedProjectRef
    );
    if (projectRef !== expectedProjectRef) {
      throw configurationError(
        `Configured Supabase project does not match EXPECTED_SUPABASE_PROJECT_REF for ${deploymentEnvironment}`
      );
    }
  } else if (input.expectedProjectRef?.trim()) {
    const expectedProjectRef = normalizedExpectedProjectRef(
      input.expectedProjectRef
    );
    if (projectRef !== expectedProjectRef) {
      throw configurationError(
        `Configured Supabase project does not match EXPECTED_SUPABASE_PROJECT_REF for ${deploymentEnvironment}`
      );
    }
  }

  return { deploymentEnvironment, projectRef };
};
