import React from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createDAppKit, DAppKitProvider } from '@mysten/dapp-kit-react';
import { SuiGrpcClient } from '@mysten/sui/grpc';
import '@mysten/dapp-kit-core/web'; // Register all Lit Web Components for the wallet UI
import App from "./App";
import "./index.css";

// 1. Setup the new DAppKit v2 Instance
const dAppKit = createDAppKit({
  networks: ['testnet', 'mainnet'],
  defaultNetwork: 'testnet',
  createClient: (network) =>
    new SuiGrpcClient({ network, baseUrl: `https://fullnode.${network}.sui.io:443` }),
});

// 2. TypeScript augmentation for robust hook typings
declare module '@mysten/dapp-kit-react' {
  interface Register {
    dAppKit: typeof dAppKit;
  }
}

const queryClient = new QueryClient();

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <DAppKitProvider dAppKit={dAppKit}>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </DAppKitProvider>
    </QueryClientProvider>
  </React.StrictMode>
);
