import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Bot, Plus, ArrowRight, XOctagon, X, Briefcase, Zap, Sparkles, ScrollText, ExternalLink, Play, Loader2, Search } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCurrentAccount, useDAppKit, useCurrentClient } from '@mysten/dapp-kit-react';
import { ConnectButton } from '@mysten/dapp-kit-react/ui';
import { Transaction } from '@mysten/sui/transactions';

const AGENT_POLICY_PACKAGE_ID = (import.meta as any).env.VITE_AGENT_POLICY_PACKAGE_ID;
if (!AGENT_POLICY_PACKAGE_ID) throw new Error("VITE_AGENT_POLICY_PACKAGE_ID is missing in .env");

export default function AgentsPage() {
  const queryClient = useQueryClient();
  const account = useCurrentAccount();
  const { signAndExecuteTransaction } = useDAppKit();
  const client = useCurrentClient();

  // Toast UI override
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const showToast = (msg: string) => setToastMessage(msg);

  // Advanced UI State
  const [showNewForm, setShowNewForm] = useState(false);
  const [intentType, setIntentType] = useState('Spot');
  const [leverage, setLeverage] = useState(1);
  const [prompt, setPrompt] = useState('');
  const [budgetSui, setBudgetSui] = useState('0.2');
  const [isDeploying, setIsDeploying] = useState(false);
  const [agentLogs, setAgentLogs] = useState<{ agentId: string; logs: any[] } | null>(null);
  const [isLoadingLogs, setIsLoadingLogs] = useState(false);
  
  const [durationValue, setDurationValue] = useState<number>(24);
  const [durationUnit, setDurationUnit] = useState<string>('Hours');
  const [reactivatingAgentId, setReactivatingAgentId] = useState<string | null>(null);
  const [executePrompts, setExecutePrompts] = useState<Record<string, string>>({});
  const [executeResults, setExecuteResults] = useState<Record<string, any>>({});
  const [executingAgents, setExecutingAgents] = useState<Record<string, boolean>>({});

  const { data: agentsData, isLoading } = useQuery({
    queryKey: ["agents"],
    queryFn: async () => {
      const res = await fetch("/api/v1/agents/list");
      return res.json();
    }
  });

  // Automatically scan on-chain when wallet connects
  useEffect(() => {
    if (account?.address) {
      fetch("/api/v1/agents/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ walletAddress: account.address })
      }).then(res => res.json()).then(data => {
        if (data.recoveredCount > 0) {
          queryClient.invalidateQueries({ queryKey: ["agents"] });
        }
      }).catch(console.error);
    }
  }, [account?.address, queryClient]);

  const agents = agentsData?.agents || [];

  const handleManualScan = async () => {
    if (!account?.address) return showToast('Please connect your Sui Wallet first!');
    showToast('Scanning for missing agents on Testnet...');
    try {
      const res = await fetch("/api/v1/agents/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ walletAddress: account.address })
      });
      const data = await res.json();
      if (data.recoveredCount > 0) {
        showToast(`Scan complete! Found ${data.recoveredCount} missing agent(s).`);
        queryClient.invalidateQueries({ queryKey: ["agents"] });
      } else {
        showToast('Scan complete. No missing agents found.');
      }
    } catch (err: any) {
      showToast('Scan failed: ' + err.message);
    }
  };

  const handleCreateAutonomousAgent = async () => {
    if (!account) return showToast('Please connect your Sui Wallet first!');
    if (!prompt) return showToast('Please describe your strategy prompt.');

    const budgetNum = parseFloat(budgetSui);
    if (isNaN(budgetNum) || budgetNum < 0.2) return showToast('Vault budget must be at least 0.2 SUI.');

    setIsDeploying(true);

    try {
      // Step 1: Init Agent (Get Pubkey from Backend)
      const initRes = await fetch("/api/v1/agents/init", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: intentType + " Agent", prompt, budget: budgetSui })
      });
      const initData = await initRes.json();
      if (!initRes.ok) throw new Error(initData.error || "Failed to init agent");
      if (!initData.pubkey) throw new Error("Failed to get agent pubkey");

      // Step 2: Build PTB to create Direct Call Vault on-chain
      // Budget is user-specified (min 0.2 SUI, no max). 1 SUI = 1_000_000_000 MIST.
      const VAULT_BUDGET_MIST = Math.floor(budgetNum * 1_000_000_000);
      const AGENT_GAS_MIST = 50_000_000; // 0.05 SUI for agent's background gas fees
      
      const tx = new Transaction();

      // We split both the Vault Budget and the Agent's Gas from the user's gas coin
      const [fundCoin, agentGasCoin] = tx.splitCoins(tx.gas, [VAULT_BUDGET_MIST, AGENT_GAS_MIST]);

      // Calculate duration ms
      let durationMs = durationValue;
      if (durationUnit === 'Seconds') durationMs *= 1000;
      else if (durationUnit === 'Minutes') durationMs *= 60000;
      else if (durationUnit === 'Hours') durationMs *= 3600000;
      else if (durationUnit === 'Days') durationMs *= 86400000;

      // Create the Vault (shared object) and fund it with the Budget
      tx.moveCall({
        target: `${AGENT_POLICY_PACKAGE_ID}::policy::create_vault`,
        arguments: [
          tx.pure.address(initData.pubkey),
          fundCoin,
          tx.pure.u64(VAULT_BUDGET_MIST),
          tx.pure.u64(durationMs),
          tx.object.clock()
        ]
      });
      
      // Transfer the 0.05 SUI gas coin to the Agent's ephemeral wallet so it can sign its own transactions!
      tx.transferObjects([agentGasCoin], tx.pure.address(initData.pubkey));

      // Step 3: Owner Signs
      const result = await signAndExecuteTransaction({ transaction: tx });

      if (result.$kind === 'FailedTransaction') {
        throw new Error(result.FailedTransaction.status.error?.message || "Transaction failed");
      }

      const digest = result.Transaction.digest;

      // Wait for indexing and get the real created Vault ID using Sui SDK v2 API
      // SDK v2 uses `client.core.waitForTransaction` with `include` (not `options`)
      // TransactionInclude supports: effects, objectTypes, events, balanceChanges, transaction, bcs
      const txData = await client.core.waitForTransaction({
        digest,
        include: { effects: true, objectTypes: true }
      });

      // SDK v2: TransactionResult is { $kind: 'Transaction', Transaction: {...} } or { $kind: 'FailedTransaction', ... }
      if (txData.$kind === 'FailedTransaction') {
        const errMsg = txData.FailedTransaction.status.error?.message || 'Unknown on-chain error';
        throw new Error(`On-chain Error: ${errMsg}`);
      }

      const txn = txData.Transaction;

      // Check execution status
      if (!txn.status.success) {
        throw new Error(`On-chain Error: ${txn.status.error?.message || 'Transaction failed'}`);
      }

      // SDK v2: effects.changedObjects[] has { objectId, idOperation: 'Created' | 'Deleted' | 'None' }
      // SDK v2: objectTypes is Record<string, string> mapping objectId -> full type string
      const effects = txn.effects;
      const objectTypes = txn.objectTypes || {};

      let realPolicyId: string | undefined;

      if (effects?.changedObjects) {
        for (const obj of effects.changedObjects) {
          if (obj.idOperation === 'Created') {
            const objType = objectTypes[obj.objectId] || '';
            if (objType.includes('::policy::AgentVault')) {
              realPolicyId = obj.objectId;
              break;
            }
          }
        }
      }

      if (!realPolicyId) {
        console.error('TX Data:', JSON.stringify(txData, null, 2));
        throw new Error('Failed to find created AgentVault in transaction effects. Check browser console for full TX data.');
      }

      // Step 4: Confirm with Backend
      await fetch("/api/v1/agents/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: initData.id, policyId: realPolicyId })
      });

      // Backend will automatically execute intent upon confirmation!

      showToast('Agent Deployed & Secured On-chain! Vault Budget: ' + budgetSui + ' SUI. Digest: ' + digest);
      setShowNewForm(false);
      setPrompt('');
      setBudgetSui('0.2');
      queryClient.invalidateQueries({ queryKey: ["agents"] });

    } catch (err: any) {
      showToast(err.message);
    } finally {
      setIsDeploying(false);
    }
  };

  const handleReactivateAgent = async (agent: any) => {
    if (!account) return showToast('Please connect your Sui Wallet first!');
    
    const budgetNum = parseFloat(budgetSui);
    if (isNaN(budgetNum) || budgetNum < 0.2) return showToast('Vault budget must be at least 0.2 SUI.');

    setIsDeploying(true);
    
    try {
      const VAULT_BUDGET_MIST = Math.floor(budgetNum * 1_000_000_000);
      const tx = new Transaction();
      const [fundCoin] = tx.splitCoins(tx.gas, [VAULT_BUDGET_MIST]);

      let durationMs = durationValue;
      if (durationUnit === 'Seconds') durationMs *= 1000;
      else if (durationUnit === 'Minutes') durationMs *= 60000;
      else if (durationUnit === 'Hours') durationMs *= 3600000;
      else if (durationUnit === 'Days') durationMs *= 86400000;

      tx.moveCall({
        target: `${AGENT_POLICY_PACKAGE_ID}::policy::create_vault`,
        arguments: [
          tx.pure.address(agent.pubkey),
          fundCoin,
          tx.pure.u64(VAULT_BUDGET_MIST),
          tx.pure.u64(durationMs),
          tx.object.clock()
        ]
      });

      const result = await signAndExecuteTransaction({ transaction: tx });
      if (result.$kind === 'FailedTransaction') throw new Error(result.FailedTransaction.status.error?.message || "Transaction failed");

      const txData = await client.core.waitForTransaction({ digest: result.Transaction.digest, include: { effects: true, objectTypes: true } });
      if (txData.$kind === 'FailedTransaction') throw new Error('On-chain Error');
      
      const txn = txData.Transaction;
      if (!txn.status.success) throw new Error('Transaction failed');

      const effects = txn.effects;
      const objectTypes = txn.objectTypes || {};
      let realPolicyId;

      if (effects?.changedObjects) {
        for (const obj of effects.changedObjects) {
          if (obj.idOperation === 'Created') {
            const objType = objectTypes[obj.objectId] || '';
            if (objType.includes('::policy::AgentVault')) {
              realPolicyId = obj.objectId;
              break;
            }
          }
        }
      }

      if (!realPolicyId) throw new Error('Failed to find created AgentVault in transaction effects.');

      // Confirm with existing agent ID
      await fetch("/api/v1/agents/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: agent.id, policyId: realPolicyId })
      });

      showToast('Agent Re-activated! Vault Budget: ' + budgetSui + ' SUI. Digest: ' + result.Transaction.digest);
      setReactivatingAgentId(null);
      queryClient.invalidateQueries({ queryKey: ["agents"] });

    } catch (err: any) {
      showToast(err.message);
    } finally {
      setIsDeploying(false);
    }
  };

  const handleRevokePolicy = async (policyId: string) => {
    if (!account) return showToast('Connect wallet first');
    const tx = new Transaction();

    tx.moveCall({
      target: `${AGENT_POLICY_PACKAGE_ID}::policy::revoke_vault`,
      arguments: [tx.object(policyId)]
    });

    try {
      const result = await signAndExecuteTransaction({ transaction: tx });
      if (result.$kind === 'FailedTransaction') throw new Error(result.FailedTransaction.status.error?.message || 'Failed');

      await client.core.waitForTransaction({ digest: result.Transaction.digest });
      showToast('Vault Destroyed! Funds returned to your wallet. Digest: ' + result.Transaction.digest);
      queryClient.invalidateQueries({ queryKey: ["agents"] });
    } catch (err: any) {
      showToast('Error revoking vault: ' + err.message);
    }
  };

  const handleRevokeAll = async () => {
    if (!account) return showToast('Connect wallet first');
    
    // Find all Recovered Vaults
    const recoveredVaults = agents.filter((a: any) => a.name === "Recovered Vault");
    if (recoveredVaults.length === 0) return showToast('No missing vaults to revoke.');

    const tx = new Transaction();
    
    recoveredVaults.forEach((vault: any) => {
      tx.moveCall({
        target: `${AGENT_POLICY_PACKAGE_ID}::policy::revoke_vault`,
        arguments: [tx.object(vault.policyId)]
      });
    });

    try {
      const result = await signAndExecuteTransaction({ transaction: tx });
      if (result.$kind === 'FailedTransaction') throw new Error(result.FailedTransaction.status.error?.message || 'Failed');

      await client.core.waitForTransaction({ digest: result.Transaction.digest });
      showToast(`All Missing Vaults Destroyed! Funds returned to your wallet. Digest: ${result.Transaction.digest}`);
      queryClient.invalidateQueries({ queryKey: ["agents"] });
    } catch (err: any) {
      showToast('Error revoking vaults: ' + err.message);
    }
  };

  const handleViewLogs = async (agentId: string, agentName: string) => {
    setIsLoadingLogs(true);
    setAgentLogs(null);
    try {
      const res = await fetch(`/api/v1/agents/${agentId}/logs`);
      const data = await res.json();
      if (!res.ok) {
        console.error(`[LANS] Logs Error for ${agentName}:`, data.error);
        setAgentLogs({ agentId, logs: [] });
        return;
      }
      console.log(`[LANS] On-chain logs for ${agentName}:`, data);
      setAgentLogs({ agentId, logs: data.logs || [] });
    } catch (err: any) {
      console.error(`[LANS] Failed to fetch logs:`, err.message);
      setAgentLogs({ agentId, logs: [] });
    } finally {
      setIsLoadingLogs(false);
    }
  };

  const handleExecuteIntent = async (agentId: string, agentName: string) => {
    const agentPrompt = executePrompts[agentId];
    if (!agentPrompt) return showToast('Please enter a trading intent prompt.');

    setExecutingAgents(prev => ({ ...prev, [agentId]: true }));
    console.log(`[LANS] Executing intent for ${agentName}: "${agentPrompt}"`);

    try {
      const res = await fetch("/api/v1/agents/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agentId, prompt: agentPrompt })
      });
      const data = await res.json();
      if (!res.ok) {
        console.error(`[LANS] Execute Error for ${agentName}:`, data.error);
        setExecuteResults(prev => ({ ...prev, [agentId]: { error: data.error } }));
        return;
      }
      console.log(`[LANS] AI Intent Result for ${agentName}:`, data);
      setExecuteResults(prev => ({ ...prev, [agentId]: data }));
      setExecutePrompts(prev => ({ ...prev, [agentId]: '' }));
    } catch (err: any) {
      console.error(`[LANS] Execute failed:`, err.message);
      setExecuteResults(prev => ({ ...prev, [agentId]: { error: err.message } }));
    } finally {
      setExecutingAgents(prev => ({ ...prev, [agentId]: false }));
    }
  };



  return (
    <div className="space-y-6 relative">
      {toastMessage && (
        <div className="fixed top-24 right-4 z-[100] bg-white/95 backdrop-blur-xl shadow-xl border border-slate-200/60 rounded-2xl p-4 min-w-[300px] flex items-start gap-3 animate-in slide-in-from-top-4 fade-in duration-300">
          <div className="flex-1 text-sm font-semibold text-slate-700 mt-0.5">{toastMessage}</div>
          <button onClick={() => setToastMessage(null)} className="text-slate-400 hover:text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-full p-1.5 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Intent Engine</h1>
          <p className="text-slate-500 font-medium mt-1">Manage autonomous, non-custodial trading agents on Deepbook V3.</p>
        </div>
        <div className="flex items-center gap-3">
          <ConnectButton />
          <Button onClick={handleRevokeAll} className="gap-2 bg-red-50 text-red-600 hover:bg-red-100 border border-red-200 font-semibold rounded-full px-6 shadow-sm transition-all">
            <XOctagon className="w-4 h-4" />
            Revoke ALL
          </Button>
          <Button onClick={handleManualScan} className="gap-2 text-[#005CBE] bg-white border border-slate-200 hover:bg-slate-50 font-semibold rounded-full px-6 shadow-sm transition-all">
            <Search className="w-4 h-4" />
            Scan Agents
          </Button>
        </div>
      </div>

      {showNewForm && (
        <Card className="border-white/60 shadow-sm bg-white/80 backdrop-blur-xl rounded-3xl overflow-hidden">
          <CardHeader className="bg-white/40 border-b border-slate-100 pb-6">
            <CardTitle className="flex items-center gap-2 text-2xl font-bold text-slate-900">
              <Sparkles className="w-6 h-6 text-[#005CBE]" />
              Design New Strategy
            </CardTitle>
            <CardDescription className="text-slate-500 font-medium">Use Natural Language to dictate your trading intent.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6 pt-6">
            <div className="flex gap-4">
              <div className="flex-1 space-y-2">
                <label className="text-sm font-bold text-slate-700">Protocol Mode</label>
                <select
                  className="w-full p-3 rounded-xl border border-slate-200 bg-white focus:ring-2 focus:ring-[#005CBE]/50 outline-none text-slate-700 font-medium shadow-sm"
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

            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1 space-y-2">
                <label className="text-sm font-bold text-slate-700">Vault Budget (SUI)</label>
                <input
                  type="number"
                  step="0.1"
                  min="0.2"
                  className="w-full p-3 rounded-xl border border-slate-200 bg-white focus:ring-2 focus:ring-[#005CBE]/50 outline-none text-slate-700 font-medium shadow-sm"
                  placeholder="Min 0.2 SUI"
                  value={budgetSui}
                  onChange={(e) => setBudgetSui(e.target.value)}
                />
                <p className="text-xs text-slate-400">Self-enforced budget ceiling. Agent cannot exceed this amount.</p>
              </div>

              <div className="flex-1 space-y-2">
                <label className="text-sm font-bold text-slate-700">Time for using the Agent</label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    min="1"
                    className="w-2/3 p-3 rounded-xl border border-slate-200 bg-white focus:ring-2 focus:ring-[#005CBE]/50 outline-none text-slate-700 font-medium shadow-sm"
                    value={durationValue}
                    onChange={(e) => setDurationValue(Number(e.target.value))}
                  />
                  <select
                    className="w-1/3 p-3 rounded-xl border border-slate-200 bg-white focus:ring-2 focus:ring-[#005CBE]/50 outline-none text-slate-700 font-medium shadow-sm"
                    value={durationUnit}
                    onChange={(e) => setDurationUnit(e.target.value)}
                  >
                    <option value="Hours">Hours</option>
                    <option value="Days">Days</option>
                    <option value="Minutes">Minutes</option>
                  </select>
                </div>
                <p className="text-xs text-slate-400">Agent automatically expires after this period.</p>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-700 flex justify-between">
                <span>AI Trading Intent (Prompt)</span>
                {intentType === 'Flash Loan' && <span className="text-green-600 text-xs flex items-center gap-1 bg-green-50 px-2 py-0.5 rounded-md"><Zap className="w-3 h-3" /> Deepbook V3 Flash Loan Supported</span>}
              </label>
              <textarea
                className="w-full p-4 rounded-xl border border-slate-200 bg-white min-h-[120px] resize-none focus:ring-2 focus:ring-[#005CBE]/50 outline-none text-slate-700 shadow-sm"
                placeholder="E.g., Borrow 10k USDC via flash loan, buy SUI on Deepbook if price drops below 0.8, and return the loan immediately..."
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
              />
            </div>

            <div className="flex justify-end gap-3 pt-6 mt-4 border-t border-slate-100">
              <Button variant="ghost" onClick={() => setShowNewForm(false)} className="rounded-full px-6 text-slate-500 hover:bg-slate-100">Cancel</Button>
              <Button onClick={handleCreateAutonomousAgent} disabled={isDeploying} className="bg-[#005CBE] hover:bg-[#004e9f] text-white rounded-full px-8 shadow-md">
                {isDeploying ? 'Deploying On-chain...' : 'Deploy'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {isLoading ? (
        <div className="py-20 text-center text-slate-500 font-medium bg-white/40 backdrop-blur-xl border border-white/60 rounded-3xl shadow-sm mt-6">Loading on-chain agents...</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {!showNewForm && (
            <button onClick={() => setShowNewForm(true)} className="flex flex-col items-center justify-center border-2 border-dashed border-slate-200 rounded-3xl p-8 text-slate-400 hover:text-[#005CBE] hover:border-[#005CBE]/30 hover:bg-[#EAF2FF]/50 transition-all outline-none min-h-[250px] bg-white/40 backdrop-blur-xl shadow-sm">
              <div className="w-14 h-14 rounded-full bg-white shadow-sm flex items-center justify-center mb-4">
                <Plus className="w-6 h-6" />
              </div>
              <span className="font-bold text-slate-700 text-lg">New AI Intent</span>
              <span className="text-sm font-medium mt-1 text-center max-w-[200px]">Create a new automated trading strategy</span>
            </button>
          )}

          {agents.map((agent: any) => (
            <Card key={agent.id} className="relative overflow-hidden flex flex-col justify-between bg-white/80 backdrop-blur-xl border-white/60 shadow-sm rounded-3xl hover:shadow-md transition-shadow">
              <div className={`absolute top-0 inset-x-0 h-1.5 ${agent.status === 'Active' ? 'bg-green-500' : 'bg-amber-400'}`} />
              <CardHeader className="pb-4 pt-6">
                <div className="flex justify-between items-start">
                  <CardTitle className="flex items-center gap-2 text-xl font-bold text-slate-900">
                    <div className="w-10 h-10 rounded-full bg-[#EAF2FF] flex items-center justify-center text-[#005CBE]">
                      <Bot className="w-5 h-5" />
                    </div>
                    {agent.name}
                  </CardTitle>
                  <span className={`text-xs px-2 py-1 rounded-md font-bold uppercase tracking-wider ${agent.status === 'Active' ? 'bg-green-50 text-green-700' : agent.status === 'Shutdown' ? 'bg-slate-100 text-slate-500' : 'bg-amber-50 text-amber-700'}`}>
                    {agent.status}
                  </span>
                </div>
                <CardDescription className="pt-4 font-mono text-xs font-semibold text-slate-400 truncate bg-slate-50 w-fit px-2 py-1 rounded-md" title={agent.pubkey}>Pubkey: {agent.pubkey.substring(0, 10)}...</CardDescription>
              </CardHeader>
              <CardContent className="pb-6">
                <div className="space-y-4 mt-2 border-t border-slate-100 pt-5">
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-slate-500 font-semibold text-xs uppercase tracking-wider">Policy ID (Vault):</span>
                    <span className="font-mono text-xs font-bold text-slate-900 bg-slate-50 px-2 py-1 rounded-md">{agent.policyId !== 'Pending' ? agent.policyId.substring(0, 10) + '...' : 'Awaiting Tx'}</span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-slate-500 font-semibold text-xs uppercase tracking-wider">Spent:</span>
                    <span className="font-bold text-slate-900">0 SUI</span>
                  </div>

                  <div className="flex items-center gap-2 mt-6 pt-2">
                    <Button onClick={() => handleViewLogs(agent.id, agent.name)} className="flex-1 text-sm font-semibold bg-[#EAF2FF] text-[#005CBE] hover:bg-blue-100 rounded-xl h-10" size="sm">
                      <ScrollText className="w-4 h-4 mr-2" /> View Logs <ArrowRight className="w-4 h-4 ml-2" />
                    </Button>
                    {agent.status !== 'Shutdown' ? (
                      <Button
                        onClick={() => handleRevokePolicy(agent.policyId)}
                        variant="destructive"
                        size="sm"
                        className="px-4 flex-shrink-0 rounded-xl bg-red-50 text-red-500 hover:bg-red-100 border-none shadow-none font-semibold gap-2 h-10"
                        title="Emergency Revoke & Recover Funds"
                        disabled={agent.policyId === 'Pending'}
                      >
                        <XOctagon className="w-4 h-4" />
                        Revoke
                      </Button>
                    ) : (
                      <Button
                        onClick={() => setReactivatingAgentId(reactivatingAgentId === agent.id ? null : agent.id)}
                        className="bg-amber-100 text-amber-700 hover:bg-amber-200 shadow-none font-bold text-xs px-3 h-10 rounded-xl"
                      >
                        Re-active
                      </Button>
                    )}
                  </div>

                  {/* Reactivation Panel */}
                  {reactivatingAgentId === agent.id && (
                    <div className="mt-4 pt-4 border-t border-slate-100 space-y-3 bg-amber-50/50 p-3 rounded-xl border border-amber-100">
                      <label className="text-xs font-bold text-amber-700 uppercase tracking-wider block">Re-activate Agent</label>
                      <div className="flex flex-col gap-2">
                        <input type="number" step="0.1" className="w-full p-2 rounded-lg border border-amber-200 text-sm" placeholder="New Budget (SUI)" value={budgetSui} onChange={e => setBudgetSui(e.target.value)} />
                        <div className="flex gap-2">
                          <input type="number" className="w-1/2 p-2 rounded-lg border border-amber-200 text-sm" value={durationValue} onChange={e => setDurationValue(Number(e.target.value))} />
                          <select className="w-1/2 p-2 rounded-lg border border-amber-200 text-sm" value={durationUnit} onChange={e => setDurationUnit(e.target.value)}>
                            <option>Seconds</option><option>Minutes</option><option>Hours</option><option>Days</option>
                          </select>
                        </div>
                        <Button onClick={() => handleReactivateAgent(agent)} disabled={isDeploying} className="w-full bg-amber-500 hover:bg-amber-600 text-white font-bold h-9">
                          {isDeploying ? 'Deploying...' : 'Deploy New Vault'}
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* Active Strategy Section */}
                  {agent.prompt && (
                    <div className="mt-4 pt-4 border-t border-slate-100 space-y-3">
                      <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Active Strategy</label>
                      <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl">
                        <p className="text-sm font-semibold text-slate-800 italic">"{agent.prompt}"</p>
                      </div>

                      {/* AI Parsed Intent Static Display */}
                      {agent.parsedIntent && (
                        <div className="text-xs p-3 rounded-xl bg-green-50 text-green-800">
                          <div className="space-y-1">
                            <p className="font-bold text-green-700">✓ Parsed Parameters:</p>
                            <p><strong>Action:</strong> {agent.parsedIntent.action}</p>
                            {agent.parsedIntent.pool && <p><strong>Pool/Market:</strong> {agent.parsedIntent.pool}</p>}
                            <p><strong>Amount to trade:</strong> {agent.parsedIntent.amount}</p>
                            {agent.parsedIntent.leverage && <p><strong>Leverage:</strong> {agent.parsedIntent.leverage}x</p>}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* On-chain Activity Logs Panel */}
      {agentLogs && (
        <Card className="border-white/60 shadow-sm bg-white/80 backdrop-blur-xl rounded-3xl overflow-hidden">
          <CardHeader className="bg-white/40 border-b border-slate-100 pb-4">
            <div className="flex justify-between items-center">
              <CardTitle className="flex items-center gap-2 text-xl font-bold text-slate-900">
                <ScrollText className="w-5 h-5 text-[#005CBE]" />
                On-Chain Activity Logs
              </CardTitle>
              <Button variant="ghost" size="sm" onClick={() => setAgentLogs(null)} className="text-slate-400 hover:text-slate-700 rounded-full">
                ✕
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {isLoadingLogs ? (
              <div className="p-8 text-center text-slate-400 font-medium">Querying Sui Testnet...</div>
            ) : agentLogs.logs.length === 0 ? (
              <div className="p-8 text-center text-slate-400 font-medium">No on-chain trade events found for this vault. Activity logs appear here after the agent executes a trade via DeepBook.</div>
            ) : (
              <div className="divide-y divide-slate-100">
                {agentLogs.logs.map((log: any, idx: number) => (
                  <div key={idx} className="p-4 flex items-center justify-between hover:bg-slate-50/50 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold ${log.type === 'Vault Created' ? 'bg-green-50 text-green-600' : 'bg-[#EAF2FF] text-[#005CBE]'}`}>
                        {log.type === 'Vault Created' ? '🔐' : '📊'}
                      </div>
                      <div>
                        <p className="font-bold text-sm text-slate-900">{log.type}</p>
                        <p className="text-xs text-slate-500 font-medium">{log.details}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-slate-400">{log.time}</p>
                      {log.digest && log.digest !== '-' && (
                        <a
                          href={`https://suiscan.xyz/testnet/tx/${log.digest}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-[#005CBE] hover:underline flex items-center gap-1 justify-end mt-1 font-mono"
                        >
                          {log.digest.substring(0, 12)}... <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
