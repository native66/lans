import { Router } from "express";
import { deepBookService } from "../services/deepbook";

export const deepBookRouter = Router();

/**
 * GET /api/v1/deepbook/orders/:poolId
 * Fetch real DeepBook pool state from on-chain
 */
deepBookRouter.get("/orders/:poolId", async (req, res) => {
  const { poolId } = req.params;
  try {
    const poolData = await deepBookService.getOrderBook(poolId);
    res.json(poolData);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch order book" });
  }
});

/**
 * GET /api/v1/deepbook/balances?owner=0x...
 * Fetch real on-chain balances for the given address
 */
deepBookRouter.get("/balances", async (req, res) => {
  const owner = req.query.owner as string;
  if (!owner) {
    return res.status(400).json({ error: "Missing 'owner' query parameter" });
  }

  try {
    const balances = await deepBookService.getUserBalances(owner);
    res.json({ balances });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch balances" });
  }
});

/**
 * POST /api/v1/deepbook/limit-order
 * Generate a serialized PTB for a limit order (requires AI intent)
 */
deepBookRouter.post("/limit-order", async (req, res) => {
  try {
    // In actual implementation, we would return the serialized PTB 
    // for the frontend to sign and execute via wallet
    res.json({ status: "PTB generation requires a valid vault. Use the Agents page to deploy." });
  } catch (error) {
    res.status(500).json({ error: "Failed to create limit order PTB" });
  }
});
