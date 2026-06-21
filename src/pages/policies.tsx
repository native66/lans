import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Shield, Plus, Lock } from "lucide-react";

import { useQuery } from "@tanstack/react-query";
import { useCurrentAccount } from '@mysten/dapp-kit-react';
import { SuiGraphQLClient } from '@mysten/sui/graphql';

const graphqlClient = new SuiGraphQLClient({
  url: 'https://sui-testnet.mystenlabs.com/graphql',
  network: 'testnet' as const
});

export default function PoliciesPage() {
  const account = useCurrentAccount();
  const AGENT_POLICY_PACKAGE_ID = (import.meta as any).env.VITE_AGENT_POLICY_PACKAGE_ID || "0xYOUR_PACKAGE_ID";

  const { data: vaultsData, isLoading } = useQuery({
    queryKey: ['owned-vaults', account?.address],
    queryFn: async () => {
      const result = await graphqlClient.query({
        query: `
          query GetVaults($owner: SuiAddress!, $type: String!) {
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
        variables: { owner: account!.address, type: `${AGENT_POLICY_PACKAGE_ID}::policy::AgentVault` }
      });
      return (result.data as any)?.address?.objects?.nodes || [];
    },
    enabled: !!account && AGENT_POLICY_PACKAGE_ID !== "0xYOUR_PACKAGE_ID",
  });

  const policies = vaultsData?.map((obj: any) => {
    const fields = obj?.asMoveObject?.contents?.json;
    const budgetSui = (Number(fields?.budget || 0) / 1e9).toFixed(2);
    const pubkey = fields?.agent_pubkey || "Unknown";
    const expirationDate = fields?.expiration_ms ? new Date(Number(fields.expiration_ms)).toLocaleDateString() : "Never";

    return {
      id: obj.address,
      name: `Vault Policy`,
      protocols: ["DeepBook V3"], 
      assets: ["SUI"],
      budget: `${budgetSui} SUI`,
      expires: expirationDate,
      agent: pubkey
    };
  }) || [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Security Policies</h1>
          <p className="text-slate-500 font-medium mt-1">Define sandboxes to strictly limit AI agent capabilities.</p>
        </div>
        <Button className="bg-[#005CBE] hover:bg-[#004e9f] text-white gap-2 rounded-full px-6 shadow-md transition-all hover:scale-105">
          <Plus className="w-4 h-4 mr-2" />
          Create Policy
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {isLoading ? (
          <div className="col-span-2 text-center py-16 text-slate-500 font-medium bg-white/40 backdrop-blur-xl border border-white/60 rounded-3xl shadow-sm">Loading on-chain policies...</div>
        ) : policies.length === 0 ? (
          <div className="col-span-2 text-center py-16 text-slate-600 font-semibold bg-white/60 backdrop-blur-xl border border-white/60 rounded-3xl shadow-sm">No policies found. Deploy an agent to create a Vault Policy.</div>
        ) : policies.map((policy) => (
          <Card key={policy.id} className="bg-white/80 backdrop-blur-xl border-white/60 shadow-sm rounded-3xl hover:shadow-md transition-shadow">
            <CardHeader>
              <div className="flex justify-between items-start">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-[#EAF2FF] flex items-center justify-center text-[#005CBE]">
                    <Shield className="w-6 h-6" />
                  </div>
                  <div>
                    <CardTitle className="text-xl font-bold text-slate-900">{policy.name}</CardTitle>
                    <CardDescription className="font-mono text-xs mt-1 text-slate-500 bg-slate-50 px-2 py-0.5 rounded-md w-fit" title={policy.agent}>Agent: {policy.agent.substring(0, 10)}...</CardDescription>
                  </div>
                </div>
                <div className="bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-xl text-xs flex items-center gap-1 font-semibold text-slate-500">
                  <Lock className="w-3 h-3" /> Immutable
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="bg-slate-50/50 rounded-2xl p-5 space-y-4 text-sm border border-slate-100">
                <div className="grid grid-cols-2 gap-4 border-b border-slate-100 pb-4">
                  <div>
                    <span className="text-slate-400 font-semibold uppercase tracking-wider block text-[10px] mb-2">Allowed Protocols</span>
                    <div className="flex gap-1.5 flex-wrap">
                      {policy.protocols.map((p: string) => (
                        <span key={p} className="px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-xs font-medium text-slate-700 shadow-sm">{p}</span>
                      ))}
                    </div>
                  </div>
                  <div>
                    <span className="text-slate-400 font-semibold uppercase tracking-wider block text-[10px] mb-2">Allowed Assets</span>
                    <div className="flex gap-1.5 flex-wrap">
                      {policy.assets.map((a: string) => (
                        <span key={a} className="px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-xs font-medium text-slate-700 shadow-sm">{a}</span>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4 pt-1">
                  <div>
                    <span className="text-slate-400 font-semibold uppercase tracking-wider block text-[10px] mb-1">Remaining Budget</span>
                    <span className="font-mono font-bold text-slate-900">{policy.budget}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 font-semibold uppercase tracking-wider block text-[10px] mb-1">Expiration Date</span>
                    <span className="font-mono font-bold text-slate-900">{policy.expires}</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
