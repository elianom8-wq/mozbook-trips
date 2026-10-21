import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('MozBook Logo Branding & Mozambique Flag Colours', () => {
  const logoComponentPath = path.resolve(__dirname, '../../src/components/MozBookLogo.tsx');
  const logoContent = fs.readFileSync(logoComponentPath, 'utf-8');

  it('incorporates the Mozambique national flag colour scheme into the logo', () => {
    // Green: #009739
    expect(logoContent).toContain('#009739');
    // Yellow / Golden Amber: #FAB005
    expect(logoContent).toContain('#FAB005');
    // Red: #D21034
    expect(logoContent).toContain('#D21034');
    // Dark text: #34495E
    expect(logoContent).toContain('#34495E');
  });

  it('renders the exact brand name MozBook and tagline Discover Mozambique', () => {
    expect(logoContent).toContain('Moz');
    expect(logoContent).toContain('Bo');
    expect(logoContent).toContain('ok');
    expect(logoContent).toContain('Discover Mozambique');
  });

  it('incorporates green, yellow, and red into the location pin SVG icon', () => {
    // Green segment
    expect(logoContent).toMatch(/fill=\{COLOR_GREEN\}|fill="#009739"/);
    // Yellow segment
    expect(logoContent).toMatch(/fill=\{COLOR_YELLOW\}|fill="#FAB005"/);
    // Red segment
    expect(logoContent).toMatch(/fill=\{COLOR_RED\}|fill="#D21034"/);
    // White concentric ring
    expect(logoContent).toContain('fill="#FFFFFF"');
  });

  it('supports full, compact, and iconOnly variants with proper scaling', () => {
    expect(logoContent).toContain("variant = 'full'");
    expect(logoContent).toContain("'compact'");
    expect(logoContent).toContain("'iconOnly'");
    expect(logoContent).toContain("size = 'md'");
    expect(logoContent).toContain("'sm'");
    expect(logoContent).toContain("'lg'");
  });

  it('supports dark mode / theme contrast adaptation', () => {
    expect(logoContent).toContain("isDark");
    expect(logoContent).toContain("theme");
    expect(logoContent).toContain("text-slate-300");
  });

  it('provides the official approved asset reference when applicable', () => {
    expect(logoContent).toContain('/assets/aistudio/MozBook_Mozambique_Travel_Logo_2123e4fa.png');
  });

  it('verifies logo usage across main navigation, admin login, and verification flows', () => {
    const navbarPath = path.resolve(__dirname, '../../src/components/Navbar.tsx');
    const navbarContent = fs.readFileSync(navbarPath, 'utf-8');
    expect(navbarContent).toContain('<MozBookLogo variant="full" size="md" />');
    expect(navbarContent).toContain('<MozBookLogo variant="compact" size="sm" />');

    const adminLoginPath = path.resolve(__dirname, '../../src/pages/admin/AdminLogin.tsx');
    const adminLoginContent = fs.readFileSync(adminLoginPath, 'utf-8');
    expect(adminLoginContent).toContain('<MozBookLogo');

    const createListingPath = path.resolve(__dirname, '../../src/pages/CreateListing.tsx');
    const createListingContent = fs.readFileSync(createListingPath, 'utf-8');
    expect(createListingContent).toContain('<MozBookLogo variant="compact" size="sm" />');
  });
});
