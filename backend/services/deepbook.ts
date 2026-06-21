import { SuiGraphQLClient } from "@mysten/sui/graphql";
import { Transaction } from "@mysten/sui/transactions";
import { AIIntent } from "./ai";

const SUI_GRAPHQL_URL = process.env.VITE_SUI_GRAPHQL_URL;
const DEEPBOOK_PACKAGE_ID = process.env.VITE_DEEPBOOK_PACKAGE_ID;
const AGENT_POLICY_PACKAGE_ID = process.env.VITE_AGENT_POLICY_PACKAGE_ID;

if (!SUI_GRAPHQL_URL) throw new Error("VITE_SUI_GRAPHQL_URL is missing in .env");
if (!DEEPBOOK_PACKAGE_ID) throw new Error("VITE_DEEPBOOK_PACKAGE_ID is missing in .env");
if (!AGENT_POLICY_PACKAGE_ID) throw new Error("VITE_AGENT_POLICY_PACKAGE_ID is missing in .env");

export class DeepBookService {
  private client: SuiGraphQLClient;

  constructor() {
    this.client = new SuiGraphQLClient({
      url: SUI_GRAPHQL_URL,
      // @ts-ignore
      network: "testnet" 
    });
  }

  /**
   * Dynamically fetch DeepBook V3 Pool ID from Sui GraphQL using token symbols
   */
  async resolvePoolId(poolName: string): Promise<{ address: string, baseType: string, quoteType: string }> {
    if (!poolName || typeof poolName !== "string") {
      throw new Error(`Invalid pool string: ${poolName}`);
    }

    const parts = poolName.split('_');
    const base = parts[0]?.toUpperCase() || "SUI";
    const quote = (parts[1] || "USDC").toUpperCase();

    // Query official DeepBook V3 Indexer to find the dynamic pool without hardcoding any token IDs!
    const indexerRes = await fetch("https://deepbook-indexer.testnet.mystenlabs.com/get_pools");
    if (!indexerRes.ok) {
      throw new Error("Failed to fetch pools from DeepBook Indexer");
    }
    
    const pools = await indexerRes.json();
    
    // Attempt to find the exact pair. In Testnet, USDC is often DBUSDC.
    const quoteAlias = quote === "USDC" ? "DBUSDC" : quote;

    // Search for a pool matching base and quote aliases
    const matchedPool = pools.find((p: any) => 
      (p.base_asset_symbol.toUpperCase() === base && p.quote_asset_symbol.toUpperCase() === quoteAlias) ||
      (p.base_asset_symbol.toUpperCase() === quoteAlias && p.quote_asset_symbol.toUpperCase() === base)
    );

    if (!matchedPool) {
      throw new Error(`Real On-chain Pool not found for pair: ${base}/${quoteAlias}. Check Testnet Indexer.`);
    }

    // Return the dynamic pool information
    return { 
      address: matchedPool.pool_id, 
      baseType: matchedPool.base_asset_id, 
      quoteType: matchedPool.quote_asset_id 
    };
  }

