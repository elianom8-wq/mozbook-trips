import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useLocation, Navigate } from 'react-router-dom';
import Navbar from './components/Navbar';
import Home from './pages/Home';
import ListingDetails from './pages/ListingDetails';
import CreateListing from './pages/CreateListing';
import EditListing from './pages/EditListing';
import HostVerificationPage from './pages/HostVerificationPage';
import AdminVerifications from './pages/AdminVerifications';
import HostHub from './pages/HostHub';
import HostActivitiesDashboard from './pages/HostActivitiesDashboard';
import CreateActivityTrip from './pages/CreateActivityTrip';
import CreateTransport from './pages/CreateTransport';
import PartnerCategorySelection from './pages/PartnerCategorySelection';
import PartnerDashboard from './pages/PartnerDashboard';
import Discover from './pages/Discover';
import InfoHub from './pages/InfoHub';
import Eateries from './pages/Eateries';
import MozBookTrips from './pages/MozBookTrips';
import EmergencyDirectory from './pages/EmergencyDirectory';
import TravelCompanion from './pages/TravelCompanion';
import TravelGroupInvitationPage from './pages/TravelGroupInvitationPage';
import GroupDetails from './pages/GroupDetails';
import BookingStatusPage from './pages/BookingStatusPage';
import MyBookings from './pages/MyBookings';
import Messages from './pages/Messages';
import AdminLogin from './pages/admin/AdminLogin';
import AdminDashboard from './pages/admin/AdminDashboard';
import AdminUsers from './pages/admin/AdminUsers';
import AdminHosts from './pages/admin/AdminHosts';
import AdminProperties from './pages/admin/AdminProperties';
import AdminActivities from './pages/admin/AdminActivities';
import AdminBookings from './pages/admin/AdminBookings';
import AdminFinancials from './pages/admin/AdminFinancials';
import { AdminLegalManagement } from './pages/admin/AdminLegalManagement';
import { LegalHubPage } from './pages/LegalHubPage';
import AdminRoute from './components/AdminRoute';
import FloatingBottomBar from './components/FloatingBottomBar';
import { AuthProvider } from './context/AuthContext';
import { SearchProvider } from './context/SearchContext';
import AppSettingsModal from './components/AppSettingsModal';
import SearchModal from './components/SearchModal';
import { useAuth } from './context/AuthContext';

