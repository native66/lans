import { useState } from "react";
import { Link } from "react-router-dom";
import {
  Bot, Settings, BarChart2, Shield, Zap, History, Plus,
  HelpCircle, MessageSquare, Waves, TrendingUp, ShieldCheck,
  CheckCircle2, Clock, Check, Activity
} from "lucide-react";
import { motion } from "motion/react";
import { ConnectButton } from "@mysten/dapp-kit-react/ui";
import { useCurrentAccount } from "@mysten/dapp-kit-react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { SuiGraphQLClient } from '@mysten/sui/graphql';

const graphqlClient = new SuiGraphQLClient({
  url: 'https://sui-testnet.mystenlabs.com/graphql',
  network: 'testnet' as const
});

export default function LandingPage() {
  const account = useCurrentAccount();
  const navigate = useNavigate();
  const AGENT_POLICY_PACKAGE_ID = (import.meta as any).env.VITE_AGENT_POLICY_PACKAGE_ID || "0xYOUR_PACKAGE_ID";

  const { data: globalEvents, isLoading } = useQuery({
    queryKey: ['landing-global-events'],
    queryFn: async () => {
      const result = await graphqlClient.query({
        query: `
          query QueryEvents($type: String, $first: Int) {
            events(first: $first, filter: { eventType: $type }) {
              nodes {
                timestamp
                contents { json }
                sender { address }
              }
            }
          }
        `,
        variables: { type: `${AGENT_POLICY_PACKAGE_ID}::policy::TradeLog`, first: 3 }
      });
      return (result.data as any)?.events?.nodes || [];
    },
    enabled: AGENT_POLICY_PACKAGE_ID !== "0xYOUR_PACKAGE_ID",
    refetchInterval: 10000,
  });

  const recentTrades = globalEvents?.map((event: any, index: number) => {
    const parsed = event?.contents?.json;
    const amountSui = (Number(parsed?.amount_spent || 0) / 1e9).toFixed(2);
    return {
      id: index, // In GraphQL we don't fetch txDigest directly in events node without a custom selection, using index for key
      agent: parsed?.agent || "Unknown",
      amount: amountSui,
    };
  }) || [];

  return (
    <div className="min-h-screen bg-[#F4F9FF] text-slate-900 font-sans selection:bg-blue-100 pb-32 relative">
      {/* Custom Generated CSS Background with Glass Bubbles */}
      <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden">
        {/* Gradients */}
        <div className="absolute top-[-10%] right-[-5%] w-[60%] h-[60%] bg-[#7CC7FF] rounded-full mix-blend-multiply filter blur-[100px] opacity-60"></div>
        <div className="absolute top-[20%] left-[-10%] w-[50%] h-[70%] bg-[#4DA2FF] rounded-full mix-blend-multiply filter blur-[120px] opacity-80"></div>
        <div className="absolute bottom-[-10%] left-[20%] w-[50%] h-[50%] bg-[#0A192F] rounded-full mix-blend-multiply filter blur-[140px] opacity-60"></div>
        <div className="absolute bottom-[-5%] right-[10%] w-[40%] h-[50%] bg-[#4DA2FF] rounded-full mix-blend-multiply filter blur-[120px] opacity-50"></div>
        <div className="absolute top-[0%] left-[10%] w-[40%] h-[40%] bg-white rounded-full mix-blend-normal filter blur-[80px] opacity-100"></div>

        {/* Outline Bubbles */}
        <div className="absolute top-[-10%] right-[10%] w-[40vw] h-[40vw] rounded-full border-[1.5px] border-white/40"></div>
        <div className="absolute top-[20%] left-[-10%] w-[45vw] h-[45vw] rounded-full border-[1.5px] border-white/30"></div>
        <div className="absolute bottom-[-20%] left-[5%] w-[50vw] h-[50vw] rounded-full border-[1.5px] border-white/20"></div>
        <div className="absolute top-[40%] right-[-10%] w-[35vw] h-[35vw] rounded-full border-[1.5px] border-white/20"></div>
      </div>

      {/* Top Nav */}
      <header className="flex items-center justify-between px-6 lg:px-10 py-5 bg-white/95 border-b border-white/40 sticky top-0 z-50">
        <div className="flex items-center gap-2">
          <span className="text-2xl font-bold text-[#005CBE] tracking-tight">LANS</span>
        </div>
        <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-slate-600">
          <span className="text-[#005CBE] border-b-2 border-[#005CBE] pb-1 cursor-pointer">Overview</span>
          <span className="hover:text-slate-900 cursor-pointer">Agents</span>
          <span className="hover:text-slate-900 cursor-pointer">Policies</span>
          <span className="hover:text-slate-900 cursor-pointer">Activity</span>
          <span className="hover:text-slate-900 cursor-pointer">Passports</span>
          <a href="https://deepbook.tech" target="_blank" rel="noopener noreferrer" className="hover:text-slate-900 cursor-pointer">DeepBook</a>
        </nav>
        <div className="flex items-center gap-4">
          <button className="px-5 py-2 text-sm font-medium border border-slate-200 rounded-full hover:bg-slate-50 text-[#005CBE] transition-colors">
            Docs
          </button>
          <ConnectButton />
          <button className="p-2 text-slate-400 hover:text-slate-600 transition-colors">
            <Settings className="w-5 h-5" />
          </button>
        </div>
      </header>

      <div className="flex flex-col lg:flex-row max-w-[1440px] mx-auto px-6 lg:px-10 mt-10 gap-10 relative z-10">

        {/* Main Content */}
        <main className="flex-1 space-y-20 py-2">

          {/* Hero Section */}
          <section className="flex flex-col lg:flex-row items-center justify-between gap-12">
            <div className="max-w-2xl flex-1">
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="inline-flex items-center px-4 py-1.5 rounded-full bg-[#EAF2FF] text-[#005CBE] text-xs font-semibold tracking-wide mb-8 shadow-sm"
              >
                <div className="w-2 h-2 rounded-full bg-[#005CBE] mr-2 animate-pulse" />
                The Easiest Way to Explore Sui
              </motion.div>

              <motion.h1
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="text-[4rem] md:text-[4.5rem] leading-[1.05] font-extrabold text-slate-900 tracking-tight mb-6"
              >
                <br />
                <span className="text-[#005CBE]">LANS - Language agent Autonomous Native</span> <br />
                on SUI.
              </motion.h1>

              <motion.p
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="text-lg md:text-xl text-slate-600 leading-relaxed max-w-xl mb-12"
              >
                LANS is an advanced, non-custodial AI Intent Engine built exclusively for the Sui Hackathon. It bridges the gap between human language and on-chain execution — enabling anyone to trade on Sui DeepBook V3 simply by describing their intent in plain English.
                <br />
                No command lines. No complex UIs. No private key exposure. Just intent.
              </motion.p>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="flex items-center gap-4"
              >
                {account ? (
                  <button
                    onClick={() => navigate("/dashboard")}
                    className="px-8 py-4 bg-[#005CBE] text-white rounded-full font-semibold hover:bg-[#004e9f] transition-all shadow-[0_4px_20px_rgba(0,92,190,0.3)] hover:scale-105"
                  >
                    Go to Dashboard
                  </button>
                ) : (
                  <div className="transform scale-125 origin-left">
                    <ConnectButton />
                  </div>
                )}
                <button className="px-8 py-4 bg-white text-[#005CBE] border border-slate-200 rounded-full font-semibold hover:bg-slate-50 transition-all hover:scale-105 shadow-sm">
                  Watch Tutorial
                </button>
              </motion.div>
            </div>

            {/* 3D Floating Sui Drop Graphic */}
            <motion.div
              initial={{ opacity: 0, scale: 0.8, rotate: -5 }}
              animate={{ opacity: 1, scale: 1, rotate: 0 }}
              transition={{ duration: 1, delay: 0.2, type: "spring" }}
              className="hidden lg:flex flex-1 relative items-center justify-center min-h-[400px]"
            >
              <motion.div
                animate={{ y: [-15, 15, -15] }}
                transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
                className="relative z-10 w-[300px] h-[300px] lg:w-[350px] lg:h-[350px]"
              >
                {/* Glossy 3D Water Drop Shape */}
                <div
                  className="absolute inset-0 rounded-[50%_50%_50%_50%/60%_60%_40%_40%] rotate-45 border-[2px] border-white/40 shadow-[inset_10px_20px_40px_rgba(255,255,255,0.8),inset_-10px_-20px_40px_rgba(0,92,190,0.5),0_30px_60px_rgba(0,92,190,0.3)] backdrop-blur-xl flex items-center justify-center overflow-hidden"
                  style={{
                    background: 'linear-gradient(135deg, rgba(255,255,255,0.6) 0%, rgba(77,162,255,0.4) 30%, rgba(0,92,190,0.6) 100%)',
                    borderRadius: '0 50% 50% 50%'
                  }}
                >
                  <div className="-rotate-45 p-6 rounded-full bg-white/20 shadow-lg backdrop-blur-md border border-white/50">
                    <svg width="80" height="80" viewBox="0 0 400 400" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path fillRule="evenodd" clipRule="evenodd" d="M197.376 71.3347C198.854 69.5551 201.617 69.5551 203.094 71.3347L280.465 164.535L280.715 164.849C294.951 182.255 303.47 204.374 303.471 228.453C303.471 284.533 257.256 329.998 200.24 330C143.223 330 97 284.534 97 228.453C97.001 204.375 105.52 182.255 119.756 164.849L120.006 164.546L197.376 71.3347ZM138.523 178.129C127.606 191.477 121.069 208.448 121.068 226.913C121.068 269.921 156.51 304.789 200.23 304.791C212.695 304.791 224.493 301.954 234.984 296.905L234.996 296.899C235.197 296.798 235.337 296.604 235.369 296.381C236.074 290.481 235.777 283.729 234.151 276.87C230.251 260.431 216.717 245.436 193.471 232.401C166.73 217.454 150.739 198.154 146.261 175.008C146.023 173.777 145.813 172.551 145.647 171.332C145.567 170.744 144.826 170.531 144.447 170.988L138.523 178.129ZM204.156 108.504C202.132 106.065 198.339 106.065 196.314 108.504L184.775 122.412C181.245 126.711 177.091 133.852 174.298 142.374C171.504 150.898 170.051 160.849 171.996 170.756C175.007 186.079 186.483 199.563 206.521 210.763C236.193 227.395 254.216 247.942 259.75 271.895C260.043 273.162 260.296 274.42 260.51 275.665C260.613 276.242 261.346 276.432 261.718 275.98C272.775 262.589 279.402 245.508 279.402 226.913C279.402 208.594 272.965 191.748 262.202 178.449C262.199 178.446 262.2 178.441 262.202 178.438C262.205 178.435 262.206 178.43 262.203 178.427L204.156 108.504Z" fill="#005CBE" />
                    </svg>
                  </div>
                </div>
                {/* Extra Refraction Layer on Drop */}
                <div
                  className="absolute inset-[5%] rounded-full opacity-60 backdrop-blur-2xl blur-md pointer-events-none"
                  style={{
                    background: 'radial-gradient(circle at 30% 30%, rgba(255,255,255,1) 0%, transparent 40%)'
                  }}
                />
              </motion.div>

              {/* Optional smaller floating elements */}
              <motion.div
                animate={{ y: [-10, 10, -10], rotate: [0, 10, 0] }}
                transition={{ duration: 4, repeat: Infinity, ease: "easeInOut", delay: 1 }}
                className="absolute top-[10%] right-[10%] w-16 h-16 rounded-2xl bg-white/40 shadow-xl backdrop-blur-md border border-white/60 flex items-center justify-center z-0"
              >
                <Zap className="w-8 h-8 text-[#005CBE]" />
              </motion.div>

              <motion.div
                animate={{ y: [15, -15, 15], rotate: [0, -15, 0] }}
                transition={{ duration: 5, repeat: Infinity, ease: "easeInOut", delay: 2 }}
                className="absolute bottom-[20%] left-[5%] w-20 h-20 rounded-[50%_50%_0_50%] rotate-45 bg-[#7CC7FF]/40 shadow-lg backdrop-blur-xl border border-white/50 flex items-center justify-center z-20"
              >
                <div className="-rotate-45">
                  <ShieldCheck className="w-8 h-8 text-[#005CBE]" />
                </div>
              </motion.div>
            </motion.div>

          </section>

          {/* Live Network Activity Section */}
          <section>
            <div className="flex items-end justify-between mb-8">
              <div>
                <h2 className="text-4xl font-bold text-slate-900 tracking-tight mb-2">Live Network Activity</h2>
                <p className="text-slate-600">Real-time autonomous agent executions on Sui Testnet</p>
              </div>
              <span className="text-green-600 font-semibold flex items-center gap-2 text-sm bg-green-50 px-3 py-1 rounded-full">
                <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                Network Synced
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">

              {isLoading ? (
                <div className="col-span-1 md:col-span-2 lg:col-span-3 text-center py-20 text-slate-400">Loading live network activity...</div>
              ) : recentTrades.length === 0 ? (
                <div className="col-span-1 md:col-span-2 lg:col-span-3 text-center py-20 text-slate-400">No recent autonomous trades on Testnet. Start using the system!</div>
              ) : recentTrades.map((trade) => (
                <div key={trade.id} className="bg-white rounded-[2rem] p-8 shadow-sm border border-slate-100 flex flex-col hover:shadow-md transition-shadow">
                  <div className="flex justify-between items-start mb-6">
                    <div className="w-12 h-12 rounded-xl bg-[#EAF2FF] text-[#005CBE] flex items-center justify-center">
                      <Activity className="w-6 h-6" />
                    </div>
                    <div className="flex items-center gap-1.5 px-3 py-1 bg-green-50 text-green-700 rounded-full text-[10px] font-bold uppercase tracking-wider">
                      <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                      Executed
                    </div>
                  </div>
                  <h3 className="text-xl font-bold text-slate-900 mb-3">On-chain Trade</h3>
                  <p className="text-sm text-slate-500 leading-relaxed min-h-[60px] mb-8">
                    Agent <span className="font-mono text-[#005CBE] bg-blue-50 px-1 py-0.5 rounded">{trade.agent.substring(0, 8)}...</span> securely executed a trade on DeepBook V3.
                  </p>
                  <div className="mb-8">
                    <div className="flex justify-between items-end mb-3">
                      <span className="text-[10px] font-bold text-slate-400 tracking-widest uppercase w-1/2">Transaction<br />Volume</span>
                      <span className="text-sm font-bold text-slate-900 text-right w-1/2">{trade.amount} SUI</span>
                    </div>
                    <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                      <div className="bg-[#005CBE] w-[100%] h-full rounded-full" />
                    </div>
                  </div>
                  <div className="mt-auto flex items-center gap-3">
                    <button className="flex-1 py-3 text-sm font-semibold text-[#005CBE] bg-[#EAF2FF] hover:bg-blue-100 rounded-xl transition-colors">
                      View details
                    </button>
                  </div>
                </div>
              ))}

            </div>
          </section>

          {/* Bottom Grid for Execution & Security */}
          <section className="grid grid-cols-1 lg:grid-cols-2 gap-10">

            {/* Execution Activity */}
            <div>
              <div className="flex items-center gap-3 mb-8">
                <div className="w-10 h-10 rounded-full bg-[#EAF2FF] flex items-center justify-center text-[#005CBE]">
                  <Clock className="w-5 h-5" />
                </div>
                <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Recent Activity</h2>
              </div>

              <div className="bg-white rounded-[2rem] p-8 shadow-sm border border-slate-100">
                <div className="relative border-l border-[#EAF2FF] ml-4 space-y-10 pb-8">

                  {/* Event 1 */}
                  <div className="relative pl-8">
                    <div className="absolute -left-[9px] top-1 w-[18px] h-[18px] bg-white border-[3px] border-[#005CBE] text-[#005CBE] rounded-full flex items-center justify-center z-10" />
                    <div className="flex justify-between items-start mb-2">
                      <h4 className="font-bold text-slate-900">Saved money on fees</h4>
                      <span className="text-xs text-slate-400 bg-slate-50 px-2 py-1 rounded-md">2m ago</span>
                    </div>
                    <p className="text-sm text-slate-500 leading-relaxed bg-slate-50/50 p-4 rounded-xl">
                      Swapped 5,000 SUI for USDC seamlessly on DeepBook. Sui's low fees saved you $2 compared to other networks.
                    </p>
                  </div>

                  {/* Event 2 */}
                  <div className="relative pl-8">
                    <div className="absolute -left-[9px] top-1 w-[18px] h-[18px] bg-white border-[3px] border-[#005CBE] text-[#005CBE] rounded-full flex items-center justify-center z-10" />
                    <div className="flex justify-between items-start mb-2">
                      <h4 className="font-bold text-slate-900 pr-4">Daily Rewards Collected</h4>
                      <span className="text-xs text-slate-400 bg-slate-50 px-2 py-1 rounded-md shrink-0">45m ago</span>
                    </div>
                    <p className="text-sm text-slate-500 leading-relaxed bg-slate-50/50 p-4 rounded-xl">
                      Your Smart Saver bot collected 142.5 SUI in rewards and safely put them back to work.
                    </p>
                  </div>

                  {/* Event 3 */}
                  <div className="relative pl-8">
                    <div className="absolute -left-[9px] top-1 w-[18px] h-[18px] bg-white border-[3px] border-slate-200 text-slate-200 rounded-full flex items-center justify-center z-10" />
                    <div className="flex justify-between items-start mb-2">
                      <h4 className="font-bold text-slate-900 pr-4">Health Check: All Good!</h4>
                      <span className="text-xs text-slate-400 bg-slate-50 px-2 py-1 rounded-md shrink-0">2h ago</span>
                    </div>
                    <p className="text-sm text-slate-500 leading-relaxed bg-slate-50/50 p-4 rounded-xl">
                      All your delightful assistants are running perfectly. Your funds are completely safe.
                    </p>
                  </div>
                </div>

                <div className="pt-2">
                  <button className="w-full py-3.5 border border-slate-200 hover:bg-slate-50 text-[#005CBE] font-semibold rounded-xl transition-colors">
                    See All Activity
                  </button>
                </div>
              </div>
            </div>

            {/* Security Policies */}
            <div>
              <div className="flex items-center gap-3 mb-8">
                <div className="w-10 h-10 rounded-full bg-[#EAF2FF] flex items-center justify-center text-[#005CBE]">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Your Safety Controls</h2>
              </div>

              <div className="bg-white rounded-[2rem] p-8 shadow-sm border border-slate-100 flex flex-col h-full">

                <div className="bg-[#F0F5FF] rounded-2xl p-6 flex items-center justify-between mb-8 border border-[#EAF2FF]">
                  <div>
                    <h4 className="text-[10px] font-bold text-[#005CBE] tracking-wider uppercase mb-1">You Are In Charge</h4>
                    <p className="text-slate-900 font-medium text-sm">
                      Master Switch: <span className="text-green-600 font-semibold">Ready</span>
                    </p>
                  </div>
                  <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center shadow-sm text-[#005CBE]">
                    <ShieldCheck className="w-5 h-5" />
                  </div>
                </div>

                <div className="space-y-6 flex-1">

                  {/* Item 1 */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 shrink-0">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="4" width="20" height="16" rx="2" /><path d="M7 15h0M2 9.5h20" /></svg>
                      </div>
                      <div>
                        <h5 className="font-bold text-slate-900 text-sm">Daily Spending Limit</h5>
                        <p className="text-xs text-slate-500 mt-0.5 max-w-[200px]">Agents can't spend more than $100 a day</p>
                      </div>
                    </div>
                    {/* Toggle Component */}
                    <div className="w-12 h-6 bg-[#005CBE] rounded-full relative cursor-pointer px-1 flex items-center ml-2 border border-[#005CBE]/10">
                      <div className="w-4 h-4 bg-white rounded-full absolute right-1 shadow-sm" />
                    </div>
                  </div>

                  {/* Item 2 */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 shrink-0">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><path d="M12 8v4l3 3" /></svg>
                      </div>
                      <div>
                        <h5 className="font-bold text-slate-900 text-sm">Safe Apps Only</h5>
                        <p className="text-xs text-slate-500 mt-0.5 max-w-[200px]">Only interact with trusted Sui friends</p>
                      </div>
                    </div>
                    {/* Toggle Component */}
                    <div className="w-12 h-6 bg-[#005CBE] rounded-full relative cursor-pointer px-1 flex items-center ml-2 border border-[#005CBE]/10">
                      <div className="w-4 h-4 bg-white rounded-full absolute right-1 shadow-sm" />
                    </div>
                  </div>

                  {/* Item 3 */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 shrink-0">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /><path d="M12 8v4" /><path d="M12 16h.01" /></svg>
                      </div>
                      <div>
                        <h5 className="font-bold text-slate-900 text-sm">Panic Button (Auto Stop)</h5>
                        <p className="text-xs text-slate-500 mt-0.5 max-w-[200px]">Pause everything if markets get crazy</p>
                      </div>
                    </div>
                    {/* Toggle Component */}
                    <div className="w-12 h-6 bg-[#005CBE] rounded-full relative cursor-pointer px-1 flex items-center ml-2 border border-[#005CBE]/10">
                      <div className="w-4 h-4 bg-white rounded-full absolute right-1 shadow-sm" />
                    </div>
                  </div>

                </div>

                <div className="pt-8 mt-auto">
                  <button className="w-full py-4 bg-[#0F172A] text-white font-semibold rounded-xl hover:bg-slate-800 transition-colors flex items-center justify-center gap-2 shadow-lg shadow-slate-900/10">
                    <Shield className="w-4 h-4" />
                    Adjust My Safety Limits
                  </button>
                </div>

              </div>
            </div>

          </section>
        </main>
      </div>

      {/* Floating Chat Bubble */}
      <button className="fixed bottom-8 right-8 w-14 h-14 bg-[#005CBE] text-white rounded-full flex items-center justify-center shadow-xl hover:bg-[#004e9f] hover:-translate-y-1 transition-all z-50">
        <MessageSquare className="w-6 h-6" />
      </button>

    </div>
  );
}

