import React from 'react';
import { Navigate, Link } from 'react-router-dom';
import { Lock, LogOut, ArrowLeft } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function AdminRoute({ children }: { children: React.ReactNode }) {
  const { user, isAdmin, loading, logout } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6 text-slate-300 font-sans">
        <div className="text-center">
          <div className="animate-spin w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full mx-auto mb-4" />
          <p className="text-xs font-mono tracking-wider uppercase text-slate-400">
            Checking Authorization...
          </p>
        </div>
      </div>
    );
  }

  // Not authenticated at all -> redirect to /admin to sign in
  if (!user) {
    return <Navigate to="/admin" replace />;
  }

  // Authenticated as an ordinary user/customer/host, but NOT an authorized administrator
  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4 font-sans">
        <div className="bg-slate-900 border border-red-500/30 rounded-3xl max-w-md w-full p-8 shadow-2xl text-center relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1 bg-red-500" />
          
          <div className="w-14 h-14 bg-red-500/10 border border-red-500/20 text-red-400 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Lock size={28} />
          </div>

          <h2 className="text-xl font-bold text-white mb-2">
            Access Restricted
          </h2>

          <p className="text-xs text-slate-400 mb-6 leading-relaxed">
            You are signed in as <strong className="text-slate-200 font-mono">{user.email}</strong>. 
            This account does not have administrator privileges to access this area.
          </p>

          <div className="space-y-3">
            <button
              onClick={() => logout()}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition-colors cursor-pointer"
            >
              <LogOut size={14} />
              <span>Sign out / Switch account</span>
            </button>

            <Link
              to="/"
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-transparent hover:bg-slate-800 text-slate-400 hover:text-white text-xs font-medium transition-colors"
            >
              <ArrowLeft size={14} />
              <span>Return to MozBook Home</span>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