function AppLayout() {
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const location = useLocation();
  const { isAdmin } = useAuth();

  // Pure Admin Operations Console routes have their own internal layout
  const isPureAdminConsole = location.pathname.startsWith('/admin');

  return (
    <div className="min-h-screen bg-white font-sans text-gray-900 relative">
      {!isPureAdminConsole && <Navbar />}
      
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/listing/:id" element={<ListingDetails />} />
        <Route path="/listing/:id/edit" element={<EditListing />} />
        <Route path="/host/edit/:id" element={<EditListing />} />
        <Route path="/host/create" element={<CreateListing />} />
        <Route path="/host" element={<HostHub />} />
        <Route path="/host/portal" element={<HostHub />} />
        <Route path="/host/activities" element={<HostActivitiesDashboard />} />
        <Route path="/host/activities/create" element={<CreateActivityTrip />} />
        <Route path="/host/activities/edit/:id" element={<CreateActivityTrip />} />
        <Route path="/become-a-host" element={<CreateListing />} />
        <Route path="/host/verify" element={<HostVerificationPage />} />
        
        {/* MozBook Partner Onboarding Entry (Stage 3D-A) */}
        <Route path="/partner" element={<PartnerCategorySelection />} />
        <Route path="/partner/onboarding" element={<PartnerCategorySelection />} />
        <Route path="/partner/categories" element={<PartnerCategorySelection />} />
        
        {/* MozBook Transport Partner Onboarding (Stage 3I) */}
        <Route path="/partner/transport/create" element={<CreateTransport />} />
        <Route path="/partner/transport/edit/:id" element={<CreateTransport />} />
        <Route path="/host/transport/create" element={<CreateTransport />} />
        <Route path="/host/transport/edit/:id" element={<CreateTransport />} />
        
        {/* MozBook Partner Business Dashboard & Management (Stage 3H) */}
        <Route path="/partner/dashboard" element={<PartnerDashboard />} />
        <Route path="/partner/manage" element={<PartnerDashboard />} />
        <Route path="/partner/business" element={<PartnerDashboard />} />
        
        {/* MozBook Discover Route */}
        <Route path="/discover" element={<Discover />} />

        <Route path="/info-hub" element={<InfoHub />} />
        <Route path="/info" element={<Navigate to="/info-hub" replace />} />
        <Route path="/eateries" element={<Eateries />} />
        <Route path="/trips" element={<MozBookTrips />} />
        <Route path="/emergency" element={<EmergencyDirectory />} />
        <Route path="/travel-companion" element={<TravelCompanion />} />
        <Route path="/travel-companion/invite/:token" element={<TravelGroupInvitationPage />} />
        <Route path="/travel-companion/invite" element={<TravelGroupInvitationPage />} />
        <Route path="/travel-companion/group/:id" element={<GroupDetails />} />
        <Route path="/booking/:id/status" element={<BookingStatusPage />} />
        <Route path="/my-bookings" element={<MyBookings />} />
        <Route path="/messages" element={<Messages />} />

        {/* MozBook Operations Console Routes */}
        <Route path="/admin" element={<AdminLogin />} />
        <Route 
          path="/admin/dashboard" 
          element={
            <AdminRoute>
              <AdminDashboard />
            </AdminRoute>
          } 
        />
        <Route 
          path="/admin/users" 
          element={
            <AdminRoute>
              <AdminUsers />
            </AdminRoute>
          } 
        />
        <Route 
          path="/admin/hosts" 
          element={
            <AdminRoute>
              <AdminHosts />
            </AdminRoute>
          } 
        />
        <Route 
          path="/admin/properties" 
          element={
            <AdminRoute>
              <AdminProperties />
            </AdminRoute>
          } 
        />
        <Route 
          path="/admin/activities" 
          element={
            <AdminRoute>
              <AdminActivities />
            </AdminRoute>
          } 
        />
        <Route 
          path="/admin/bookings" 
          element={
            <AdminRoute>
              <AdminBookings />
            </AdminRoute>
          } 
        />
        <Route 
          path="/admin/financials" 
          element={
            <AdminRoute>
              <AdminFinancials />
            </AdminRoute>
          } 
        />
        <Route 
          path="/admin/verifications" 
          element={
            <AdminRoute>
              <AdminVerifications />
            </AdminRoute>
          } 
        />
        <Route 
          path="/admin/legal" 
          element={
            <AdminRoute>
              <AdminLegalManagement />
            </AdminRoute>
          } 
        />
        <Route path="/legal" element={<LegalHubPage />} />
        <Route 
          path="/admin/*" 
          element={
            <AdminRoute>
              <Navigate to="/admin/dashboard" replace />
            </AdminRoute>
          } 
        />
      </Routes>
    
      {/* Floating Bottom Quick Bar - only shown on public MozBook */}
      {!isPureAdminConsole && <FloatingBottomBar />}
      
      {/* Footer - only shown on public MozBook */}
      {!isPureAdminConsole && (
        <footer className="border-t border-gray-200 bg-gray-50 py-12 px-4 md:px-8 mt-12 mb-28 md:mb-24">
          <div className="max-w-7xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-8">
            <div>
              <h4 className="font-semibold text-gray-900 mb-4">Support & SOS</h4>
              <ul className="space-y-2.5 text-sm text-gray-600">
                <li>
                  <Link to="/emergency" className="text-red-600 hover:underline font-semibold flex items-center gap-1.5">
                    Emergency Directory
                  </Link>
                </li>
                <li>
                  <Link to="/info-hub" className="hover:underline hover:text-[#009A60]">
                    Information Hub
                  </Link>
                </li>
                <li>
                  <Link to="/info-hub" className="hover:underline hover:text-[#009A60]">
                    Help Center & FAQs
                  </Link>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-gray-900 mb-4">Explore Mozambique</h4>
              <ul className="space-y-2.5 text-sm text-gray-600">
                <li>
                  <Link to="/eateries" className="hover:underline hover:text-[#009A60]">
                    Eateries & Social Check-In
                  </Link>
                </li>
                <li>
                  <Link to="/trips" className="hover:underline hover:text-[#009A60]">
                    MozBook Trips & Activities
                  </Link>
                </li>
                <li>
                  <Link to="/travel-companion" className="hover:underline hover:text-[#009A60]">
                    Travel Companion
                  </Link>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-gray-900 mb-4">Hosting</h4>
              <ul className="space-y-2.5 text-sm text-gray-600">
                <li>
                  <Link to="/host/create" className="hover:underline hover:text-[#009A60]">
                    List Your Property
                  </Link>
                </li>
                <li>
                  <Link to="/host/activities" className="hover:underline hover:text-[#009A60]">
                    List Activities & Trips
                  </Link>
                </li>
                <li>
                  <Link to="/partner" className="hover:underline hover:text-[#009A60]">
                    Hosting Resources
                  </Link>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-gray-900 mb-4">Trust & Legal</h4>
              <ul className="space-y-2.5 text-sm text-gray-600">
                <li>
                  <Link to="/legal?tab=terms_customer" className="hover:underline hover:text-[#009A60]">
                    Customer Terms
                  </Link>
                </li>
                <li>
                  <Link to="/legal?tab=privacy_policy" className="hover:underline hover:text-[#009A60]">
                    Privacy Policy
                  </Link>
                </li>
                <li>
                  <Link to="/legal?tab=cancellation_refund_policy" className="hover:underline hover:text-[#009A60]">
                    Cancellation & Refund Policy
                  </Link>
                </li>
                <li>
                  <Link to="/legal?tab=partner_agreement" className="hover:underline hover:text-[#009A60]">
                    Partner Agreement
                  </Link>
                </li>
                {isAdmin && (
                  <li className="pt-2 border-t border-gray-200">
                    <Link to="/admin/dashboard" className="text-[#009A60] hover:underline font-bold flex items-center gap-1">
                      <span>Operations Console</span>
                    </Link>
                  </li>
                )}
              </ul>
            </div>
          </div>
          <div className="max-w-7xl mx-auto mt-12 pt-8 border-t border-gray-200 flex flex-col md:flex-row justify-between items-center gap-4 text-sm text-gray-600">
            <div className="flex flex-wrap items-center gap-4">
              <span>© 2026 Elvira da Gloria Consulting SU, Lda. (MozBook)</span>
              <Link to="/legal?tab=privacy_policy" className="hover:text-gray-900 transition-colors">
                · Privacy Policy
              </Link>
              <Link to="/legal?tab=terms_customer" className="hover:text-gray-900 transition-colors">
                · Terms & Conditions
              </Link>
              <Link to="/legal?tab=cancellation_refund_policy" className="hover:text-gray-900 transition-colors">
                · Cancellation & Refunds
              </Link>
              <Link to="/legal?tab=partner_agreement" className="hover:text-gray-900 transition-colors">
                · Partner Agreement
              </Link>
              <button
                type="button"
                onClick={() => setShowSettingsModal(true)}
                className="text-[#009A60] hover:text-[#007a4c] font-semibold hover:underline cursor-pointer"
              >
                · App Permissions (Camera & Location)
              </button>
            </div>
          </div>
        </footer>
      )}

      {/* Global Search Modal */}
      <SearchModal />

      {/* Centralized App Settings Modal */}
      {showSettingsModal && (
        <AppSettingsModal
          isOpen={showSettingsModal}
          onClose={() => setShowSettingsModal(false)}
        />
      )}
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <Router>
        <SearchProvider>
          <AppLayout />
        </SearchProvider>
      </Router>
    </AuthProvider>
  );
}

