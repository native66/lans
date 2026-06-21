import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Activity, ArrowDownRight, Wallet, ExternalLink } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useCurrentAccount } from '@mysten/dapp-kit-react';
import { SuiGraphQLClient } from '@mysten/sui/graphql';

const graphqlClient = new SuiGraphQLClient({
  url: 'https://sui-testnet.mystenlabs.com/graphql',
  network: 'testnet' as const
});

export default function DeepBookPage() {
  const account = useCurrentAccount();

  // Fetch real on-chain balances
  const { data: balancesData, isLoading: balancesLoading } = useQuery({
    queryKey: ['deepbook-balances', account?.address],
    queryFn: async () => {
      const result = await graphqlClient.query({
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
        variables: { owner: account!.address }
      });
      return (result.data as any)?.address?.balances?.nodes || [];
    },
    enabled: !!account,
  });

  // Extract SUI and USDC balances from on-chain data
  const suiBalance = balancesData?.find((b: any) => b.coinType?.repr?.includes('sui::SUI'));
  const usdcBalance = balancesData?.find((b: any) => b.coinType?.repr?.includes('usdc::USDC') || b.coinType?.repr?.includes('USDC'));

  const formattedSui = suiBalance ? (Number(suiBalance.totalBalance) / 1e9).toFixed(2) : "0.00";
  const formattedUsdc = usdcBalance ? (Number(usdcBalance.totalBalance) / 1e6).toFixed(2) : "0.00";

  // Fetch pool data from backend
  const { data: orderbook, isLoading } = useQuery({
    queryKey: ["deepbook", "pool-status"],
    queryFn: async () => {
      const res = await fetch("/api/v1/deepbook/orders/0xdee9");
      return res.json();
    }
  });

  return (
    <div className="space-y-6 h-full flex flex-col">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">DeepBook Integration</h1>
          <p className="text-slate-500 font-medium mt-1">Live liquidity and order execution environment.</p>
        </div>
        <div className="flex gap-2 items-center">
          <div className="bg-white/80 backdrop-blur-xl border border-white/60 shadow-sm rounded-lg px-4 py-2 flex items-center text-sm font-bold text-slate-700">
            <span className="w-2 h-2 rounded-full bg-green-500 mr-2 animate-pulse shadow-[0_0_8px_rgba(34,197,94,0.6)]" /> SUI/USDC
          </div>
          <a
            href="https://deepbook.tech"
            target="_blank"
            rel="noopener noreferrer"
            className="bg-[#005CBE] hover:bg-[#004e9f] text-white gap-2 rounded-full px-5 py-2 shadow-md transition-all hover:scale-105 text-sm font-semibold flex items-center"
          >
            <ExternalLink className="w-4 h-4" />
            deepbook.tech
          </a>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 flex-1 min-h-[500px]">
        {/* Orderbook Panel */}
        <Card className="flex flex-col bg-white/80 backdrop-blur-xl border-white/60 shadow-sm rounded-3xl overflow-hidden">
          <CardHeader className="py-5 border-b border-slate-100 bg-white/40">
            <CardTitle className="text-base font-bold text-slate-900 flex items-center justify-between">
              DeepBook V3 Pool
              <span className="text-xs font-semibold text-slate-400 bg-slate-50 px-2 py-1 rounded-md">Testnet</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0 flex-1 flex flex-col">
            <div className="flex-1 overflow-auto p-6 flex flex-col items-center justify-center bg-white/30">
              {isLoading ? (
                <span className="text-slate-400 font-medium">Loading DeepBook status...</span>
              ) : (
                <div className="w-full space-y-6 text-center">
                  <div className="w-16 h-16 rounded-full bg-[#EAF2FF] flex items-center justify-center mx-auto text-[#005CBE] shadow-inner">
                    <Activity className="w-8 h-8" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-slate-900">DeepBook V3 Protocol</h3>
                    <p className="text-sm font-medium text-slate-500 mt-2 max-w-xs mx-auto">
                      {orderbook?.exists 
                        ? `Pool found on-chain (v${orderbook.version})`
                        : "Connect to deepbook.tech for full orderbook visualization and trading."
                      }
                    </p>
                  </div>
                  
                  <div className="bg-slate-50/50 rounded-2xl p-4 border border-slate-100 space-y-3 text-left">
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Protocol</span>
                      <span className="text-sm font-bold text-slate-900">DeepBook V3</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Network</span>
                      <span className="text-sm font-bold text-[#005CBE]">Sui Testnet</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Status</span>
                      <span className="text-sm font-bold text-green-600 flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" /> Live
                      </span>
                    </div>
                  </div>

                  <a
                    href="https://deepbook.tech"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 bg-[#EAF2FF] text-[#005CBE] hover:bg-blue-100 px-6 py-3 rounded-xl font-semibold text-sm transition-colors"
                  >
                    View Full Orderbook <ExternalLink className="w-4 h-4" />
                  </a>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Chart / Central Panel */}
        <div className="lg:col-span-2 flex flex-col gap-6">
          <Card className="flex-1 flex items-center justify-center border-dashed border-2 border-slate-200 bg-white/40 backdrop-blur-xl shadow-sm rounded-3xl relative overflow-hidden">
             <div className="absolute inset-0 bg-center bg-[length:20px_20px] opacity-10" style={{ backgroundImage: 'radial-gradient(circle, #005CBE 1.5px, transparent 1.5px)' }} />
             <div className="text-center space-y-3 z-10 p-8 bg-white/60 backdrop-blur-md rounded-2xl border border-white/60 shadow-sm mx-4">
               <div className="w-16 h-16 rounded-full bg-[#EAF2FF] flex items-center justify-center mx-auto text-[#005CBE] shadow-inner">
                 <Activity className="w-8 h-8" />
               </div>
               <h3 className="text-xl font-bold text-slate-900">Live Chart Interface</h3>
               <p className="text-sm font-medium text-slate-500 max-w-sm mx-auto">
                 Connects directly to Sui RPC for live on-chain data visualization. 
                 Visit <a href="https://deepbook.tech" target="_blank" rel="noopener noreferrer" className="text-[#005CBE] underline">deepbook.tech</a> for real-time charts.
               </p>
             </div>
          </Card>
          
          <div className="grid grid-cols-2 gap-4 h-40">
            <Card className="bg-white/80 backdrop-blur-xl border-white/60 shadow-sm rounded-3xl overflow-hidden hover:shadow-md transition-shadow">
              <CardContent className="flex flex-col justify-center h-full p-6">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2 flex items-center gap-2">
                  <div className="w-6 h-6 rounded-md bg-[#EAF2FF] text-[#005CBE] flex items-center justify-center"><Wallet className="w-3.5 h-3.5"/></div> 
                  SUI Balance
                </span>
                {balancesLoading ? (
                  <span className="text-lg text-slate-400">Loading...</span>
                ) : (
                  <span className="text-3xl font-bold text-slate-900">
                    {formattedSui.split('.')[0]}.<span className="text-slate-400">{formattedSui.split('.')[1]}</span>
                  </span>
                )}
              </CardContent>
            </Card>
            <Card className="bg-white/80 backdrop-blur-xl border-white/60 shadow-sm rounded-3xl overflow-hidden hover:shadow-md transition-shadow">
              <CardContent className="flex flex-col justify-center h-full p-6">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2 flex items-center gap-2">
                  <div className="w-6 h-6 rounded-md bg-[#EAF2FF] text-[#005CBE] flex items-center justify-center"><Wallet className="w-3.5 h-3.5"/></div> 
                  USDC Balance
                </span>
                {balancesLoading ? (
                  <span className="text-lg text-slate-400">Loading...</span>
                ) : (
                  <span className="text-3xl font-bold text-slate-900">
                    {formattedUsdc.split('.')[0]}.<span className="text-slate-400">{formattedUsdc.split('.')[1]}</span>
                  </span>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
