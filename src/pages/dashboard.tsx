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
          <h1 className="text-3xl font-bold tracking-tight">Overview</h1>
          <p className="text-foreground/60">Monitor your autonomous agent performance and asset allocation.</p>
        </div>
        <Button className="bg-primary hover:bg-primary/90 text-primary-foreground gap-2">
          <Bot className="w-4 h-4" />
          Deploy New Agent
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-foreground/70">Total Value Locked</CardTitle>
              <DollarSign className="w-4 h-4 text-foreground/50" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{tvlSui} SUI</div>
              <p className="text-xs text-primary mt-1 flex items-center">
                <ArrowUpRight className="w-3 h-3 mr-1" /> On-chain TVL
              </p>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-foreground/70">Active Agents</CardTitle>
              <Bot className="w-4 h-4 text-foreground/50" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{activeAgentsCount}</div>
              <p className="text-xs text-foreground/50 mt-1">
                Vaults deployed
              </p>
            </CardContent>
          </Card>
        </motion.div>
        
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-foreground/70">Wallet Balance</CardTitle>
              <Wallet className="w-4 h-4 text-foreground/50" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formattedBalance} SUI</div>
              <p className="text-xs text-foreground/50 mt-1 flex items-center truncate" title={account?.address || ""}>
                Address: {account?.address ? `${account.address.substring(0,6)}...${account.address.substring(account.address.length-4)}` : "Not connected"}
              </p>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-foreground/70">24h Trade Volume</CardTitle>
              <Activity className="w-4 h-4 text-foreground/50" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{volume24hSui} SUI</div>
              <p className="text-xs text-primary mt-1 flex items-center">
                <ArrowUpRight className="w-3 h-3 mr-1" /> Total volume in 24h
              </p>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Trading Volume (24h)</CardTitle>
            <CardDescription>Aggregate execution volume from on-chain TradeLog events.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={performanceData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" vertical={false} />
                  <XAxis dataKey="time" stroke="rgba(255,255,255,0.5)" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke="rgba(255,255,255,0.5)" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `${value.toFixed(1)}`} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#0A192F', borderColor: 'rgba(255,255,255,0.1)', borderRadius: '8px' }}
                    itemStyle={{ color: '#4DA2FF' }}
                  />
                  <Line type="monotone" dataKey="value" stroke="#4DA2FF" strokeWidth={3} dot={false} activeDot={{ r: 6 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
            <CardDescription>On-chain actions</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {recentActivity.length > 0 ? recentActivity.map((item, i) => (
                <div key={i} className="flex items-start justify-between border-b border-border pb-4 last:border-0 last:pb-0">
                  <div>
                    <p className="font-medium text-sm">{item.action}</p>
                    <p className="text-xs text-foreground/60">{item.desc}</p>
                  </div>
                  <span className="text-xs text-foreground/40">{item.time}</span>
                </div>
              )) : (
                <div className="text-sm text-foreground/50 text-center py-4">No recent activity found.</div>
              )}
            </div>
            <Button variant="ghost" className="w-full mt-4 text-xs h-8">View All Activity</Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
