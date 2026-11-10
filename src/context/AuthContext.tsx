import React, { createContext, useContext, useEffect, useState } from 'react';
import { 
  onAuthStateChanged, 
  User, 
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  GoogleAuthProvider, 
  signOut,
  IdTokenResult
} from 'firebase/auth';
import { doc, getDoc, setDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { adminService } from '../services/adminService';
import { 
  evaluateSessionTransition,
  commitActiveSessionUid,
  setFreshAuthNavigationPending,
  purgeAllUserSessionData
} from '../services/authSessionManager';

import { 
  ADMIN_PERMISSIONS, 
  AdminPermission, 
  MASTER_ADMIN_EMAIL 
} from '../types/adminPermissions';

export const ADMIN_EMAIL = MASTER_ADMIN_EMAIL;

interface AuthContextType {
  user: User | null;
  profile: any | null;
  isAdmin: boolean;
  isMaster: boolean;
  adminPermissions: AdminPermission[];
  hasPermission: (permission: AdminPermission) => boolean;
  hasCustomClaim: boolean;
  tokenClaims: Record<string, any> | null;
  loading: boolean;
  login: () => Promise<void>;
  loginWithRedirect: () => Promise<void>;
  logout: () => Promise<void>;
  refreshAdminClaims: () => Promise<boolean>;
  isAuthModalOpen: boolean;
  authModalMode: 'login' | 'signup';
  openAuthModal: (mode?: 'login' | 'signup') => void;
  closeAuthModal: () => void;
  authError: string | null;
  clearAuthError: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<any | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isMaster, setIsMaster] = useState(false);
  const [adminPermissions, setAdminPermissions] = useState<AdminPermission[]>([]);
  const [hasCustomClaim, setHasCustomClaim] = useState(false);
  const [tokenClaims, setTokenClaims] = useState<Record<string, any> | null>(null);
  const [loading, setLoading] = useState(true);

  // Authentication Modal & Feedback State
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authModalMode, setAuthModalMode] = useState<'login' | 'signup'>('login');
  const [authError, setAuthError] = useState<string | null>(null);

  const openAuthModal = (mode: 'login' | 'signup' = 'login') => {
    setAuthModalMode(mode);
    setAuthError(null);
    setIsAuthModalOpen(true);
  };

  const closeAuthModal = () => {
    setIsAuthModalOpen(false);
  };

  const clearAuthError = () => {
    setAuthError(null);
  };

  // Helper to verify ID token claims and email authorization
  const evaluateAdminStatus = async (currentUser: User) => {
    let customClaimRoleAdmin = false;
    let claimsObj: Record<string, any> = {};

    try {
      // Force refresh of ID token to fetch latest custom claims if assigned
      const tokenResult: IdTokenResult = await currentUser.getIdTokenResult(true);
      claimsObj = tokenResult.claims;
      if (tokenResult.claims && tokenResult.claims.role === 'admin') {
        customClaimRoleAdmin = true;
      }
    } catch (e) {
      console.warn('Could not inspect token claims:', e);
    }

    const emailIsMaster = currentUser.email?.toLowerCase() === MASTER_ADMIN_EMAIL.toLowerCase();

    // Query server-authoritative endpoint /api/admin/me
    let serverIsAdmin = false;
    let serverIsMaster = false;
    let serverPerms: AdminPermission[] = [];

    try {
      const idToken = await currentUser.getIdToken();
      const resp = await fetch('/api/admin/me', {
        headers: { 'Authorization': `Bearer ${idToken}` }
      });
      if (resp.ok) {
        const data = await resp.json();
        if (data.success && data.admin) {
          serverIsAdmin = true;
          serverIsMaster = Boolean(data.admin.isMaster);
          serverPerms = Array.isArray(data.admin.permissions) ? data.admin.permissions : [];
        }
      }
    } catch (err) {
      console.warn('Could not query /api/admin/me:', err);
    }

    const authorized = serverIsAdmin || emailIsMaster || customClaimRoleAdmin;
    const finalIsMaster = serverIsMaster || emailIsMaster;
    const finalPerms = serverPerms.length > 0 
      ? serverPerms 
      : (finalIsMaster ? (Object.values(ADMIN_PERMISSIONS) as AdminPermission[]) : []);

    setIsAdmin(authorized);
    setIsMaster(finalIsMaster);
    setAdminPermissions(finalPerms);
    setHasCustomClaim(customClaimRoleAdmin);
    setTokenClaims(claimsObj);

    return { authorized, customClaimRoleAdmin, isMaster: finalIsMaster, permissions: finalPerms };
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      // CRITICAL: Immediately clear previous authorization state and set loading
      // so no intermediate render can ever inherit previous user's admin privileges
      setLoading(true);
      setIsAdmin(false);
      setIsMaster(false);
      setAdminPermissions([]);
      setHasCustomClaim(false);
      setTokenClaims(null);
      setProfile(null);
      setUser(currentUser);

      const transition = evaluateSessionTransition(currentUser ? currentUser.uid : null);

      if (transition.type === 'account_switch') {
        // Account Switch: Different user signed in than previous session -> wipe previous user session data
        purgeAllUserSessionData();
        commitActiveSessionUid(currentUser!.uid);
        setFreshAuthNavigationPending();
      } else if (transition.type === 'new_login') {
        // Fresh Login from unauthenticated state
        purgeAllUserSessionData();
        commitActiveSessionUid(currentUser!.uid);
        setFreshAuthNavigationPending();
      } else if (transition.type === 'logged_out') {
        // Logged out
        purgeAllUserSessionData();
        commitActiveSessionUid(null);
      } else {
        // same_session (page refresh by same authenticated user in same tab)
        commitActiveSessionUid(currentUser!.uid);
      }

      if (currentUser) {
        try {
          const { authorized } = await evaluateAdminStatus(currentUser);

          // Fetch or sync user profile in Firestore
          const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
          if (userDoc.exists()) {
            const data = userDoc.data();
            // Strict role guard: only verified admin accounts can hold role === 'admin'
            if (!authorized && data.role === 'admin') {
              // Strip forged admin role from unauthorized client
              await updateDoc(doc(db, 'users', currentUser.uid), { role: 'guest' });
              data.role = 'guest';
            } else if (authorized && data.role !== 'admin') {
              // Elevate verified admin account
              await updateDoc(doc(db, 'users', currentUser.uid), { role: 'admin' });
              data.role = 'admin';
            }
            setProfile(data);
          } else {
            const newProfile = {
              uid: currentUser.uid,
              email: currentUser.email,
              displayName: currentUser.displayName || (authorized ? 'MozBook Administrator' : 'Guest'),
              photoURL: currentUser.photoURL || null,
              role: authorized ? 'admin' : 'guest',
              createdAt: serverTimestamp(),
            };
            await setDoc(doc(db, 'users', currentUser.uid), newProfile);
            setProfile(newProfile);
          }

          // Non-admin account: flush any leftover admin audit cache
          if (!authorized) {
            try {
              localStorage.removeItem('mozbook_admin_audit_logs_cache');
            } catch {
              // ignore
            }
          }
        } catch (error) {
          console.error("Error fetching or syncing user profile:", error);
          setIsAdmin(false);
          setIsMaster(false);
          setAdminPermissions([]);
        }
      } else {
        setProfile(null);
        setIsAdmin(false);
        setIsMaster(false);
        setAdminPermissions([]);
        setHasCustomClaim(false);
        setTokenClaims(null);
        try {
          localStorage.removeItem('mozbook_admin_audit_logs_cache');
        } catch {
          // ignore
        }
      }
      setLoading(false);
    });

    // Process redirect sign-in result if returning from a redirect authentication flow
    getRedirectResult(auth)
      .then(async (credential) => {
        if (credential?.user) {
          purgeAllUserSessionData();
          commitActiveSessionUid(credential.user.uid);
          setFreshAuthNavigationPending();
          setIsAuthModalOpen(false);
        }
      })
      .catch((redirectErr: any) => {
        console.warn('Redirect sign-in inspection:', redirectErr);
        if (redirectErr?.code) {
          setAuthError(redirectErr.message || 'Redirect authentication failed');
        }
      });

    return () => unsubscribe();
  }, []);

  const loginWithRedirect = async () => {
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    setLoading(true);
    setAuthError(null);
    try {
      await signInWithRedirect(auth, provider);
    } catch (error: any) {
      setLoading(false);
      console.error("Redirect login error:", error);
      setAuthError(error?.message || 'Failed to initiate redirect sign-in');
      throw error;
    }
  };

  const login = async () => {
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    setLoading(true);
    setAuthError(null);
    setIsAdmin(false);
    setHasCustomClaim(false);
    setTokenClaims(null);
    setProfile(null);
    try {
      const userCredential = await signInWithPopup(auth, provider);
      const signedInUser = userCredential.user;

      if (signedInUser) {
        setIsAuthModalOpen(false);
        setAuthError(null);

        // Enforce platform-wide rule: purge prior session data, mark fresh auth
        purgeAllUserSessionData();
        commitActiveSessionUid(signedInUser.uid);
        setFreshAuthNavigationPending();

        // Evaluate admin status on fresh interactive credential
        const { authorized } = await evaluateAdminStatus(signedInUser);

        // Only log ADMIN_LOGIN after explicit successful Google popup sign-in
        // AND when the user is confirmed as an authorized administrator.
        if (authorized && signedInUser.email) {
          try {
            await adminService.logAdminAction(
              signedInUser.uid,
              signedInUser.email,
              'ADMIN_LOGIN',
              'AUTHENTICATION',
              'User',
              signedInUser.uid,
              { 
                provider: 'google.com', 
                authMethod: 'interactive_popup',
                role: 'admin'
              }
            );
          } catch (auditErr) {
            console.warn('Failed to record ADMIN_LOGIN audit event:', auditErr);
          }
        }
      }
    } catch (error: any) {
      setLoading(false);
      const errorCode = error?.code || '';
      const errorMsg = error?.message || '';
      console.error("Google login error:", error);

      let userMsg = errorMsg;
      if (errorCode === 'auth/unauthorized-domain') {
        userMsg = 'This domain (mozbookings.com) is not authorized in Firebase Console -> Authentication -> Settings -> Authorized Domains.';
      } else if (errorCode === 'auth/popup-blocked') {
        userMsg = 'Google Sign-in popup was blocked by your browser. Please allow popups or use redirect sign-in.';
      } else if (errorCode === 'auth/popup-closed-by-user') {
        userMsg = 'Sign-in cancelled: The Google popup window was closed.';
      }
      setAuthError(userMsg);
      throw error;
    }
  };

  const logout = async () => {
    setLoading(true);
    setIsAdmin(false);
    setIsMaster(false);
    setAdminPermissions([]);
    setHasCustomClaim(false);
    setTokenClaims(null);
    setProfile(null);
    setUser(null);
    setIsAuthModalOpen(false);
    setAuthError(null);
    
    // Platform-wide rule: purge all cached data and set transition
    purgeAllUserSessionData();
    commitActiveSessionUid(null);
    setFreshAuthNavigationPending();

    try {
      await signOut(auth);
    } catch (error) {
      console.error("Logout error:", error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const refreshAdminClaims = async (): Promise<boolean> => {
    if (!auth.currentUser) return false;
    const { authorized } = await evaluateAdminStatus(auth.currentUser);
    return authorized;
  };

  const hasPermission = (permission: AdminPermission): boolean => {
    if (!isAdmin) return false;
    if (isMaster) return true;
    return adminPermissions.includes(permission);
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      profile, 
      isAdmin, 
      isMaster,
      adminPermissions, 
      hasPermission, 
      hasCustomClaim, 
      tokenClaims, 
      loading, 
      login, 
      loginWithRedirect,
      logout, 
      refreshAdminClaims,
      isAuthModalOpen,
      authModalMode,
      openAuthModal,
      closeAuthModal,
      authError,
      clearAuthError
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
