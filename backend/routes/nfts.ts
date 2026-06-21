import { Router } from "express";
import { SuiGraphQLClient } from "@mysten/sui/graphql";

export const nftsRouter = Router();

const graphqlClient = new SuiGraphQLClient({
  url: process.env.VITE_SUI_GRAPHQL_URL || "https://sui-testnet.mystenlabs.com/graphql",
  //@ts-ignore
  network: "testnet"
});

/**
 * GET /api/v1/nfts/list?owner=0x...
 * Query on-chain AgentVault objects owned by the given address.
 * Each Vault acts as an NFT Passport granting agent permissions.
 */
nftsRouter.get("/list", async (req, res) => {
  const owner = req.query.owner as string;
  const packageId = process.env.VITE_AGENT_POLICY_PACKAGE_ID;

  if (!owner) {
    return res.status(400).json({ error: "Missing 'owner' query parameter" });
  }

  if (!packageId || packageId === "0xYOUR_PACKAGE_ID") {
    return res.json({ nfts: [], message: "Contract not yet deployed. VITE_AGENT_POLICY_PACKAGE_ID is not set." });
  }

  try {
    const result = await graphqlClient.query({
      query: `
        query GetNFTPassports($owner: SuiAddress!, $type: String!) {
          address(address: $owner) {
            objects(filter: { type: $type }) {
              nodes {
                address
                asMoveObject {
                  contents { json }
                }
              }
            }
          }
        }
      `,
      variables: {
        owner,
        type: `${packageId}::policy::AgentVault`
      }
    });

    const nodes = (result.data as any)?.address?.objects?.nodes || [];

    const nfts = nodes.map((obj: any) => {
      const fields = obj?.asMoveObject?.contents?.json;
      const nowMs = Date.now();
      const expirationMs = Number(fields?.expiration_ms || 0);
      const isActive = expirationMs > nowMs;
      const budgetSui = (Number(fields?.budget || 0) / 1e9).toFixed(2);

      // Calculate time remaining
      let timeLeft = "Expired";
      if (isActive) {
        const diffMs = expirationMs - nowMs;
        const hours = Math.floor(diffMs / 3600000);
        const mins = Math.floor((diffMs % 3600000) / 60000);
        timeLeft = `${hours}h ${mins}m`;
      }

      return {
        id: obj.address,
        agentId: fields?.agent_pubkey || "Unknown",
        status: isActive ? "Active" : "Expired",
        budget: `${budgetSui} SUI`,
        strategy: "DeepBook V3 Trading",
        expires: timeLeft
      };
    });

    res.json({ nfts });
  } catch (err: any) {
    console.error("NFT list error:", err.message);
    res.status(500).json({ error: "Failed to fetch NFT passports from chain" });
  }
});
