import { Routes, Route } from "react-router-dom";
import { DashboardLayout } from "./components/layout/dashboard-layout";

import LandingPage from "./pages/landing";
import DashboardPage from "./pages/dashboard";
import AgentsPage from "./pages/agents";
import PoliciesPage from "./pages/policies";
import ActivityPage from "./pages/activity";
import DeepBookPage from "./pages/deepbook";
import NftsPage from "./pages/nfts";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route element={<DashboardLayout />}>
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/agents" element={<AgentsPage />} />
        <Route path="/policies" element={<PoliciesPage />} />
        <Route path="/activity" element={<ActivityPage />} />
        <Route path="/deepbook" element={<DeepBookPage />} />
        <Route path="/nfts" element={<NftsPage />} />
      </Route>
    </Routes>
  );
}
