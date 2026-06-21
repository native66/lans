import { Router } from "express";
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { SuiGraphQLClient } from "@mysten/sui/graphql";
import { SuiGrpcClient } from "@mysten/sui/grpc";
import { parseIntent } from "../services/ai";
import { deepBookService } from "../services/deepbook";
import { logger } from "../utils/logger";

export const agentsRouter = Router();

// In-memory DB for Hackathon. Stores agent keypairs securely in backend RAM.
// In production, use encrypted PostgreSQL storage.
const agentsDB: Record<string, { secretKey: string, pubkey: string, policyId?: string, name: string, prompt?: string, parsedIntent?: any, lastTxDigest?: string, executionError?: string }> = {};

const graphqlClient = new SuiGraphQLClient({
  url: process.env.VITE_SUI_GRAPHQL_URL || "https://sui-testnet.mystenlabs.com/graphql",
  //@ts-ignore
  network: "testnet"
});

/**
 * GET /api/v1/agents/list
 * Returns all registered agents. Enriches with on-chain vault status when possible.
 */
agentsRouter.get("/list", async (req, res) => {
  try {
    const agentList = await Promise.all(
      Object.keys(agentsDB).map(async (id) => {
        const agent = agentsDB[id];
        let onChainStatus = agent.policyId ? "Active" : "Awaiting Creation";

        // If agent has a policyId, verify the vault still exists on-chain
        if (agent.policyId && agent.policyId !== "Pending") {
          try {
            const result = await graphqlClient.query({
              query: `
                query CheckVault($id: SuiAddress!) {
                  object(address: $id) {
                    status
                    asMoveObject { contents { json } }
                  }
                }
              `,
              variables: { id: agent.policyId }
            });
            const obj = (result.data as any)?.object;
            if (!obj) {
              onChainStatus = "Shutdown";
            } else {
              const fields = obj.asMoveObject?.contents?.json;
              const expMs = Number(fields?.expiration_ms || 0);
              if (expMs > 0 && expMs < Date.now()) {
                onChainStatus = "Shutdown";
              }
            }
          } catch {
            // If query fails, keep the existing status
          }
        }

        return {
          id,
          name: agent.name,
          pubkey: agent.pubkey,
          policyId: agent.policyId || "Pending",
          status: onChainStatus,
          prompt: agent.prompt,
          parsedIntent: agent.parsedIntent,
          lastTxDigest: agent.lastTxDigest,
          executionError: agent.executionError
        };
      })
    );

    res.json({ agents: agentList });
  } catch (err) {
    logger.error("Failed to fetch agents list", { error: (err as Error).message });
    res.status(500).json({ error: "Failed to fetch agents" });
  }
});

/**
 * GET /api/v1/agents/pools
 * Returns real-time available pools from the DeepBook V3 Testnet Indexer.
 */
agentsRouter.get("/pools", async (_req, res) => {
  try {
    const indexerRes = await fetch("https://deepbook-indexer.testnet.mystenlabs.com/get_pools");
    if (!indexerRes.ok) throw new Error("Failed to fetch pools from DeepBook Indexer");
    const pools = await indexerRes.json();
    const formatted = (pools as any[]).map((p: any) => ({
      poolName: p.pool_name,
      base: p.base_asset_symbol,
      quote: p.quote_asset_symbol,
      poolId: p.pool_id
    }));
    res.json({ pools: formatted });
  } catch (err) {
    logger.error("Failed to fetch DeepBook pools", { error: (err as Error).message });
    res.status(500).json({ error: "Failed to fetch pools" });
  }
});

/**
 * POST /api/v1/agents/init
 * Step 1: Generate an ephemeral Ed25519 keypair for the agent.
 * Returns only the public key — secret key stays in backend RAM.
 */
agentsRouter.post("/init", async (req, res) => {
  try {
    const { name, prompt, budget } = req.body;
    
    let parsedIntent: any = null;
    if (prompt) {
      logger.info("Parsing intent during init", { prompt });
      parsedIntent = await parseIntent(prompt, Number(budget));
      const userBudget = Number(budget);
      if (parsedIntent.amount == null || isNaN(Number(parsedIntent.amount))) {
        parsedIntent.amount = userBudget;
      }
      const intentAmount = Number(parsedIntent.amount);
      
      // Validation constraint: intent amount must be <= budget
      if (!isNaN(intentAmount) && !isNaN(userBudget)) {
        if (intentAmount > userBudget) {
          logger.warn("Intent validation failed: amount > budget", { intentAmount, userBudget });
          return res.status(400).json({ error: `Intent amount (${intentAmount}) exceeds vault budget (${userBudget}). Please reduce amount or increase budget.` });
        }
      }
    }

    // Validate the pool exists on DeepBook BEFORE creating the agent (prevents wasted vault funds)
    if (parsedIntent?.pool) {
      try {
        await deepBookService.resolvePoolId(parsedIntent.pool);
      } catch (poolErr: any) {
        logger.warn("Pool validation failed at init", { pool: parsedIntent.pool, error: poolErr.message });
        return res.status(400).json({ error: `Pool "${parsedIntent.pool}" does not exist on DeepBook V3 Testnet. Available tokens: DEEP, SUI, DBUSDC, DBUSDT, WAL, DBTC. Please rephrase your intent.` });
      }
    }

    const keypair = new Ed25519Keypair();
    const id = "agent_" + Date.now();
    
    agentsDB[id] = {
      secretKey: keypair.getSecretKey(), // Secret key STRICTLY kept in Backend RAM
      pubkey: keypair.getPublicKey().toSuiAddress(),
      name: name || "Autonomous AI",
      prompt,
      parsedIntent
    };

    logger.info("Agent initialized", { id, pubkey: agentsDB[id].pubkey });

    // Only return the Public Key and parsed Intent to the Frontend
    res.json({ status: "Success", id, pubkey: agentsDB[id].pubkey, parsedIntent: agentsDB[id].parsedIntent });
  } catch (err) {
    logger.error("Failed to init agent", { error: (err as Error).message });
    res.status(500).json({ error: "Failed to init agent: " + (err as Error).message });
  }
});

