import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import ScrollToTop from './components/ScrollToTop';
import { ReuseProvider } from '@/lib/ReuseContext';
import { ProjectProvider } from '@/lib/ProjectContext';
import AppShell from '@/components/layout/AppShell';
import Home from '@/pages/Home';
import MaterialsGuide from '@/pages/MaterialsGuide';
import SavedProjects from '@/pages/SavedProjects';
import ScrapScanner from '@/pages/ScrapScanner';
import CompareLayouts from '@/pages/CompareLayouts';
import Settings from '@/pages/Settings';

// 1. IMPORT THE NEW NAJL COMPONENT
import NajlExperience from './NajlExperience';

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError, navigateToLogin } = useAuth();

  // Show loading spinner while checking app public settings or auth
  if (isLoadingPublicSettings || isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
      </div>
    );
  }

  // Handle authentication errors
  if (authError) {
    if (authError.type === 'user_not_registered') {
      return <UserNotRegisteredError />;
    } else if (authError.type === 'auth_required') {
      // Redirect to login automatically
      navigateToLogin();
      return null;
    }
  }

  // Render the main app
  return (
    <ReuseProvider><ProjectProvider>
      <Routes>
        <Route element={<AppShell />}>
          <Route path="/" element={<Home />} />
          <Route path="/materials-guide" element={<MaterialsGuide />} />
          <Route path="/saved" element={<SavedProjects />} />
          <Route path="/scanner" element={<ScrapScanner />} />
          <Route path="/compare" element={<CompareLayouts />} />
          <Route path="/settings" element={<Settings />} />
        </Route>
        <Route path="*" element={<PageNotFound />} />
      </Routes>
    </ProjectProvider></ReuseProvider>
  );
};


function App() {
  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <Router>
          <ScrollToTop />
          
          <Routes>
            {/* 2. PUBLIC ROUTE: The NAJL Landing Page */}
            {/* Placed here so it bypasses Authentication and doesn't use the AppShell */}
            <Route path="/najl" element={<NajlExperience />} />

            {/* 3. AUTHENTICATED APP: Everything else runs through your normal setup */}
            <Route path="/*" element={<AuthenticatedApp />} />
          </Routes>

        </Router>
        <Toaster />
      </QueryClientProvider>
    </AuthProvider>
  )
}

export default App