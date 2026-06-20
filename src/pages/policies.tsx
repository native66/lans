import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Shield, Plus, Lock } from "lucide-react";

export default function PoliciesPage() {
  const policies = [
    { id: 1, name: "Standard DeepBook Setup", protocols: ["DeepBook"], assets: ["SUI", "USDC"], maxSlippage: "1.0%", maxTrades: 50 },
    { id: 2, name: "Restricted DCA", protocols: ["DeepBook"], assets: ["SUI", "USDC"], maxSlippage: "0.5%", maxTrades: 10 },
  ];

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
        {policies.map((policy) => (
          <Card key={policy.id}>
            <CardHeader>
              <div className="flex justify-between items-start">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                    <Shield className="w-5 h-5" />
                  </div>
                  <div>
                    <CardTitle className="text-lg">{policy.name}</CardTitle>
                    <CardDescription>Strict sandbox implementation</CardDescription>
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
                    <span className="text-foreground/50 block text-xs">Max Slippage</span>
                    <span className="font-mono">{policy.maxSlippage}</span>
                  </div>
                  <div>
                    <span className="text-foreground/50 block text-xs">Max Trades/Day</span>
                    <span className="font-mono">{policy.maxTrades}</span>
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