/**
 * POST /api/v1/agents/confirm
 * Step 2: Confirm the on-chain vault creation and link vault ID to the agent.
 */
agentsRouter.post("/confirm", async (req, res) => {
  try {
    const { id, policyId } = req.body;
    if (!agentsDB[id]) return res.status(404).json({ error: "Agent not found" });
    
    agentsDB[id].policyId = policyId;
    
    logger.info("Vault linked to agent", { agentId: id, vaultId: policyId });

    // Auto-execute if intent was parsed
    const agent = agentsDB[id];
    if (agent.parsedIntent && policyId !== "Pending") {
       logger.info("Auto-executing agent intent", { agentId: id });
       try {
         const ptb = await deepBookService.createIntentPTB(agent.parsedIntent, policyId);
         
         const suiClient = new SuiGrpcClient({ network: "testnet", baseUrl: "https://fullnode.testnet.sui.io:443" });
         const agentKeypair = Ed25519Keypair.fromSecretKey(agent.secretKey);

         const execResult = await suiClient.signAndExecuteTransaction({
            transaction: ptb,
            signer: agentKeypair
         });

         agent.lastTxDigest = (execResult as any).digest;
         agent.executionError = undefined;
         logger.info("PTB executed automatically upon confirmation", { agentId: id, digest: agent.lastTxDigest });
       } catch(e) {
         const errMsg = (e as Error).message;
         agent.executionError = errMsg;
         logger.error("Auto-execute PTB failed", { error: errMsg });
       }
    }

    const secureResponse = { ...agent };
    delete (secureResponse as any).secretKey; // Ensure secret is never leaked
    
    res.json({ status: "Linked successfully", agent: secureResponse, executionError: agent.executionError });
  } catch (err) {
    logger.error("Failed to confirm agent", { error: (err as Error).message });
    res.status(500).json({ error: "Failed to confirm agent" });
  }
});

/**
 * GET /api/v1/agents/:id/logs
 * Fetches on-chain TradeLog events for a specific agent's vault.
 * Queries the Sui Testnet GraphQL endpoint for events emitted by the contract.
 */
