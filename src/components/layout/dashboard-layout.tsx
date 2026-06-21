import { Outlet, Link, useLocation } from "react-router-dom";
import { Bot, LayoutDashboard, Shield, History, Wallet, Menu, BadgeCheck, LogOut } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { ConnectButton } from "@mysten/dapp-kit-react/ui";
import { useDAppKit } from "@mysten/dapp-kit-react";

export function DashboardLayout() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const location = useLocation();
  const dAppKit = useDAppKit();

  const navigation = [
    { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
    { name: "Agents", href: "/agents", icon: Bot },
    { name: "Policies", href: "/policies", icon: Shield },
    { name: "NFT Passports", href: "/nfts", icon: BadgeCheck },
    { name: "DeepBook", href: "/deepbook", icon: Wallet },
    { name: "Activity", href: "/activity", icon: History },
  ];

  return (
    <div className="flex min-h-screen bg-[#F4F9FF] text-slate-900 font-sans selection:bg-blue-100 relative">
      {/* Custom Generated CSS Background with Glass Bubbles */}
      <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden fixed">
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

      {/* Sidebar */}
      <aside className="hidden md:flex w-64 flex-col fixed inset-y-0 z-50 bg-white/60 backdrop-blur-xl border-r border-white/40 flex-shrink-0 shadow-[4px_0_24px_rgba(0,92,190,0.05)]">
        <Link to="/" className="p-6 flex items-center gap-3 hover:opacity-80 transition-opacity">
          <img src="/logo.png" alt="LANS Logo" className="h-20 object-contain scale-110 origin-left" />
        </Link>
        <nav className="flex-1 px-4 space-y-1 mt-6">
          {navigation.map((item) => {
            const isActive = location.pathname.startsWith(item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.name}
                to={item.href}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200",
                  isActive
                    ? "bg-[#EAF2FF] text-[#005CBE] shadow-[0_2px_10px_rgba(0,92,190,0.1)]"
                    : "text-slate-500 hover:bg-white/60 hover:text-slate-900"
                )}
              >
                <Icon className="w-5 h-5" />
                {item.name}
              </Link>
            );
          })}
        </nav>
        <div className="p-4 border-t border-white/40">
          <button
            onClick={() => {
              try {
                dAppKit.disconnectWallet();
              } catch (e) {
                console.error("Disconnect error", e);
              }
            }}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold text-slate-500 hover:bg-red-50 hover:text-red-600 transition-all duration-200"
          >
            <LogOut className="w-5 h-5" />
            Disconnect
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 md:pl-64 flex flex-col min-h-screen relative z-10">
        <header className="hidden md:flex items-center justify-end px-6 lg:px-10 py-4 border-b border-white/40 bg-white/40 backdrop-blur-md sticky top-0 z-40">
          <ConnectButton />
        </header>
        
        <header className="md:hidden flex items-center justify-between px-6 py-4 border-b border-white/40 bg-white/60 backdrop-blur-md sticky top-0 z-40">
          <Link to="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
            <img src="/logo.png" alt="LANS Logo" className="h-16 object-contain scale-110 origin-left" />
          </Link>
          <div className="flex items-center gap-4">
            <ConnectButton />
            <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} className="p-2 bg-white/80 rounded-lg text-[#005CBE]">
              <Menu className="w-6 h-6" />
            </button>
          </div>
        </header>
        
        <div className="flex-1 p-6 md:p-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
