import { Card, CardContent } from "@/components/ui/card";
import { History, ExternalLink, ShieldCheck, ArrowRight } from "lucide-react";

import { useQuery } from "@tanstack/react-query";
import { SuiGraphQLClient } from '@mysten/sui/graphql';

const graphqlClient = new SuiGraphQLClient({
  url: 'https://sui-testnet.mystenlabs.com/graphql',
  network: 'testnet' as const
});

export default function ActivityPage() {
  const AGENT_POLICY_PACKAGE_ID = (import.meta as any).env.VITE_AGENT_POLICY_PACKAGE_ID || "0xYOUR_PACKAGE_ID";

  const { data: events, isLoading } = useQuery({
    queryKey: ["agent-activity-events", AGENT_POLICY_PACKAGE_ID],
    queryFn: async () => {
      if (AGENT_POLICY_PACKAGE_ID === "0xYOUR_PACKAGE_ID") return [];
      
      const result = await graphqlClient.query({
        query: `
          query QueryEvents($type: String, $first: Int) {
            events(first: $first, filter: { eventType: $type }) {
              nodes {
                timestamp
                contents { json }
                sender { address }
                transactionBlock { digest }
              }
            }
          }
        `,
        variables: { type: `${AGENT_POLICY_PACKAGE_ID}::policy::TradeLog`, first: 50 }
      });
      return (result.data as any)?.events?.nodes || [];
    },
    enabled: AGENT_POLICY_PACKAGE_ID !== "0xYOUR_PACKAGE_ID"
  });

  const logs = events?.map((event: any, index: number) => {
    const parsed = event?.contents?.json;
    const date = event.timestamp ? new Date(event.timestamp).toLocaleString() : new Date().toLocaleString();
    const digest = event?.transactionBlock?.digest || "-";
    return {
      id: index,
      type: "Trade Executed",
      agent: parsed?.agent || "AI Agent Wallet",
      details: `Spent ${parsed?.amount_spent} SUI (MIST)`,
      time: date,
      hash: digest,
      status: "success"
    };
  }) || [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">On-Chain Activity</h1>
        <p className="text-foreground/60">Verifiable logs of all autonomous agent actions.</p>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="divide-y divide-border">
            {isLoading ? (
               <div className="p-8 text-center text-foreground/50">Loading on-chain events...</div>
            ) : logs.length === 0 ? (
               <div className="p-8 text-center text-foreground/50">No on-chain activity found. Create a policy and execute trades to see logs here.</div>
            ) : logs.map((log) => (
              <div key={log.id} className="p-4 sm:px-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-card/50 transition-colors">
                <div className="flex items-start gap-4">
                  <div className={`mt-1 w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${log.status === 'success' ? 'bg-primary/10 text-primary' : 'bg-danger/10 text-danger'}`}>
                    {log.status === 'success' ? <ShieldCheck className="w-4 h-4" /> : <History className="w-4 h-4" />}
                  </div>
                  <div>
                    <h4 className="font-medium flex items-center gap-2">
                      {log.type}
                      <span className={`text-[10px] px-1.5 py-0.5 rounded border uppercase font-mono ${log.status === 'success' ? 'border-primary/20 text-primary bg-primary/10' : 'border-danger/20 text-danger bg-danger/10'}`}>
                        {log.status}
                      </span>
                    </h4>
                    <p className="text-sm text-foreground/60 mt-0.5">{log.agent}</p>
                    <div className="flex items-center gap-2 mt-2 text-xs font-mono text-foreground/50">
                      <span className="text-foreground">{log.details}</span>
                    </div>
                  </div>
                </div>

                <div className="flex flex-row sm:flex-col items-center sm:items-end justify-between sm:justify-center border-t sm:border-0 border-border pt-3 sm:pt-0 pl-12 sm:pl-0">
                  <span className="text-xs text-foreground/50 shrink-0">{log.time}</span>
                  {log.hash !== '-' && (
                    <a href="#" className="text-xs text-primary hover:text-primary/80 flex items-center gap-1 mt-1 font-mono">
                      {log.hash} <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
