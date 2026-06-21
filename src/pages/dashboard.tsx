import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowUpRight, Bot, Activity, DollarSign, Wallet } from "lucide-react";
import { motion } from "motion/react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { useQuery } from "@tanstack/react-query";



import { useCurrentAccount } from '@mysten/dapp-kit-react';
import { SuiGraphQLClient } from '@mysten/sui/graphql';

const graphqlClient = new SuiGraphQLClient({
  url: 'https://sui-testnet.mystenlabs.com/graphql',
  network: 'testnet' as const
});

const AGENT_POLICY_PACKAGE_ID = (import.meta as any).env.VITE_AGENT_POLICY_PACKAGE_ID || "0xYOUR_PACKAGE_ID";

export default function DashboardPage() {
  const account = useCurrentAccount();


  // 1. Fetch Wallet Balance via GraphQL
  const { data: balanceData } = useQuery({
    queryKey: ['balance', account?.address],
    queryFn: async () => {
      const result = await graphqlClient.query({
        query: `
          query GetBalances($owner: SuiAddress!) {
            address(address: $owner) {
              balance(type: "0x2::sui::SUI") { totalBalance }
            }
          }
        `,
        variables: { owner: account!.address }
      });
      return (result.data as any)?.address?.balance?.totalBalance || "0";
    },
    enabled: !!account,
  });

  const formattedBalance = balanceData ? (Number(balanceData) / 1e9).toFixed(2) : "0.00";

  // 2. Fetch User's Agent Vaults (Active Agents & TVL) via GraphQL
  const { data: vaultsData } = useQuery({
    queryKey: ['owned-vaults', account?.address],
    queryFn: async () => {
      const result = await graphqlClient.query({
        query: `
          query GetVaults($owner: SuiAddress!, $type: String!) {
            address(address: $owner) {
              objects(filter: { type: $type }) {
                nodes {
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

  const activeAgentsCount = vaultsData?.length || 0;
  const tvlMist = vaultsData?.reduce((acc: number, obj: any) => {
    const fields = obj?.asMoveObject?.contents?.json;
    return acc + Number(fields?.budget || 0);
  }, 0) || 0;
  const tvlSui = (tvlMist / 1e9).toFixed(2);

  // 3. Fetch TradeLog Events (Global for 24h Volume & Activity) via GraphQL
  const { data: eventsData } = useQuery({
    queryKey: ['global-trade-logs'],
    queryFn: async () => {
      const result = await graphqlClient.query({
        query: `
          query QueryEvents($type: String, $first: Int) {
            events(first: $first, filter: { eventType: $type }) {
              nodes {
                timestamp
                contents { json }
              }
            }
          }
        `,
        variables: { type: `${AGENT_POLICY_PACKAGE_ID}::policy::TradeLog`, first: 100 }
      });
      return (result.data as any)?.events?.nodes || [];
    },
    enabled: AGENT_POLICY_PACKAGE_ID !== "0xYOUR_PACKAGE_ID",
    refetchInterval: 30000,
  });

  // Calculate 24h Volume
  const nowMs = Date.now();
  const oneDayMs = 24 * 60 * 60 * 1000;
  
  let volume24hMist = 0;
  const recentActivity: any[] = [];
  const hourlyBuckets = new Map<string, number>();

  if (eventsData && Array.isArray(eventsData)) {
    eventsData.forEach((event: any) => {
      const parsed = event?.contents?.json;
      if (!parsed) return;
      
      const amountMist = Number(parsed?.amount_spent || 0);
      const timeMs = new Date(event.timestamp).getTime();

      // Volume in last 24h
      if (nowMs - timeMs <= oneDayMs) {
        volume24hMist += amountMist;
      }

      // Activity list (last 3)
      if (recentActivity.length < 3) {
        recentActivity.push({
          action: "Trade Executed",
          desc: `Spent ${(amountMist / 1e9).toFixed(2)} SUI`,
          time: new Date(timeMs).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        });
      }

      // Hourly Buckets for Chart (Last 24h)
      if (nowMs - timeMs <= oneDayMs) {
        const hour = new Date(timeMs).getHours();
        const hourStr = `${hour.toString().padStart(2, '0')}:00`;
        hourlyBuckets.set(hourStr, (hourlyBuckets.get(hourStr) || 0) + (amountMist / 1e9));
      }
    });
  }

  const volume24hSui = (volume24hMist / 1e9).toFixed(2);

  // Sort and format chart data
  const performanceData = Array.from(hourlyBuckets.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([time, value]) => ({ time, value }));

  // Fallback if no chart data
  if (performanceData.length === 0) {
    performanceData.push({ time: new Date().getHours() + ":00", value: 0 });
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Overview</h1>
          <p className="text-slate-500 font-medium mt-1">Monitor your autonomous agent performance and asset allocation.</p>
        </div>
        <Button className="bg-[#005CBE] hover:bg-[#004e9f] text-white gap-2 rounded-full px-6 shadow-md transition-all hover:scale-105">
          <Bot className="w-4 h-4" />
          Deploy New Agent
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <Card className="bg-white/80 backdrop-blur-xl border-white/60 shadow-sm rounded-2xl hover:shadow-md transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-bold text-slate-500 uppercase tracking-wider">Total Value Locked</CardTitle>
              <div className="w-8 h-8 rounded-full bg-[#EAF2FF] flex items-center justify-center text-[#005CBE]">
                <DollarSign className="w-4 h-4" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-slate-900">{tvlSui} SUI</div>
              <p className="text-xs text-green-600 font-medium mt-2 flex items-center bg-green-50 w-fit px-2 py-1 rounded-md">
                <ArrowUpRight className="w-3 h-3 mr-1" /> On-chain TVL
              </p>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <Card className="bg-white/80 backdrop-blur-xl border-white/60 shadow-sm rounded-2xl hover:shadow-md transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-bold text-slate-500 uppercase tracking-wider">Active Agents</CardTitle>
              <div className="w-8 h-8 rounded-full bg-[#EAF2FF] flex items-center justify-center text-[#005CBE]">
                <Bot className="w-4 h-4" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-slate-900">{activeAgentsCount}</div>
              <p className="text-xs text-slate-500 font-medium mt-2 flex items-center bg-slate-100 w-fit px-2 py-1 rounded-md">
                Vaults deployed
              </p>
            </CardContent>
          </Card>
        </motion.div>
        
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
          <Card className="bg-white/80 backdrop-blur-xl border-white/60 shadow-sm rounded-2xl hover:shadow-md transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-bold text-slate-500 uppercase tracking-wider">Wallet Balance</CardTitle>
              <div className="w-8 h-8 rounded-full bg-[#EAF2FF] flex items-center justify-center text-[#005CBE]">
                <Wallet className="w-4 h-4" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-slate-900">{formattedBalance} <span className="text-lg">SUI</span></div>
              <p className="text-xs text-[#005CBE] font-mono mt-2 flex items-center bg-blue-50 w-fit px-2 py-1 rounded-md truncate" title={account?.address || ""}>
                {account?.address ? `${account.address.substring(0,6)}...${account.address.substring(account.address.length-4)}` : "Not connected"}
              </p>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
          <Card className="bg-white/80 backdrop-blur-xl border-white/60 shadow-sm rounded-2xl hover:shadow-md transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-bold text-slate-500 uppercase tracking-wider">24h Trade Volume</CardTitle>
              <div className="w-8 h-8 rounded-full bg-[#EAF2FF] flex items-center justify-center text-[#005CBE]">
                <Activity className="w-4 h-4" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-slate-900">{volume24hSui} <span className="text-lg">SUI</span></div>
              <p className="text-xs text-[#005CBE] font-medium mt-2 flex items-center bg-blue-50 w-fit px-2 py-1 rounded-md">
                <ArrowUpRight className="w-3 h-3 mr-1" /> Total volume in 24h
              </p>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 bg-white/80 backdrop-blur-xl border-white/60 shadow-sm rounded-3xl overflow-hidden">
          <CardHeader className="border-b border-slate-100 bg-white/40 pb-6">
            <CardTitle className="text-xl font-bold text-slate-900">Trading Volume (24h)</CardTitle>
            <CardDescription className="text-slate-500">Aggregate execution volume from on-chain TradeLog events.</CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={performanceData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,92,190,0.1)" vertical={false} />
                  <XAxis dataKey="time" stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `${value.toFixed(1)}`} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#ffffff', borderColor: 'rgba(0,92,190,0.1)', borderRadius: '12px', boxShadow: '0 4px 20px rgba(0,0,0,0.05)' }}
                    itemStyle={{ color: '#005CBE', fontWeight: 'bold' }}
                  />
                  <Line type="monotone" dataKey="value" stroke="#005CBE" strokeWidth={4} dot={false} activeDot={{ r: 8, fill: '#005CBE', stroke: '#fff', strokeWidth: 2 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white/80 backdrop-blur-xl border-white/60 shadow-sm rounded-3xl overflow-hidden flex flex-col">
          <CardHeader className="border-b border-slate-100 bg-white/40 pb-6">
            <CardTitle className="text-xl font-bold text-slate-900">Recent Activity</CardTitle>
            <CardDescription className="text-slate-500">On-chain actions</CardDescription>
          </CardHeader>
          <CardContent className="pt-6 flex-1 flex flex-col">
            <div className="space-y-4 flex-1">
              {recentActivity.length > 0 ? recentActivity.map((item, i) => (
                <div key={i} className="flex items-start justify-between border-b border-slate-100 pb-4 last:border-0 last:pb-0">
                  <div>
                    <p className="font-bold text-slate-900 text-sm">{item.action}</p>
                    <p className="text-xs text-slate-500 mt-1">{item.desc}</p>
                  </div>
                  <span className="text-xs font-semibold text-slate-400 bg-slate-50 px-2 py-1 rounded-md">{item.time}</span>
                </div>
              )) : (
                <div className="text-sm text-slate-400 text-center py-8 bg-slate-50/50 rounded-xl">No recent activity found.</div>
              )}
            </div>
            <Button variant="ghost" className="w-full mt-6 text-[#005CBE] font-semibold hover:bg-[#EAF2FF] rounded-xl h-12">View All Activity</Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
