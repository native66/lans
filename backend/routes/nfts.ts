import { Router } from "express";
export const nftsRouter = Router();

nftsRouter.get("/list", (req, res) => {
  res.json({
    nfts: [
      { id: "nft_1", agentId: "agent_1", status: "Active", budget: "100 SUI", strategy: "Mock Strategy", expires: "24h" }
    ]
  });
});
