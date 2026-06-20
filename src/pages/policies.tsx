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
          <h1 className="text-3xl font-bold tracking-tight">Security Policies</h1>
          <p className="text-foreground/60">Define sandboxes to strictly limit AI agent capabilities.</p>
        </div>
        <Button className="bg-primary text-blue-950">
          <Plus className="w-4 h-4 mr-2" />
          Create Policy
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {isLoading ? (
          <div className="col-span-2 text-center py-10 text-foreground/50">Loading on-chain policies...</div>
        ) : policies.length === 0 ? (
          <div className="col-span-2 text-center py-10 text-foreground/50">No policies found. Deploy an agent to create a Vault Policy.</div>
        ) : policies.map((policy) => (
          <Card key={policy.id}>
            <CardHeader>
              <div className="flex justify-between items-start">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                    <Shield className="w-5 h-5" />
                  </div>
                  <div>
                    <CardTitle className="text-lg">{policy.name}</CardTitle>
                    <CardDescription className="font-mono text-xs mt-1" title={policy.agent}>Agent: {policy.agent.substring(0, 10)}...</CardDescription>
                  </div>
                </div>
                <div className="bg-card border border-border px-2 py-1 rounded text-xs flex items-center gap-1 text-foreground/70">
                  <Lock className="w-3 h-3" /> Immutable
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="bg-background/50 rounded-lg p-4 space-y-3 text-sm border border-border">
                <div className="grid grid-cols-2 gap-4 border-b border-border pb-3">
                  <div>
                    <span className="text-foreground/50 block text-xs mb-1">Allowed Protocols</span>
                    <div className="flex gap-1 flex-wrap">
                      {policy.protocols.map((p) => (
                        <span key={p} className="px-2 py-0.5 rounded bg-card border border-border text-xs">{p}</span>
                      ))}
                    </div>
                  </div>
                  <div>
                    <span className="text-foreground/50 block text-xs mb-1">Allowed Assets</span>
                    <div className="flex gap-1 flex-wrap">
                      {policy.assets.map((a) => (
                        <span key={a} className="px-2 py-0.5 rounded bg-card border border-border text-xs">{a}</span>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <span className="text-foreground/50 block text-xs">Remaining Budget</span>
                    <span className="font-mono">{policy.budget}</span>
                  </div>
                  <div>
                    <span className="text-foreground/50 block text-xs">Expiration Date</span>
                    <span className="font-mono">{policy.expires}</span>
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
