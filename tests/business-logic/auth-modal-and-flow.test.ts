import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('MozBook Production Authentication & AuthModal Verification', () => {
  const navbarFilePath = path.resolve(__dirname, '../../src/components/Navbar.tsx');
  const navbarContent = fs.readFileSync(navbarFilePath, 'utf-8');

  const authContextFilePath = path.resolve(__dirname, '../../src/context/AuthContext.tsx');
  const authContextContent = fs.readFileSync(authContextFilePath, 'utf-8');

  const authModalFilePath = path.resolve(__dirname, '../../src/components/AuthModal.tsx');
  const authModalExists = fs.existsSync(authModalFilePath);
  const authModalContent = authModalExists ? fs.readFileSync(authModalFilePath, 'utf-8') : '';

  it('renders AuthModal in the Navbar DOM tree and connects openAuthModal triggers', () => {
    expect(authModalExists).toBe(true);
    expect(navbarContent).toContain("import AuthModal from './AuthModal'");
    expect(navbarContent).toContain('openAuthModal');
    expect(navbarContent).toContain("<AuthModal />");
    
    // Check Log in button opens modal
    expect(navbarContent).toMatch(/openAuthModal\(['"]login['"]\)/);
    // Check Sign up button opens modal
    expect(navbarContent).toMatch(/openAuthModal\(['"]signup['"]\)/);
  });

  it('AuthContext exposes modal states and redirect authentication fallback', () => {
    expect(authContextContent).toContain('isAuthModalOpen: boolean');
    expect(authContextContent).toContain("authModalMode: 'login' | 'signup'");
    expect(authContextContent).toContain("openAuthModal: (mode?: 'login' | 'signup') => void;");
    expect(authContextContent).toContain('closeAuthModal: () => void');
    expect(authContextContent).toContain('authError: string | null');
    expect(authContextContent).toContain('loginWithRedirect: () => Promise<void>');
    expect(authContextContent).toContain('signInWithRedirect');
    expect(authContextContent).toContain('getRedirectResult');
  });

  it('AuthContext detects unauthorized domain and popup blocking with clear diagnostics', () => {
    expect(authContextContent).toContain('auth/unauthorized-domain');
    expect(authContextContent).toContain('auth/popup-blocked');
    expect(authContextContent).toContain('mozbookings.com');
  });

  it('AuthModal provides Google authentication, mode switching, error diagnostics, and redirect fallback', () => {
    expect(authModalContent).toContain('Continue with Google');
    expect(authModalContent).toContain('Sign in with Redirect instead');
    expect(authModalContent).toContain('openAuthModal');
    expect(authModalContent).toContain('closeAuthModal');
    expect(authModalContent).toContain('authError');
  });
});
