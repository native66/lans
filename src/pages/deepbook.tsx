import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Activity, ArrowDownRight, Wallet } from "lucide-react";
import { useQuery } from "@tanstack/react-query";

export default function DeepBookPage() {
  const { data: orderbook, isLoading } = useQuery({
    queryKey: ["deepbook", "orders", "mock-pool"],
    queryFn: async () => {
      const res = await fetch("/api/v1/deepbook/orders/mock-pool");
      return res.json();
    }
  });

  const asks = orderbook?.asks || [];
  const bids = orderbook?.bids || [];

  return (
    <div className="space-y-6 h-full flex flex-col">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">DeepBook Integration</h1>
          <p className="text-foreground/60">Live liquidity and order execution environment.</p>
        </div>
        <div className="flex gap-2">
          <div className="bg-card border border-border rounded-md px-3 py-1.5 flex items-center text-sm font-medium">
            <span className="w-2 h-2 rounded-full bg-success mr-2 animate-pulse" /> SUI/USDC
          </div>
          <Button variant="outline" className="border-border">Connect Wallet</Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 flex-1 min-h-[500px]">
        {/* Orderbook Panel */}
        <Card className="flex flex-col">
          <CardHeader className="py-4 border-b border-border">
            <CardTitle className="text-sm flex items-center justify-between">
              Orderbook 
              <span className="text-xs font-normal text-foreground/50">Spread: 0.004</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0 flex-1 flex flex-col font-mono text-xs">
            <div className="flex justify-between px-4 py-2 text-foreground/50 border-b border-border">
               <span>Price(USDC)</span>
               <span>Amount(SUI)</span>
            </div>
            <div className="flex-1 overflow-auto p-4 flex flex-col items-center justify-center">
               {isLoading ? (
                 <span className="text-foreground/50">Loading DeepBook...</span>
               ) : (
                 <div className="w-full">
                   {/* Asks */}
                   <div className="py-2">
                     {asks.map((ask: any, i: number) => (
                       <div key={i} className="flex justify-between py-1 hover:bg-card/50 cursor-pointer relative group">
                         <span className="text-danger z-10">{ask.price}</span>
                         <span className="z-10 text-right">{ask.quantity}</span>
                       </div>
                     ))}
                   </div>
                   
                   <div className="flex items-center justify-center gap-2 py-4 border-y border-border text-lg font-bold">
                     1.250 <ArrowDownRight className="w-4 h-4 text-danger" />
                   </div>

                   {/* Bids */}
                   <div className="py-2">
                     {bids.map((bid: any, i: number) => (
                       <div key={i} className="flex justify-between py-1 hover:bg-card/50 cursor-pointer relative group">
                         <span className="text-success z-10">{bid.price}</span>
                         <span className="z-10 text-right">{bid.quantity}</span>
                       </div>
                     ))}
                   </div>
                 </div>
               )}
            </div>
          </CardContent>
        </Card>

        {/* Chart / Central Panel */}
        <div className="lg:col-span-2 flex flex-col gap-6">
          <Card className="flex-1 flex items-center justify-center border-dashed bg-background/50 relative overflow-hidden">
             <div className="absolute inset-0 bg-center bg-[length:20px_20px] opacity-10" style={{ backgroundImage: 'radial-gradient(circle, #ffffff 1px, transparent 1px)' }} />
             <div className="text-center space-y-2 z-10 p-6">
               <Activity className="w-12 h-12 text-foreground/20 mx-auto" />
               <h3 className="text-lg font-medium text-foreground/60">Live Chart Interface</h3>
               <p className="text-sm text-foreground/40 max-w-sm">Connects directly to Sui RPC for live on-chain data visualization.</p>
             </div>
          </Card>
          
          <div className="grid grid-cols-2 gap-4 h-40">
            <Card>
              <CardContent className="flex flex-col justify-center h-full">
                <span className="text-sm text-foreground/50 mb-1 flex items-center gap-2"><Wallet className="w-4 h-4"/> SUI Balance</span>
                <span className="text-2xl font-mono">4,520.00</span>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="flex flex-col justify-center h-full">
                <span className="text-sm text-foreground/50 mb-1 flex items-center gap-2"><Wallet className="w-4 h-4"/> USDC Balance</span>
                <span className="text-2xl font-mono">1,240.50</span>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
