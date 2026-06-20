import { Router } from "express";
export const authRouter = Router();

authRouter.post("/login", (req, res) => {
  res.json({ message: "Login endpoint stub" });
});
