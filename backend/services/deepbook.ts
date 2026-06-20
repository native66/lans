import { SuiGraphQLClient } from "@mysten/sui/graphql";
import { Transaction } from "@mysten/sui/transactions";
import { AIIntent } from "./ai";

const SUI_GRAPHQL_URL = process.env.VITE_SUI_GRAPHQL_URL || "https://sui-testnet.mystenlabs.com/graphql";
const DEEPBOOK_PACKAGE_ID = process.env.VITE_DEEPBOOK_PACKAGE_ID || "0xdee9";
const AGENT_POLICY_PACKAGE_ID = process.env.VITE_AGENT_POLICY_PACKAGE_ID || "0xYOUR_PACKAGE_ID";

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
   * Generates an Advanced PTB based on AI Intent
   */
  async createIntentPTB(intent: AIIntent, vaultId: string) {
    const tx = new Transaction();
    
    // Step 1: Extract Budget + Hot Potato Receipt from Vault
    const [tradeCoin, tradeReceipt] = tx.moveCall({
      target: `${AGENT_POLICY_PACKAGE_ID}::policy::execute_trade`,
      arguments: [
        tx.object(vaultId),
        tx.pure.u64(intent.amount),
        tx.object("0x6") // Clock
      ]
    });

    let baseProceeds, quoteProceeds;

    if (intent.type === "flash_loan") {
      // ADVANCED: Flash Loan Arbitrage Flow
      // Borrow assets without collateral, trade, and return in 1 block
      const [borrowedBase, flashReceipt] = tx.moveCall({
        target: `${DEEPBOOK_PACKAGE_ID}::pool::borrow_flashloan_base`,
        arguments: [tx.object(intent.pool), tx.pure.u64(intent.amount)]
      });

      // Trade logic here (e.g., swap on a DEX) - Simplified for hackathon
      
      // Repay Flash Loan
      tx.moveCall({
        target: `${DEEPBOOK_PACKAGE_ID}::pool::repay_flashloan_base`,
        arguments: [tx.object(intent.pool), flashReceipt, borrowedBase] // Simplified
      });

      baseProceeds = tradeCoin; // Using extracted coin directly if arbitrary
    } else {
      // STANDARD: Spot Trading on Deepbook
      [baseProceeds, quoteProceeds] = tx.moveCall({
        target: `${DEEPBOOK_PACKAGE_ID}::pool::place_limit_order`,
        arguments: [
          tx.object(intent.pool),
          tx.pure.u64(Date.now()), // clientOrderId
          tx.pure.u8(0), // order_type
          tx.pure.u8(0), // self_matching
          tx.pure.u64(0), // price (simplified)
          tx.pure.u64(intent.amount), // quantity
          tx.pure.bool(intent.action === "buy"), // isBid
          tradeCoin, // base_coin
          tx.moveCall({ target: '0x2::coin::zero', typeArguments: ['0x2::sui::SUI'] }), // quote_coin (simplified dummy)
          tx.object("0x6") // Clock
        ]
      });
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

  async getOrderBook(poolId: string) {
    const query = `
      query getDeepbookPool($id: SuiAddress!) {
        object(address: $id) {
          asMoveObject { contents { json } }
        }
      }
    `;

    const response = await this.client.query({ query, variables: { id: poolId } });
    if (!response.data || !response.data.object) {
      throw new Error(`Pool ${poolId} not found on Testnet.`);
    }

    const responseData = response.data as any;
    return {
      poolState: responseData.object?.asMoveObject?.contents?.json,
      bids: [], asks: []
    };
  }
}

export const deepBookService = new DeepBookService();
