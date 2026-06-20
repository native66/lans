import { Router } from "express";
export const walletRouter = Router();

walletRouter.get("/profile", (req, res) => {
  res.json({
    address: "0xMockAddress",
    balance: "100.5 SUI"
  });
});
