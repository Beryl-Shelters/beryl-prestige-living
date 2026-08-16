export type MixpanelEnvironment = "Test" | "Production";

export const mixpanelEnvironment = (value?: string): MixpanelEnvironment =>
  value?.trim().toLowerCase() === "production" ? "Production" : "Test";

export const mixpanelEventName = (event: string, environment: MixpanelEnvironment) =>
  /^\[(?:Test|Production)\]\s/.test(event) ? event : `[${environment}] ${event}`;
