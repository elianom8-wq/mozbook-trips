import React, { createContext, useContext, useEffect, useState } from 'react';
import { 
  onAuthStateChanged, 
  User, 
  signInWithPopup, 
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

export const ADMIN_EMAIL = 'mozbookinfo@gmail.com';

interface AuthContextType {
  user: User | null;
  profile: any | null;
  isAdmin: boolean;
  hasCustomClaim: boolean;
  tokenClaims: Record<string, any> | null;
  loading: boolean;
  login: () => Promise<void>;
  logout: () => Promise<void>;
  refreshAdminClaims: () => Promise<boolean>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<any | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [hasCustomClaim, setHasCustomClaim] = useState(false);
  const [tokenClaims, setTokenClaims] = useState<Record<string, any> | null>(null);
  const [loading, setLoading] = useState(true);

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

    const emailIsAdmin = currentUser.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase();
    const authorized = customClaimRoleAdmin || emailIsAdmin;

    setIsAdmin(authorized);
    setHasCustomClaim(customClaimRoleAdmin);
    setTokenClaims(claimsObj);

    return { authorized, customClaimRoleAdmin };
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      // CRITICAL: Immediately clear previous authorization state and set loading
      // so no intermediate render can ever inherit previous user's admin privileges
      setLoading(true);
      setIsAdmin(false);
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
        }
      } else {
        setProfile(null);
        setIsAdmin(false);
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

    return () => unsubscribe();
  }, []);

  const login = async () => {
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    setLoading(true);
    setIsAdmin(false);
    setHasCustomClaim(false);
    setTokenClaims(null);
    setProfile(null);
    try {
      const userCredential = await signInWithPopup(auth, provider);
      const signedInUser = userCredential.user;

      if (signedInUser) {
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
    } catch (error) {
      setLoading(false);
      console.error("Google login error:", error);
      throw error;
    }
  };

  const logout = async () => {
    setLoading(true);
    setIsAdmin(false);
    setHasCustomClaim(false);
    setTokenClaims(null);
    setProfile(null);
    setUser(null);
    
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

  return (
    <AuthContext.Provider value={{ 
      user, 
      profile, 
      isAdmin, 
      hasCustomClaim,
      tokenClaims,
      loading, 
      login, 
      logout,
      refreshAdminClaims
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
