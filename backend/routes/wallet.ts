import { Router } from "express";
import { SuiGraphQLClient } from "@mysten/sui/graphql";

export const walletRouter = Router();

const graphqlClient = new SuiGraphQLClient({
  url: process.env.VITE_SUI_GRAPHQL_URL || "https://sui-testnet.mystenlabs.com/graphql",
  //@ts-ignore
  network: "testnet"
});

/**
 * GET /api/v1/wallet/profile?address=0x...
 * Fetches real on-chain balance for the given Sui address.
 */
walletRouter.get("/profile", async (req, res) => {
  const address = req.query.address as string;

  if (!address) {
    return res.status(400).json({ error: "Missing 'address' query parameter" });
  }

  try {
    const result = await graphqlClient.query({
      query: `
        query GetWalletProfile($owner: SuiAddress!) {
          address(address: $owner) {
            balance(type: "0x2::sui::SUI") {
              totalBalance
            }
            balances(first: 10) {
              nodes {
                coinType { repr }
                totalBalance
              }
            }
          }
        }
      `,
      variables: { owner: address }
    });

    const data = (result.data as any)?.address;
    const suiBalance = data?.balance?.totalBalance || "0";
    const allBalances = data?.balances?.nodes?.map((b: any) => ({
      coinType: b.coinType?.repr || "Unknown",
      totalBalance: b.totalBalance
    })) || [];

    res.json({
      address,
      balance: `${(Number(suiBalance) / 1e9).toFixed(4)} SUI`,
      balanceRaw: suiBalance,
      allBalances
    });
  } catch (err: any) {
    console.error("Wallet profile error:", err.message);
    res.status(500).json({ error: "Failed to fetch wallet profile from chain" });
  }
});
