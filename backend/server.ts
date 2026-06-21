import "dotenv/config";
import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { authRouter } from "./routes/auth";
import { walletRouter } from "./routes/wallet";
import { agentsRouter } from "./routes/agents";
import { nftsRouter } from "./routes/nfts";
import { deepBookRouter } from "./routes/deepbook";

import { logger } from "./utils/logger";
import { performance } from "perf_hooks";

async function startServer() {
  const app = express();
  const PORT = process.env.PORT || 3000;

  app.use(express.json());

  // === CUSTOM LOGGER MIDDLEWARE ===
  app.use((req, res, next) => {
    const start = performance.now();
    res.on("finish", () => {
      // Skip Vite internal requests
      if (req.url.includes('node_modules') || req.url.includes('@vite')) return;
      
      const durationMs = Number((performance.now() - start).toFixed(2));
      const status = res.statusCode;
      
      let level: 'info' | 'warn' | 'error' = 'info';
      if (status >= 400 && status < 500) level = 'warn';
      else if (status >= 500) level = 'error';
      
      logger[level](`← ${req.method} ${req.url} ${status}`, { durationMs });
    });
    next();
  });
  // ================================

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
    console.log(`\n🚀 LANS Backend Server initialized successfully!`);
    console.log(`================================================`);
    console.log(`🌍 Server URL:        http://localhost:${PORT}`);
    console.log(`🔗 Sui Network:       ${process.env.VITE_SUI_NETWORK || 'testnet'}`);
    console.log(`📦 Policy Package ID: ${process.env.VITE_AGENT_POLICY_PACKAGE_ID ? process.env.VITE_AGENT_POLICY_PACKAGE_ID.substring(0, 10) + "..." : 'Not Set'}`);
    console.log(`🤖 AI Engine:         ${process.env.OPENROUTER_API_KEY ? 'Connected (OpenRouter)' : 'Not Configured (Missing API Key)'}`);
    console.log(`\n✅ Routes loaded:`);
    console.log(`   - /api/v1/auth`);
    console.log(`   - /api/v1/wallet`);
    console.log(`   - /api/v1/agents`);
    console.log(`   - /api/v1/nfts`);
    console.log(`   - /api/v1/deepbook`);
    console.log(`================================================\n`);
  });
}

startServer();
