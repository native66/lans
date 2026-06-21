import { Router } from "express";

export const authRouter = Router();

/**
 * GET /api/v1/auth/status
 * Health check endpoint. Authentication in LANS is wallet-based (dApp Kit).
 * This endpoint confirms the backend is running and reports the configured network.
 */
authRouter.get("/status", (req, res) => {
  const network = process.env.VITE_SUI_NETWORK || "testnet";
  const packageId = process.env.VITE_AGENT_POLICY_PACKAGE_ID || "NOT_SET";
  const hasOpenRouter = !!process.env.OPENROUTER_API_KEY && process.env.OPENROUTER_API_KEY !== "YOUR_OPENROUTER_API_KEY_HERE";

  res.json({
    status: "ok",
    network,
    contractDeployed: packageId !== "0xYOUR_PACKAGE_ID" && packageId !== "NOT_SET",
    packageId: packageId !== "0xYOUR_PACKAGE_ID" ? packageId : null,
    aiServiceReady: hasOpenRouter,
    timestamp: new Date().toISOString()
  });
});
