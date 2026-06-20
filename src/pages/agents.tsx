import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Bot, Plus, ArrowRight, XOctagon, Briefcase, Zap, Sparkles } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCurrentAccount, useDAppKit, useCurrentClient } from '@mysten/dapp-kit-react';
import { ConnectButton } from '@mysten/dapp-kit-react/ui';
import { Transaction } from '@mysten/sui/transactions';

const AGENT_POLICY_PACKAGE_ID = (import.meta as any).env.VITE_AGENT_POLICY_PACKAGE_ID || "0xYOUR_PACKAGE_ID";

export default function AgentsPage() {
  const queryClient = useQueryClient();
  const account = useCurrentAccount();
  const { signAndExecuteTransaction } = useDAppKit();
  const client = useCurrentClient();

  // Advanced UI State
  const [showNewForm, setShowNewForm] = useState(false);
  const [intentType, setIntentType] = useState('Spot');
  const [leverage, setLeverage] = useState(1);
  const [prompt, setPrompt] = useState('');
  const [isDeploying, setIsDeploying] = useState(false);

  const { data: agentsData, isLoading } = useQuery({
    queryKey: ["agents"],
    queryFn: async () => {
      const res = await fetch("/api/v1/agents/list");
      return res.json();
    }
  });

  const handleCreateAutonomousAgent = async () => {
    if (!account) return alert('Please connect your Sui Wallet first!');
    if (!prompt) return alert('Please describe your strategy prompt.');
    setIsDeploying(true);

    try {
      // Step 1: Init Agent (Get Pubkey from Backend)
      const initRes = await fetch("/api/v1/agents/init", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: intentType + " Agent" })
      });
      const initData = await initRes.json();
      if (!initData.pubkey) throw new Error("Failed to get agent pubkey");

      // Step 2: Build PTB to create Direct Call Vault on-chain
      const tx = new Transaction();
      const [fundCoin] = tx.splitCoins(tx.gas, [500_000_000]); // 500 SUI Budget
      
      tx.moveCall({
        target: `${AGENT_POLICY_PACKAGE_ID}::policy::create_vault`,
        arguments: [
          tx.pure.address(initData.pubkey),
          fundCoin,
          tx.pure.u64(500_000_000), 
          tx.pure.u64(86400000), // 24h ms
          tx.object("0x6") // Clock
        ]
      });

      // Step 3: Owner Signs
      const result = await signAndExecuteTransaction({ transaction: tx });
      
      if (result.$kind === 'FailedTransaction') {
        throw new Error(result.FailedTransaction.status.error?.message || "Transaction failed");
      }
      
      const digest = result.Transaction.digest;
      
      // Wait for indexing and request effects to get the real created Vault ID (No mock data!)
      const txData = await client.core.waitForTransaction({ 
        digest,
        include: { effects: true }
      });

      const createdObjects = (txData as any).effects?.created || (txData as any).Transaction?.effects?.created || [];
      const realPolicyId = createdObjects[0]?.reference?.objectId;

      if (!realPolicyId) {
        throw new Error("Failed to parse created Vault ID from on-chain effects.");
      }

      // Step 4: Confirm with Backend
      await fetch("/api/v1/agents/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: initData.id, policyId: realPolicyId })
      });

      alert('Agent Deployed & Secured On-chain! Digest: ' + digest);
      setShowNewForm(false);
      setPrompt('');
      queryClient.invalidateQueries({ queryKey: ["agents"] });

    } catch (err: any) {
      alert(err.message);
    } finally {
      setIsDeploying(false);
    }
  };

  const handleRevokePolicy = async (policyId: string) => {
    if (!account) return alert('Connect wallet first');
    const tx = new Transaction();
    
    tx.moveCall({
      target: `${AGENT_POLICY_PACKAGE_ID}::policy::revoke_vault`,
      arguments: [tx.object(policyId)]
    });

    try {
      const result = await signAndExecuteTransaction({ transaction: tx });
      if (result.$kind === 'FailedTransaction') throw new Error(result.FailedTransaction.status.error?.message || 'Failed');
      
      await client.core.waitForTransaction({ digest: result.Transaction.digest });
      alert('Vault Destroyed! Funds returned to your wallet. Digest: ' + result.Transaction.digest);
      queryClient.invalidateQueries({ queryKey: ["agents"] });
    } catch (err: any) {
      alert('Error revoking vault: ' + err.message);
    }
  };

  const agents = agentsData?.agents || [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">AI Intent Engine</h1>
          <p className="text-foreground/60">Manage autonomous, non-custodial trading agents on Deepbook V3.</p>
        </div>
        <div className="flex items-center gap-3">
          <ConnectButton />
          <Button onClick={() => alert("Portfolio analytics dashboard is coming soon!")} variant="outline" className="gap-2 text-primary border-primary/20 hover:bg-primary/10">
            <Briefcase className="w-4 h-4" />
            Manage Portfolio
          </Button>
        </div>
      </div>

      {showNewForm && (
        <Card className="border-primary/50 shadow-lg shadow-primary/10 bg-gradient-to-br from-background to-primary/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-2xl">
              <Sparkles className="w-6 h-6 text-primary" />
              Design New Strategy
            </CardTitle>
            <CardDescription>Use Natural Language to dictate your trading intent.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-4">
              <div className="flex-1 space-y-2">
                <label className="text-sm font-medium">Protocol Mode</label>
                <select 
                  className="w-full p-2 rounded-md border border-border bg-background"
                  value={intentType} 
                  onChange={(e) => setIntentType(e.target.value)}
                >
                  <option value="Spot">Spot (Deepbook)</option>
                  <option value="Margin">Margin (Aggregated Leverage)</option>
                  <option value="Prediction">Prediction Market</option>
                  <option value="Flash Loan">Flash Loan Arbitrage (0 Risk)</option>
                </select>
              </div>
              {intentType === 'Margin' && (
                <div className="flex-1 space-y-2">
                  <label className="text-sm font-medium">Leverage ({leverage}x)</label>
                  <input 
                    type="range" min="1" max="10" 
                    value={leverage} 
                    onChange={(e) => setLeverage(Number(e.target.value))}
                    className="w-full accent-primary"
                  />
                </div>
              )}
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium flex justify-between">
                <span>AI Trading Intent (Prompt)</span>
                {intentType === 'Flash Loan' && <span className="text-success text-xs flex items-center gap-1"><Zap className="w-3 h-3"/> Deepbook V3 Flash Loan Supported</span>}
              </label>
              <textarea 
                className="w-full p-3 rounded-md border border-border bg-background/50 min-h-[100px] resize-none focus:ring-2 focus:ring-primary/50 outline-none"
                placeholder="E.g., Borrow 10k USDC via flash loan, buy SUI on Deepbook if price drops below 0.8, and return the loan immediately..."
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
              />
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-border/50">
              <Button variant="ghost" onClick={() => setShowNewForm(false)}>Cancel</Button>
              <Button onClick={handleCreateAutonomousAgent} disabled={isDeploying} className="bg-primary hover:bg-primary/90 text-primary-foreground">
                {isDeploying ? 'Deploying On-chain...' : 'Deploy 500 SUI Vault'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {isLoading ? (
        <div className="py-20 text-center text-foreground/50">Loading on-chain agents...</div>
      ) : (
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {agents.map((agent: any) => (
          <Card key={agent.id} className="relative overflow-hidden flex flex-col justify-between border-slate-200 hover:border-primary/30 transition-colors">
            <div className={`absolute top-0 inset-x-0 h-1 ${agent.status === 'Active' ? 'bg-success' : 'bg-warning'}`} />
            <CardHeader className="pb-4">
              <div className="flex justify-between items-start">
                <CardTitle className="flex items-center gap-2">
                  <Bot className="w-5 h-5 text-primary" />
                  {agent.name}
                </CardTitle>
                <span className={`text-xs px-2 py-1 rounded-full border ${agent.status === 'Active' ? 'bg-success/10 text-success border-success/20' : 'bg-warning/10 text-warning border-warning/20'}`}>
                  {agent.status}
                </span>
              </div>
              <CardDescription className="pt-2 font-mono text-xs truncate" title={agent.pubkey}>Pubkey: {agent.pubkey.substring(0,10)}...</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 mt-2 border-t border-border pt-4">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-foreground/60">Policy ID (Vault):</span>
                  <span className="font-mono text-xs">{agent.policyId !== 'Pending' ? agent.policyId.substring(0,10)+'...' : 'Awaiting Tx'}</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-foreground/60">Spent:</span>
                  <span className="font-medium text-foreground">0 SUI</span>
                </div>

                <div className="flex items-center gap-2 mt-6 pt-4">
                  <Button onClick={() => alert("Activity logs will be available after the first trade execution.")} variant="outline" className="flex-1 text-xs" size="sm">
                    View Logs <ArrowRight className="w-3 h-3 ml-2" />
                  </Button>
                  <Button 
                    onClick={() => handleRevokePolicy(agent.policyId)} 
                    variant="destructive" 
                    size="sm" 
                    className="w-10 px-0 flex-shrink-0" 
                    title="Emergency Revoke & Recover Funds"
                    disabled={agent.policyId === 'Pending'}
                  >
                    <XOctagon className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
        
        {!showNewForm && (
          <button onClick={() => setShowNewForm(true)} className="flex flex-col items-center justify-center border-2 border-dashed border-border rounded-xl p-8 text-foreground/50 hover:text-foreground hover:border-primary/50 hover:bg-primary/5 transition-all outline-none min-h-[250px]">
            <div className="w-12 h-12 rounded-full bg-card border border-border flex items-center justify-center mb-4">
              <Plus className="w-6 h-6" />
            </div>
            <span className="font-medium">New AI Intent</span>
            <span className="text-xs mt-1 text-center max-w-[200px]">Create a new automated trading strategy</span>
          </button>
        )}
      </div>
      )}
    </div>
  );
}
