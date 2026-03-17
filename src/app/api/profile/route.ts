import { generateObject } from "ai";
import { z } from "zod";
import { getAzureOpenAI, getDeploymentName } from "@/lib/openai";

export const runtime = "nodejs";
export const maxDuration = 30;

const profileSchema = z.object({
  preferredAirlines: z.array(z.string()).optional().describe("Airlines the user prefers or has status with"),
  excludedAirlines: z.array(z.string()).optional().describe("Airlines the user wants to avoid"),
  loyaltyPrograms: z.array(z.string()).optional().describe("Frequent flyer or loyalty programs mentioned"),
  maxBudget: z.number().optional().describe("Default budget ceiling in USD"),
  cabinClass: z.string().optional().describe("Preferred cabin class"),
  maxStops: z.number().optional().describe("Maximum acceptable stops"),
  maxLayoverHours: z.number().optional().describe("Maximum acceptable layover duration in hours"),
  timePreference: z.enum(["morning", "afternoon", "evening", "red-eye"]).nullable().optional().describe("Preferred time of day for flights"),
  homeAirport: z.string().optional().describe("User's home/default departure airport IATA code"),
  notes: z.array(z.string()).optional().describe("Other travel preferences mentioned (e.g. 'traveling with infant', 'needs wheelchair assistance')"),
});

export async function POST(request: Request) {
  const { messages } = await request.json();

  if (!messages || messages.length < 2) {
    return Response.json({ profile: {} });
  }

  // Extract only text content from last few messages for efficiency
  const recentMessages = messages.slice(-6);
  const conversationText = recentMessages
    .map((m: any) => {
      const text = m.parts
        ?.filter((p: any) => p.type === "text")
        .map((p: any) => p.text)
        .join(" ") || "";
      return `${m.role}: ${text}`;
    })
    .join("\n");

  if (!conversationText.trim()) {
    return Response.json({ profile: {} });
  }

  try {
    const azure = getAzureOpenAI();
    const model = azure.chat(getDeploymentName());

    const { object } = await generateObject({
      model,
      schema: profileSchema,
      prompt: `Extract travel preferences from this conversation. Only include preferences the user explicitly stated or strongly implied. Do not infer or guess. If no preferences are found, return empty fields.\n\nConversation:\n${conversationText}`,
    });

    return Response.json({ profile: object });
  } catch {
    return Response.json({ profile: {} });
  }
}
