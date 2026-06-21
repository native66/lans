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
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">On-Chain Activity</h1>
        <p className="text-slate-500 font-medium mt-1">Verifiable logs of all autonomous agent actions.</p>
      </div>

      <Card className="bg-white/80 backdrop-blur-xl border-white/60 shadow-sm rounded-3xl overflow-hidden">
        <CardContent className="p-0">
          <div className="divide-y divide-slate-100">
            {isLoading ? (
               <div className="p-12 text-center text-slate-400 font-medium">Loading on-chain events...</div>
            ) : logs.length === 0 ? (
               <div className="p-12 text-center text-slate-400 font-medium">No on-chain activity found. Create a policy and execute trades to see logs here.</div>
            ) : logs.map((log) => (
              <div key={log.id} className="p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-slate-50/50 transition-colors">
                <div className="flex items-start gap-5">
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 shadow-sm ${log.status === 'success' ? 'bg-[#EAF2FF] text-[#005CBE]' : 'bg-red-50 text-red-500'}`}>
                    {log.status === 'success' ? <ShieldCheck className="w-6 h-6" /> : <History className="w-6 h-6" />}
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-900 text-lg flex items-center gap-2">
                      {log.type}
                      <span className={`text-[10px] px-2 py-0.5 rounded-md uppercase font-bold tracking-wider ${log.status === 'success' ? 'text-green-700 bg-green-50' : 'text-red-700 bg-red-50'}`}>
                        {log.status}
                      </span>
                    </h4>
                    <p className="text-sm font-medium text-slate-500 mt-1">{log.agent}</p>
                    <div className="flex items-center gap-2 mt-2 text-xs font-mono font-semibold text-slate-400 bg-slate-50 w-fit px-2 py-1 rounded-md">
                      <span className="text-slate-600">{log.details}</span>
                    </div>
                  </div>
                </div>

                <div className="flex flex-row sm:flex-col items-center sm:items-end justify-between sm:justify-center pt-3 sm:pt-0 pl-17 sm:pl-0">
                  <span className="text-xs font-semibold text-slate-400 bg-slate-50 px-2 py-1 rounded-md shrink-0">{log.time}</span>
                  {log.hash !== '-' && (
                    <a href="#" className="text-xs text-[#005CBE] hover:text-[#004e9f] flex items-center gap-1 mt-2 font-mono font-semibold bg-[#EAF2FF] px-2 py-1 rounded-md transition-colors">
                      {log.hash.substring(0, 12)}... <ExternalLink className="w-3 h-3" />
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