agentsRouter.get("/:id/logs", async (req, res) => {
  const { id } = req.params;
  const packageId = process.env.VITE_AGENT_POLICY_PACKAGE_ID;

  logger.info("Fetching on-chain logs", { agentId: id });

  const agent = agentsDB[id];
  if (!agent) {
    logger.warn("Agent not found for logs request", { agentId: id });
    return res.status(404).json({ error: "Agent not found" });
  }
  if (!agent.policyId || agent.policyId === "Pending") {
    logger.warn("Agent vault not yet created", { agentId: id });
    return res.status(400).json({ error: "Agent vault not yet deployed on-chain.", logs: [] });
  }
  if (!packageId || packageId === "0xYOUR_PACKAGE_ID") {
    logger.warn("Package ID not configured");
    return res.status(400).json({ error: "VITE_AGENT_POLICY_PACKAGE_ID not set.", logs: [] });
  }

  try {
    // Query all TradeLog events from this contract via JSON-RPC
    const result = await fetch("https://fullnode.testnet.sui.io:443", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "suix_queryEvents",
        params: [
          { MoveEventType: `${packageId}::policy::TradeLog` },
          null,
          50,
          true
        ]
      })
    });
    
    const rpcData = await result.json();
    const allEvents = rpcData.result?.data || [];
    
    // Filter events that belong to this agent's vault
    const vaultLogs = allEvents.filter((event: any) => {
      const parsed = event.parsedJson;
      return parsed?.vault_id === agent.policyId || parsed?.agent === agent.pubkey;
    });

    // Also query the vault creation transaction via JSON-RPC
    let creationLog: any = null;
    try {
      const vaultResult = await fetch("https://fullnode.testnet.sui.io:443", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 2,
          method: "sui_getObject",
          params: [ agent.policyId, { showContent: true, showPreviousTransaction: true } ]
        })
      });
      const vaultData = await vaultResult.json();
      const vaultObj = vaultData.result?.data;
      if (vaultObj) {
        const fields = vaultObj.content?.fields;
        creationLog = {
          type: "Vault Created",
          digest: vaultObj.previousTransaction || "-",
          details: `Budget: ${fields?.budget ? (Number(fields.budget) / 1_000_000_000).toFixed(2) + ' SUI' : 'Unknown'}`,
          agent: fields?.agent_pubkey || agent.pubkey,
          status: "success",
          time: new Date().toLocaleString()
        };
      }
    } catch (e) {
      logger.warn("Could not fetch vault creation info via RPC", { error: (e as Error).message });
    }

    const logs = vaultLogs.map((event: any, index: number) => {
      const parsed = event.parsedJson;
      const date = event.timestampMs ? new Date(Number(event.timestampMs)).toLocaleString() : "-";
      return {
        id: index,
        type: "Trade Executed",
        agent: parsed?.agent || agent.pubkey,
        details: `Spent ${parsed?.amount_spent ? (Number(parsed.amount_spent) / 1_000_000_000).toFixed(4) + ' SUI' : 'Unknown'}`,
        time: date,
        digest: event.id?.txDigest || "-",
        status: "success"
      };
    });

    // Prepend vault creation log if available
    if (creationLog) {
      logs.unshift({ id: -1, ...creationLog });
    }

    logger.info("Logs fetched", { agentId: id, tradeEvents: vaultLogs.length, hasCreationLog: !!creationLog });

    res.json({ logs, vaultId: agent.policyId, totalEvents: logs.length });
  } catch (err: any) {
    logger.error("Failed to fetch on-chain logs", { agentId: id, error: err.message });
    res.status(500).json({ error: "Failed to fetch on-chain logs: " + err.message, logs: [] });
  }
});

/**
 * POST /api/v1/agents/scan
 * Scans on-chain for any AgentVault objects created by the user's wallet.
 * Populates them into the local agentsDB as read-only "Recovered" agents.
 */
agentsRouter.post("/scan", async (req, res) => {
  try {
    const { walletAddress } = req.body;
    if (!walletAddress) return res.status(400).json({ error: "Missing walletAddress" });
    
    logger.info("Scanning for missing vaults", { walletAddress });
    
    // We query all historical transactions signed by the user via JSON-RPC
    // Because AgentVaults are Shared Objects, they are NOT owned by the user and suix_getOwnedObjects will return 0.
    // Instead we find them by looking at what objects the user created in the past.
    const packageId = process.env.VITE_AGENT_POLICY_PACKAGE_ID || "";
    
    const result = await fetch("https://fullnode.testnet.sui.io:443", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "suix_queryTransactionBlocks",
        params: [
          { filter: { FromAddress: walletAddress }, options: { showObjectChanges: true } },
          null,
          50,
          true
        ]
      })
    });
    
    const txData = await result.json();
    const txNodes = txData.result?.data || [];
    const vaultIds: string[] = [];

    for (const tx of txNodes) {
      const changes = tx.objectChanges || [];
      for (const change of changes) {
        if (change.type === "created" && change.objectType && change.objectType.includes("::policy::AgentVault")) {
           vaultIds.push(change.objectId);
        }
      }
    }

    let recoveredCount = 0;

    if (vaultIds.length > 0) {
      // Get the content of all found shared vaults
      const vaultsResult = await fetch("https://fullnode.testnet.sui.io:443", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 2,
          method: "sui_multiGetObjects",
          params: [
            vaultIds,
            { showContent: true }
          ]
        })
      });

      const vaultsData = await vaultsResult.json();
      const vaultNodes = vaultsData.result || [];
      
      for (const node of vaultNodes) {
        if (node.error) continue;
        const vaultId = node.data?.objectId;
        if (!vaultId) continue;
        
        // Check if already in DB
        const exists = Object.values(agentsDB).find(a => a.policyId === vaultId);
        if (!exists) {
          const fields = node.data?.content?.fields;
          const id = "agent_recovered_" + vaultId.substring(0, 8);
          
          // Add as read-only (we lost the secret key, but we can display and revoke it)
          agentsDB[id] = {
            secretKey: "LOST_DUE_TO_RESTART",
            pubkey: fields?.agent_pubkey || "Unknown",
            name: "Recovered Vault",
            policyId: vaultId,
            prompt: "Recovered from On-chain"
          };
          recoveredCount++;
        }
      }
    }
    
    logger.info("Scan completed", { walletAddress, recoveredCount });
    res.json({ status: "Success", recoveredCount });
  } catch (err: any) {
    logger.error("Scan error", { error: err.message });
    res.status(500).json({ error: "Failed to scan vaults: " + err.message });
  }
});
