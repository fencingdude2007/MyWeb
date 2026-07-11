import { Route, Routes } from "react-router-dom";

import { ProtectedRoute } from "./components/ProtectedRoute";
import { AccountPage } from "./pages/AccountPage";
import { AskPage } from "./pages/AskPage";
import { AuthCallbackPage } from "./pages/AuthCallbackPage";
import { CollectionDetailPage } from "./pages/CollectionDetailPage";
import { CollectionsPage } from "./pages/CollectionsPage";
import { DashboardPage } from "./pages/DashboardPage";
import { HomePage } from "./pages/HomePage";
import { LandingPage } from "./pages/LandingPage";
import { LibraryPage } from "./pages/LibraryPage";
import { LoginPage } from "./pages/LoginPage";
import { PageDetailPage } from "./pages/PageDetailPage";
import { ReviewPage } from "./pages/ReviewPage";

export default function App() {
  return (
    <Routes>
      <Route path="/welcome" element={<LandingPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/auth/callback" element={<AuthCallbackPage />} />
      <Route element={<ProtectedRoute />}>
        <Route path="/" element={<HomePage />} />
        <Route path="/library" element={<LibraryPage />} />
        <Route path="/review" element={<ReviewPage />} />
        <Route path="/collections" element={<CollectionsPage />} />
        <Route path="/collections/:id" element={<CollectionDetailPage />} />
        <Route path="/ask" element={<AskPage />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/account" element={<AccountPage />} />
        <Route path="/page/:id" element={<PageDetailPage />} />
      </Route>
    </Routes>
  );
}