  /**
   * Generates an Advanced PTB based on AI Intent
   */
  async createIntentPTB(intent: AIIntent, vaultId: string) {
    const tx = new Transaction();
    const amountMist = Math.floor(intent.amount * 1_000_000_000);
    
    // Dynamic Pool Discovery (No Hardcode)
    const poolInfo = await this.resolvePoolId(intent.pool);
    const DEEPBOOK_PACKAGE_ID = process.env.VITE_DEEPBOOK_PACKAGE_ID || "0xfb28c4cbc6865bd1c897d26aecbe1f8792d1509a20ffec692c800660cbec6982";
    const AGENT_POLICY_PACKAGE_ID = process.env.VITE_AGENT_POLICY_PACKAGE_ID;

    // Determine if SUI is Base or Quote (Vault only holds SUI)
    const isSuiBase = poolInfo.baseType.includes("::sui::SUI") || poolInfo.baseType === "0x2::sui::SUI";
    const isSuiQuote = poolInfo.quoteType.includes("::sui::SUI") || poolInfo.quoteType === "0x2::sui::SUI";

    if (!isSuiBase && !isSuiQuote) {
       throw new Error("Vault holds SUI but the selected pool does not support SUI as base or quote.");
    }

    // Fetch Vault Owner dynamically to send swapped proceeds
    const vaultRes = await fetch("https://fullnode.testnet.sui.io:443", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "sui_getObject", params: [vaultId, { showContent: true }] })
    });
    const vaultData = await vaultRes.json();
    const vaultOwner = vaultData.result?.data?.content?.fields?.owner;
    if (!vaultOwner) throw new Error("Could not determine Vault Owner from on-chain data");

    // Step 1: Extract Budget + Hot Potato Receipt from Vault
    // Note: Our Vaults are initialized with SUI (T = 0x2::sui::SUI)
    const [tradeCoin, tradeReceipt] = tx.moveCall({
      target: `${AGENT_POLICY_PACKAGE_ID}::policy::execute_trade`,
      typeArguments: ['0x2::sui::SUI'],
      arguments: [
        tx.object(vaultId),
        tx.pure.u64(amountMist),
        tx.object.clock() // Clock
      ]
    });

    const DEEP_TYPE = "0x36dbef866a1d62bf7328989a10fb2f07d769f4ee587c0de4a0a256e57e0a58a8::deep::DEEP";

    // DeepBook V3 requires DEEP coin for fee, we pass a zero DEEP coin (fee will be deducted from output)
    const [zeroDeep] = tx.moveCall({ 
      target: '0x2::coin::zero', 
      typeArguments: [DEEP_TYPE] 
    });

    let returnedSui;

    if (isSuiBase) {
      // Swap SUI (Base) for Other (Quote)
      const [baseProceeds, quoteProceeds, deepProceeds] = tx.moveCall({
        target: `${DEEPBOOK_PACKAGE_ID}::pool::swap_exact_base_for_quote`,
        typeArguments: [poolInfo.baseType, poolInfo.quoteType],
        arguments: [
          tx.object(poolInfo.address),
          tradeCoin, // base_coin
          zeroDeep,  // deep_coin
          tx.pure.u64(0), // min_quote_amount (Simplified for Hackathon)
          tx.object.clock()
        ]
      });

      returnedSui = baseProceeds; // Leftover SUI

      // Send swapped assets to Vault Owner
      tx.moveCall({
        target: '0x2::transfer::public_transfer',
        typeArguments: [poolInfo.quoteType],
        arguments: [quoteProceeds, tx.pure.address(vaultOwner)]
      });

      // Destroy zero DEEP coin
      tx.moveCall({
        target: '0x2::coin::destroy_zero',
        typeArguments: [DEEP_TYPE],
        arguments: [deepProceeds]
      });
    } else {
      // Swap SUI (Quote) for Other (Base)
      const [baseProceeds, quoteProceeds, deepProceeds] = tx.moveCall({
        target: `${DEEPBOOK_PACKAGE_ID}::pool::swap_exact_quote_for_base`,
        typeArguments: [poolInfo.baseType, poolInfo.quoteType],
        arguments: [
          tx.object(poolInfo.address),
          tradeCoin, // quote_coin
          zeroDeep,  // deep_coin
          tx.pure.u64(0), // min_base_amount (Simplified)
          tx.object.clock()
        ]
      });

      returnedSui = quoteProceeds; // Leftover SUI

      // Send swapped assets to Vault Owner
      tx.moveCall({
        target: '0x2::transfer::public_transfer',
        typeArguments: [poolInfo.baseType],
        arguments: [baseProceeds, tx.pure.address(vaultOwner)]
      });

      // Destroy zero DEEP coin
      tx.moveCall({
        target: '0x2::coin::destroy_zero',
        typeArguments: [DEEP_TYPE],
        arguments: [deepProceeds]
      });
    }

    // Step 3: MUST Consume Hot Potato Receipt to prevent theft
    tx.moveCall({
      target: `${AGENT_POLICY_PACKAGE_ID}::policy::confirm_trade`,
      typeArguments: ['0x2::sui::SUI'],
      arguments: [
        tx.object(vaultId),
        tradeReceipt,
        returnedSui
      ]
    });
    
    return tx;
  }

  /**
   * Query real DeepBook pool state from on-chain
   */
  async getOrderBook(poolId: string) {
    try {
      const query = `
        query getDeepbookPool($id: SuiAddress!) {
          object(address: $id) {
            address
            version
            status
            asMoveObject { 
              contents { json type { repr } } 
            }
          }
        }
      `;

      const response = await this.client.query({ query, variables: { id: poolId } });
      const objectData = (response.data as any)?.object;

      if (!objectData) {
        return {
          poolId,
          exists: false,
          poolState: null,
          message: `Pool ${poolId} not found on Testnet.`
        };
      }

      return {
        poolId: objectData.address,
        exists: true,
        version: objectData.version,
        status: objectData.status,
        poolState: objectData.asMoveObject?.contents?.json,
        type: objectData.asMoveObject?.contents?.type?.repr
      };
    } catch (err: any) {
      console.error("DeepBook query error:", err.message);
      return {
        poolId,
        exists: false,
        poolState: null,
        message: "Failed to query pool: " + err.message
      };
    }
  }

  /**
   * Query real balances for a user address
   */
  async getUserBalances(owner: string) {
    try {
      const result = await this.client.query({
        query: `
          query GetBalances($owner: SuiAddress!) {
            address(address: $owner) {
              balances(first: 20) {
                nodes {
                  coinType { repr }
                  totalBalance
                }
              }
            }
          }
        `,
        variables: { owner }
      });

      const nodes = (result.data as any)?.address?.balances?.nodes || [];
      return nodes.map((b: any) => ({
        coinType: b.coinType?.repr || "Unknown",
        totalBalance: b.totalBalance,
        formatted: (Number(b.totalBalance) / 1e9).toFixed(4)
      }));
    } catch (err: any) {
      console.error("Balance query error:", err.message);
      return [];
    }
  }
}

export const deepBookService = new DeepBookService();
