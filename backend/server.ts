import "dotenv/config";
import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { authRouter } from "./routes/auth";
import { walletRouter } from "./routes/wallet";
import { agentsRouter } from "./routes/agents";
import { nftsRouter } from "./routes/nfts";
import { deepBookRouter } from "./routes/deepbook";

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API ROUTES
  app.use("/api/v1/auth", authRouter);
  app.use("/api/v1/wallet", walletRouter);
  app.use("/api/v1/agents", agentsRouter);
  app.use("/api/v1/nfts", nftsRouter);
  app.use("/api/v1/deepbook", deepBookRouter);

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
