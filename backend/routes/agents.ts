import { Router } from "express";
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { SuiGraphQLClient } from "@mysten/sui/graphql";

export const agentsRouter = Router();

// In-memory DB for Hackathon. In production, use PostgreSQL/SQLite.
const agentsDB: Record<string, { secretKey: string, pubkey: string, policyId?: string, name: string }> = {};

const graphqlClient = new SuiGraphQLClient({
  url: process.env.VITE_SUI_GRAPHQL_URL || "https://sui-testnet.mystenlabs.com/graphql",
  //@ts-ignore
  network: "testnet"
});

agentsRouter.get("/list", async (req, res) => {
  try {
    // Return actual agents from our DB without exposing their secret keys
    const agentList = Object.keys(agentsDB).map(id => ({
      id,
      name: agentsDB[id].name,
      pubkey: agentsDB[id].pubkey,
      policyId: agentsDB[id].policyId || "Pending",
      status: agentsDB[id].policyId ? "Active" : "Awaiting Creation"
    }));
    res.json({ agents: agentList });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch agents" });
  }
});

// Step 1: Init Agent (Generate Keypair)
agentsRouter.post("/init", (req, res) => {
  try {
    const { name } = req.body;
    const keypair = new Ed25519Keypair();
    const id = "agent_" + Date.now();
    
    agentsDB[id] = {
      secretKey: keypair.getSecretKey(), // Secret key STRICTLY kept in Backend RAM
      pubkey: keypair.getPublicKey().toSuiAddress(),
      name: name || "Autonomous AI"
    };

    // Only return the Public Key to the Frontend
    res.json({ status: "Success", id, pubkey: agentsDB[id].pubkey });
  } catch (err) {
    res.status(500).json({ error: "Failed to init agent" });
  }
});

// Step 3: Confirm Policy creation on-chain and link to Agent ID
agentsRouter.post("/confirm", (req, res) => {
  try {
    const { id, policyId } = req.body;
    if (!agentsDB[id]) return res.status(404).json({ error: "Agent not found" });
    
    agentsDB[id].policyId = policyId;
    
    const secureResponse = { ...agentsDB[id] };
    delete (secureResponse as any).secretKey; // Ensure secret is never leaked
    
    res.json({ status: "Linked successfully", agent: secureResponse });
  } catch (err) {
    res.status(500).json({ error: "Failed to confirm agent" });
  }
});
