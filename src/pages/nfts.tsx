import { BadgeCheck, Plus, AlertCircle, Shield, Clock } from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";

export default function NftsPage() {
  const { data: nftsData, isLoading } = useQuery({
    queryKey: ["nfts"],
    queryFn: async () => {
      const res = await fetch("/api/v1/nfts/list");
      return res.json();
    }
  });

  const defaultNfts = [
    {
      id: "NFT-001",
      agentId: "Agent-Alpha",
      status: "Active",
      budget: "500 USDC",
      strategy: "DeepBook Market Making",
      expires: "12h 45m"
    },
    {
      id: "NFT-002",
      agentId: "Agent-Beta",
      status: "Expired",
      budget: "100 SUI",
      strategy: "Daily Rebalancing",
      expires: "Expired"
    }
  ];

  const nfts = nftsData?.nfts || defaultNfts;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Agent Passports</h1>
          <p className="text-slate-500 mt-1">Manage unique NFT permissions for your autonomous agents.</p>
        </div>
      </div>

      {isLoading ? (
        <div className="py-20 text-center text-slate-500">Loading NFT passports...</div>
      ) : (
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {nfts.map((nft: any) => (
          <Card key={nft.id} className="overflow-hidden border-slate-200">
            <div className={`h-2 ${nft.status === 'Active' ? 'bg-[#005CBE]' : 'bg-slate-300'}`} />
            <CardHeader className="pb-3">
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle className="text-xl flex items-center gap-2">
                    {nft.id}
                    {nft.status === 'Active' ? (
                      <BadgeCheck className="w-5 h-5 text-[#005CBE]" />
                    ) : (
                      <AlertCircle className="w-5 h-5 text-slate-400" />
                    )}
                  </CardTitle>
                  <CardDescription className="mt-1 font-mono text-xs">{nft.agentId}</CardDescription>
                </div>
                <div className={`px-2.5 py-1 text-xs font-semibold rounded-full ${
                  nft.status === 'Active' ? 'bg-blue-50 text-blue-700' : 'bg-slate-100 text-slate-500'
                }`}>
                  {nft.status}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="bg-slate-50 rounded-lg p-3 space-y-2 text-sm border border-slate-100">
                   <div className="flex justify-between text-slate-600">
                    <span className="flex items-center gap-1"><Shield className="w-3.5 h-3.5" /> Budget</span>
                    <span className="font-medium text-slate-900">{nft.budget || "N/A"}</span>
                   </div>
                   <div className="flex justify-between text-slate-600">
                    <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" /> Time Left</span>
                    <span className="font-medium text-slate-900">{nft.expires || "N/A"}</span>
                   </div>
                </div>

                <div>
                   <span className="text-xs font-semibold uppercase text-slate-500 tracking-wider">Strategy</span>
                   <p className="text-sm font-medium text-slate-900 mt-1">{nft.strategy || "Unknown Policy"}</p>
                </div>

                {nft.status === 'Active' && (
                  <Button variant="outline" className="w-full text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200">
                    Revoke Passport
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      )}
    </div>
  );
}
