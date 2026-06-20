import { Router } from "express";
import { deepBookService } from "../services/deepbook";

export const deepBookRouter = Router();

deepBookRouter.get("/orders/:poolId", async (req, res) => {
  const { poolId } = req.params;
  try {
    const orderBook = await deepBookService.getOrderBook(poolId);
    res.json(orderBook);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch order book" });
  }
});

deepBookRouter.post("/limit-order", async (req, res) => {
  try {
    // In actual implementation, we would return the serialized PTB 
    // for the frontend to sign and execute via zkLogin
    res.json({ status: "PTB generated successfully", serializedTx: "base64..." });
  } catch (error) {
    res.status(500).json({ error: "Failed to create limit order PTB" });
  }
});
