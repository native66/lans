export interface AIIntent {
  type: "spot" | "margin" | "prediction" | "flash_loan";
  action: "buy" | "sell" | "arbitrage";
  pool: string;
  amount: number;
  leverage?: number;
}

export async function parseIntent(prompt: string): Promise<AIIntent> {
  const openRouterKey = process.env.OPENROUTER_API_KEY;
  if (!openRouterKey) throw new Error("OPENROUTER_API_KEY is missing in .env");

  try {
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${openRouterKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: process.env.OPENROUTER_MODEL || "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content: `You are an expert AI trading agent for Deepbook V3 on the Sui Blockchain. 
Your job is to parse the user's natural language trading intent into a strict JSON format.
Always return ONLY valid JSON matching this exact structure:
{
  "type": "spot" | "margin" | "prediction" | "flash_loan",
  "action": "buy" | "sell" | "arbitrage",
  "pool": "SUI_USDC" | string,
  "amount": number (extract the amount in USDC or base asset),
  "leverage": number (optional, only if margin is requested)
}`
          },
          { role: "user", content: prompt }
        ],
        response_format: { type: "json_object" }
      })
    });

    const data = await res.json();
    if (!data.choices || !data.choices[0]) {
      throw new Error("Invalid response from OpenRouter");
    }

    const intentJSON = JSON.parse(data.choices[0].message.content);
    return intentJSON as AIIntent;

  } catch (error: any) {
    console.error("AI Parse Error:", error);
    throw new Error("AI failed to parse intent: " + error.message);
  }
}
