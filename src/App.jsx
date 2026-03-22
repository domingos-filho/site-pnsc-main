
import React, { Suspense, lazy } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from '@/components/ui/toaster';
import { AuthProvider } from '@/contexts/AuthContext';
import { DataProvider } from '@/contexts/DataContext';
import Layout from '@/components/Layout';
import PrivateRoute from '@/components/PrivateRoute';

const Home = lazy(() => import('@/pages/Home'));
const Communities = lazy(() => import('@/pages/Communities'));
const CommunityDetail = lazy(() => import('@/pages/CommunityDetail'));
const Pastorals = lazy(() => import('@/pages/Pastorals'));
const Gallery = lazy(() => import('@/pages/Gallery'));
const Events = lazy(() => import('@/pages/Events'));
const About = lazy(() => import('@/pages/About'));
const Team = lazy(() => import('@/pages/Team'));
const Contact = lazy(() => import('@/pages/Contact'));
const Login = lazy(() => import('@/pages/Login'));
const Dashboard = lazy(() => import('@/pages/Dashboard'));
const ManageGallery = lazy(() => import('@/pages/admin/ManageGallery'));
const ManageUsers = lazy(() => import('@/pages/admin/ManageUsers'));
const SiteSettings = lazy(() => import('@/pages/admin/SiteSettings'));

const PageLoader = () => (
  <div className="container mx-auto px-4 py-16 text-center text-gray-500">Carregando...</div>
);

function App() {
  return (
    <AuthProvider>
      <DataProvider>
        <Layout>
          <Suspense fallback={<PageLoader />}>
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/comunidades" element={<Communities />} />
              <Route path="/comunidades/:id" element={<CommunityDetail />} />
              <Route path="/pastorais" element={<Pastorals />} />
              <Route path="/galeria" element={<Gallery />} />
              <Route path="/agenda" element={<Events />} />
              <Route path="/quem-somos" element={<About />} />
              <Route path="/equipe" element={<Team />} />
              <Route path="/contato" element={<Contact />} />
              <Route path="/login" element={<Login />} />

              <Route
                path="/dashboard"
                element={
                  <PrivateRoute>
                    <Dashboard />
                  </PrivateRoute>
                }
              />
              <Route
                path="/dashboard/events"
                element={
                  <PrivateRoute requiredRole="secretary">
                    <Navigate to="/agenda" replace />
                  </PrivateRoute>
                }
              />
              <Route
                path="/dashboard/gallery"
                element={
                  <PrivateRoute requiredRole="member">
                    <ManageGallery />
                  </PrivateRoute>
                }
              />
              <Route
                path="/dashboard/users"
                element={
                  <PrivateRoute requiredRole="admin">
                    <ManageUsers />
                  </PrivateRoute>
                }
              />
              <Route
                path="/dashboard/settings"
                element={
                  <PrivateRoute requiredRole="admin">
                    <SiteSettings />
                  </PrivateRoute>
                }
              />
            </Routes>
          </Suspense>
        </Layout>
        <Toaster />
      </DataProvider>
    </AuthProvider>
  );
}

export default App;
