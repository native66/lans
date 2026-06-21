import { BadgeCheck, AlertCircle, Shield, Clock } from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { useCurrentAccount } from '@mysten/dapp-kit-react';
import { SuiGraphQLClient } from '@mysten/sui/graphql';

const graphqlClient = new SuiGraphQLClient({
  url: 'https://sui-testnet.mystenlabs.com/graphql',
  network: 'testnet' as const
});

export default function NftsPage() {
  const account = useCurrentAccount();
  const AGENT_POLICY_PACKAGE_ID = (import.meta as any).env.VITE_AGENT_POLICY_PACKAGE_ID || "0xYOUR_PACKAGE_ID";

  const { data: vaultsData, isLoading } = useQuery({
    queryKey: ['nft-passports', account?.address],
    queryFn: async () => {
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
          owner: account!.address,
          type: `${AGENT_POLICY_PACKAGE_ID}::policy::AgentVault`
        }
      });
      return (result.data as any)?.address?.objects?.nodes || [];
    },
    enabled: !!account && AGENT_POLICY_PACKAGE_ID !== "0xYOUR_PACKAGE_ID",
  });

  const nfts = vaultsData?.map((obj: any) => {
    const fields = obj?.asMoveObject?.contents?.json;
    const nowMs = Date.now();
    const expirationMs = Number(fields?.expiration_ms || 0);
    const isActive = expirationMs > nowMs;
    const budgetSui = (Number(fields?.budget || 0) / 1e9).toFixed(2);

    let timeLeft = "Shutdown";
    if (isActive) {
      const diffMs = expirationMs - nowMs;
      const hours = Math.floor(diffMs / 3600000);
      const mins = Math.floor((diffMs % 3600000) / 60000);
      timeLeft = `${hours}h ${mins}m`;
    }

    return {
      id: obj.address,
      agentId: fields?.agent_pubkey || "Unknown",
      status: isActive ? "Active" : "Shutdown",
      budget: `${budgetSui} SUI`,
      strategy: "DeepBook V3 Trading",
      expires: timeLeft
    };
  }) || [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Agent Passports</h1>
          <p className="text-slate-500 font-medium mt-1">On-chain NFT permissions for your autonomous agents.</p>
        </div>
      </div>

      {isLoading ? (
        <div className="py-20 text-center text-slate-500 font-medium bg-white/40 backdrop-blur-xl border border-white/60 rounded-3xl shadow-sm">Loading on-chain passports...</div>
      ) : nfts.length === 0 ? (
        <div className="py-20 text-center text-slate-600 font-semibold bg-white/60 backdrop-blur-xl border border-white/60 rounded-3xl shadow-sm">
          {!account 
            ? "Connect your wallet to view Agent Passports." 
            : AGENT_POLICY_PACKAGE_ID === "0xYOUR_PACKAGE_ID"
              ? "Contract not deployed yet. Deploy the AgentPolicy contract to create passports."
              : "No passports found. Deploy an agent to create an on-chain Vault Passport."
          }
        </div>
      ) : (
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {nfts.map((nft: any) => (
          <div key={nft.id} className="relative overflow-hidden rounded-3xl group shadow-sm hover:shadow-lg transition-shadow bg-slate-900 aspect-[3/4] flex flex-col justify-end">
            {/* Background Image */}
            <div 
              className="absolute inset-0 bg-cover bg-center transition-transform duration-500 group-hover:scale-105 opacity-80 mix-blend-screen"
              style={{ backgroundImage: 'url(/nfts/passport.png)' }}
            />
            {/* Gradient Overlay to make text readable */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent" />
            
            {/* Top Status Badge */}
            <div className="absolute top-4 right-4 z-10">
               <div className={`px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider rounded-md backdrop-blur-md ${
                  nft.status === 'Active' ? 'bg-green-500/20 text-green-300 border border-green-500/50' : 'bg-red-500/20 text-red-300 border border-red-500/50'
                }`}>
                  {nft.status}
                </div>
            </div>

            {/* Bottom Content Overlay */}
            <div className="relative z-10 p-5 space-y-3">
              <div className="space-y-1">
                <h3 className="text-xl font-bold text-white flex items-center gap-2">
                  {nft.id.substring(0, 8)}...
                  {nft.status === 'Active' ? (
                    <BadgeCheck className="w-5 h-5 text-green-400" />
                  ) : (
                    <AlertCircle className="w-5 h-5 text-slate-400" />
                  )}
                </h3>
                <p className="font-mono text-xs text-slate-300 truncate" title={nft.agentId}>
                  Agent: {nft.agentId}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3 bg-white/10 backdrop-blur-md rounded-xl p-3 border border-white/20">
                <div>
                  <span className="flex items-center gap-1 font-semibold text-[10px] uppercase tracking-wider text-slate-400"><Shield className="w-3 h-3" /> Budget</span>
                  <span className="font-bold font-mono text-white text-sm">{nft.budget}</span>
                </div>
                <div>
                  <span className="flex items-center gap-1 font-semibold text-[10px] uppercase tracking-wider text-slate-400"><Clock className="w-3 h-3" /> Time Left</span>
                  <span className="font-bold font-mono text-white text-sm">{nft.expires}</span>
                </div>
              </div>

              {nft.status === 'Active' && (
                <Button className="w-full font-bold rounded-xl h-10 mt-2 bg-white/10 hover:bg-red-500/80 text-white backdrop-blur-md border border-white/20 hover:border-red-500 transition-colors">
                  Revoke Passport
                </Button>
              )}
            </div>
          </div>
        ))}
      </div>
      )}
    </div>
  );
}
