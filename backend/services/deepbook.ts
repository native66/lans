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
    
    // Step 1: Extract Budget + Hot Potato Receipt from Vault
    const [tradeCoin, tradeReceipt] = tx.moveCall({
      target: `${AGENT_POLICY_PACKAGE_ID}::policy::execute_trade`,
      arguments: [
        tx.object(vaultId),
        tx.pure.u64(amountMist),
        tx.object.clock() // Clock
      ]
    });

    let baseProceeds, quoteProceeds;

    if (intent.type === "flash_loan") {
      // ADVANCED: Flash Loan Arbitrage Flow
      // Borrow assets without collateral, trade, and return in 1 block
      const [borrowedBase, flashReceipt] = tx.moveCall({
        target: `${DEEPBOOK_PACKAGE_ID}::pool::borrow_flashloan_base`,
        arguments: [tx.object(poolInfo.address), tx.pure.u64(amountMist)]
      });

      // Trade logic here (e.g., swap on a DEX) - Simplified for hackathon
      
      // Repay Flash Loan
      tx.moveCall({
        target: `${DEEPBOOK_PACKAGE_ID}::pool::repay_flashloan_base`,
        arguments: [tx.object(poolInfo.address), flashReceipt, borrowedBase] // Simplified
      });

      baseProceeds = tradeCoin; // Using extracted coin directly if arbitrary
    } else {
      // Extract single zero coin using proper destructuring to prevent Result Proxy error
      const [zeroQuote] = tx.moveCall({ 
        target: '0x2::coin::zero', 
        typeArguments: [poolInfo.quoteType] 
      });

      // STANDARD: Spot Trading on Deepbook
      [baseProceeds, quoteProceeds] = tx.moveCall({
        target: `${DEEPBOOK_PACKAGE_ID}::pool::place_limit_order`,
        arguments: [
          tx.object(poolInfo.address),
          tx.pure.u64(Date.now()), // clientOrderId
          tx.pure.u8(0), // order_type
          tx.pure.u8(0), // self_matching
          tx.pure.u64(0), // price (simplified)
          tx.pure.u64(amountMist), // quantity
          tx.pure.bool(intent.action === "buy"), // isBid
          tradeCoin, // base_coin
          zeroQuote, // quote_coin (destructured proxy to prevent 'Expected Object but received Object')
          tx.object.clock() // Clock
        ]
      });
    }

    // Transfer leftover quote Proceeds back to the Vault to prevent 'Cannot ignore values without drop ability' error
    if (quoteProceeds) {
      tx.transferObjects([quoteProceeds], tx.pure.address(vaultId));
    }

    // Step 3: MUST Consume Hot Potato Receipt to prevent theft
    tx.moveCall({
      target: `${AGENT_POLICY_PACKAGE_ID}::policy::confirm_trade`,
      typeArguments: ['0x2::sui::SUI'],
      arguments: [
        tx.object(vaultId),
        tradeReceipt,
        baseProceeds
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
