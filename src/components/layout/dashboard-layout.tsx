import { Outlet, Link, useLocation } from "react-router-dom";
import { Bot, LayoutDashboard, Shield, History, Wallet, Settings, Menu, BadgeCheck } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { ConnectButton } from "@mysten/dapp-kit-react/ui";

export function DashboardLayout() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const location = useLocation();

  const navigation = [
    { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
    { name: "Agents", href: "/agents", icon: Bot },
    { name: "Policies", href: "/policies", icon: Shield },
    { name: "NFT Passports", href: "/nfts", icon: BadgeCheck },
    { name: "DeepBook", href: "/deepbook", icon: Wallet },
    { name: "Activity", href: "/activity", icon: History },
  ];

  return (
    <div className="flex min-h-screen bg-background">
      {/* Sidebar */}
      <aside className="hidden md:flex w-64 flex-col fixed inset-y-0 z-50 bg-background border-r border-border flex-shrink-0">
        <div className="p-6 flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center">
            <span className="text-background font-bold tracking-tighter">L</span>
          </div>
          <span className="font-semibold text-xl tracking-wide">LANS</span>
        </div>
        <nav className="flex-1 px-4 space-y-1 mt-6">
          {navigation.map((item) => {
            const isActive = location.pathname.startsWith(item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.name}
                to={item.href}
                className={cn(
                  "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                  isActive
                    ? "bg-primary/10 text-primary"
                    : "text-foreground/70 hover:bg-card hover:text-foreground"
                )}
              >
                <Icon className="w-5 h-5" />
                {item.name}
              </Link>
            );
          })}
        </nav>
        <div className="p-4 border-t border-border">
          <Link
            to="/settings"
            className="flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium text-foreground/70 hover:bg-card hover:text-foreground transition-colors"
          >
            <Settings className="w-5 h-5" />
            Settings
          </Link>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 md:pl-64 flex flex-col min-h-screen">
        <header className="hidden md:flex items-center justify-end p-4 border-b border-border bg-background">
          <ConnectButton />
        </header>
        
        <header className="md:hidden flex items-center justify-between p-4 border-b border-border bg-background">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center">
              <span className="text-background font-bold text-xs tracking-tighter">L</span>
            </div>
            <span className="font-semibold tracking-wide">LANS</span>
          </div>
          <div className="flex items-center gap-4">
            <ConnectButton />
            <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}>
              <Menu className="w-6 h-6 text-foreground" />
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
