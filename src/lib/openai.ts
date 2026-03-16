import { createAzure } from "@ai-sdk/azure";

export function getAzureOpenAI() {
  return createAzure({
    apiKey: process.env.AZURE_OPENAI_API_KEY!,
    resourceName: extractResourceName(process.env.AZURE_OPENAI_ENDPOINT!),
    apiVersion: process.env.AZURE_OPENAI_API_VERSION || "2024-12-01-preview",
  });
}

function extractResourceName(endpoint: string): string {
  const match = endpoint.match(/https:\/\/(.+?)\.openai\.azure\.com/);
  if (!match) {
    throw new Error(`Invalid Azure OpenAI endpoint: ${endpoint}. Expected format: https://<resource>.openai.azure.com`);
  }
  return match[1];
}

export function getDeploymentName(): string {
  return process.env.AZURE_OPENAI_DEPLOYMENT || "gpt-4o-mini";
}
