import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowUpRight, Bot, Activity, DollarSign, Wallet } from "lucide-react";
import { motion } from "motion/react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { useQuery } from "@tanstack/react-query";

const performanceData = [
  { time: '00:00', value: 4000 },
  { time: '04:00', value: 4200 },
  { time: '08:00', value: 4100 },
  { time: '12:00', value: 4600 },
  { time: '16:00', value: 4800 },
  { time: '20:00', value: 5000 },
  { time: '24:00', value: 5400 },
];

export default function DashboardPage() {
  const { data: profileData } = useQuery({
    queryKey: ["profile"],
    queryFn: async () => {
      const res = await fetch("/api/v1/wallet/profile");
      return res.json();
    }
  });

  const { data: agentsData } = useQuery({
    queryKey: ["agents"],
    queryFn: async () => {
      const res = await fetch("/api/v1/agents/list");
      return res.json();
    }
  });

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
              <div className="text-2xl font-bold">$12,450.00</div>
              <p className="text-xs text-primary mt-1 flex items-center">
                <ArrowUpRight className="w-3 h-3 mr-1" /> +4.2% from yesterday
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
              <div className="text-2xl font-bold">{agentsData?.agents?.length || 3}</div>
              <p className="text-xs text-foreground/50 mt-1">
                2 policies expiring soon
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
              <div className="text-2xl font-bold">{profileData?.balance || "0 SUI"}</div>
              <p className="text-xs text-foreground/50 mt-1 flex items-center truncate">
                Address: {profileData?.address || "..."}
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
              <div className="text-2xl font-bold">$4,250.00</div>
              <p className="text-xs text-primary mt-1 flex items-center">
                <ArrowUpRight className="w-3 h-3 mr-1" /> 124 executed trades
              </p>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Agent Performance Summary</CardTitle>
            <CardDescription>Aggregate PnL across all active trading policies.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={performanceData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" vertical={false} />
                  <XAxis dataKey="time" stroke="rgba(255,255,255,0.5)" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke="rgba(255,255,255,0.5)" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `$${value}`} />
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
              {[
                { action: "Trade Executed", desc: "Bought 50 SUI @ 1.25 USDC", time: "2m ago" },
                { action: "Order Placed", desc: "Limit Sell 100 SUI @ 1.40 USDC", time: "15m ago" },
                { action: "Policy Budget Reached", desc: "Market Maker Agent #01 stopped", time: "1h ago" },
              ].map((item, i) => (
                <div key={i} className="flex items-start justify-between border-b border-border pb-4 last:border-0 last:pb-0">
                  <div>
                    <p className="font-medium text-sm">{item.action}</p>
                    <p className="text-xs text-foreground/60">{item.desc}</p>
                  </div>
                  <span className="text-xs text-foreground/40">{item.time}</span>
                </div>
              ))}
            </div>
            <Button variant="ghost" className="w-full mt-4 text-xs h-8">View All Activity</Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
