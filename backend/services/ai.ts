import { logger } from "../utils/logger";
import { performance } from "perf_hooks";

export interface AIIntent {
  type: "spot" | "margin" | "prediction" | "flash_loan";
  action: "buy" | "sell" | "arbitrage";
  pool: string;
  amount: number;
  spendToken: string;
  receiveToken: string;
  requireSuiGas: boolean;
  leverage?: number;
}

export async function parseIntent(prompt: string, budget?: number): Promise<AIIntent> {
  const openRouterKey = process.env.OPENROUTER_API_KEY;
  if (!openRouterKey) throw new Error("OPENROUTER_API_KEY is missing in .env");

  const start = performance.now();
  const model = process.env.OPENROUTER_MODEL || "google/gemini-2.5-flash";
  
  logger.info("Attempting LLM parsing via OpenRouter", { model });

  try {
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${openRouterKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: model,
        messages: [
          {
            role: "system",
            content: `You are an expert AI trading agent for Deepbook V3 on the Sui Blockchain. 
Your job is to parse the user's natural language trading intent into a strict JSON format.
If the user does not specify an exact amount, use the provided budget: ${budget ? budget : 'unknown'}.
If the spendToken is not SUI, the user must also provide SUI for gas fees, so set requireSuiGas to true.

Always return ONLY valid JSON matching this exact structure:
{
  "type": "spot" | "margin" | "prediction" | "flash_loan",
  "action": "buy" | "sell" | "arbitrage",
  "pool": "SUI_USDC" | string,
  "amount": number (extract the exact amount, or use the total budget if not specified),
  "spendToken": "SUI" | "USDC" | string (the token the user is selling/spending),
  "receiveToken": "USDC" | "SUI" | string (the token the user is buying/receiving),
  "requireSuiGas": boolean (true ONLY IF spendToken is not SUI, because Sui network requires SUI for gas),
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
    
    logger.info("LLM raw parsed response", { parsed: intentJSON });
    
    const durationMs = (performance.now() - start).toFixed(2);
    logger.info("parseIntent completed", { durationMs, method: "llm", confidence: 0.9 });

    return intentJSON as AIIntent;

  } catch (error: any) {
    logger.error("AI Parse Error:", { error: error.message });
    throw new Error("AI failed to parse intent: " + error.message);
  }
}
