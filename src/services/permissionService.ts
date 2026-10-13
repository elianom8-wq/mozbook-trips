/**
 * Centralized Permission Management Service for MozBook
 * Handles browser & device permissions (Camera, Location/GPS, and Contacts).
 * Ensures a one-off solicitation experience so users aren't bothered again once granted.
 * Provides clear purpose explanations before requesting permissions and instructions on how to manage/change permissions in phone settings.
 */

export type PermissionType = 'camera' | 'location' | 'contacts';
export type PermissionState = 'granted' | 'denied' | 'prompt';

const STORAGE_KEY_PREFIX = 'mozbook_perm_';

export interface DeviceSettingGuide {
  os: 'iOS' | 'Android' | 'Desktop';
  title: string;
  steps: string[];
}

export interface ContactInfo {
  name?: string;
  email?: string;
  tel?: string;
}

export const PHONE_SETTINGS_GUIDES: Record<PermissionType, DeviceSettingGuide[]> = {
  camera: [
    {
      os: 'iOS',
      title: 'iPhone / iPad (Safari & Chrome)',
      steps: [
        'Open your iPhone "Settings" app.',
        'Scroll down and tap "Safari" (or "Chrome").',
        'Under "Settings for Websites", tap "Camera".',
        'Select "Allow" (or "Ask" to prompt again).',
        'Return to MozBook and reload the page.',
      ],
    },
    {
      os: 'Android',
      title: 'Android (Chrome & Samsung Internet)',
      steps: [
        'In your browser, tap the lock or three-dots menu (⋮) next to the web address.',
        'Tap "Site settings" (or "Permissions").',
        'Tap "Camera" and change the permission to "Allow".',
        'Return to MozBook and refresh.',
      ],
    },
    {
      os: 'Desktop',
      title: 'Computer (Chrome, Edge, Safari)',
      steps: [
        'Click the tune/padlock icon on the left side of the address bar.',
        'Find "Camera" and toggle the switch to "Allow".',
        'Refresh the page to apply.',
      ],
    },
  ],
  location: [
    {
      os: 'iOS',
      title: 'iPhone / iPad (Safari & Chrome)',
      steps: [
        'Open your iPhone "Settings" app.',
        'Scroll down and tap "Privacy & Security" > "Location Services".',
        'Ensure "Location Services" is ON.',
        'Tap "Safari Websites" and select "While Using the App".',
        'Return to MozBook and tap Detect Location.',
      ],
    },
    {
      os: 'Android',
      title: 'Android (Chrome & Samsung Internet)',
      steps: [
        'Swipe down from the top of your screen to ensure phone "Location" is turned ON.',
        'In your browser, tap the lock/sliders icon in the address bar.',
        'Tap "Permissions" > "Location" and select "Allow".',
        'Return to MozBook to auto-detect your location.',
      ],
    },
    {
      os: 'Desktop',
      title: 'Computer (Chrome, Edge, Safari)',
      steps: [
        'Click the site settings/lock icon in the browser address bar.',
        'Set "Location" to "Allow".',
        'Refresh the page.',
      ],
    },
  ],
  contacts: [
    {
      os: 'iOS',
      title: 'iPhone / iPad (Safari & Web)',
      steps: [
        'Apple iOS Safari does not currently support the Web Contact Picker API.',
        'MozBook automatically provides manual email and phone entry, or shareable trip links.',
        'No phone settings modification is required.',
      ],
    },
    {
      os: 'Android',
      title: 'Android (Google Chrome)',
      steps: [
        'The Web Contact Picker is supported natively in modern Chrome for Android.',
        'When you tap "Invite from Contacts", your device contact picker will open directly.',
        'Select the companion you wish to invite.',
        'Only the contact you choose is read—your address book is never stored or uploaded.',
      ],
    },
    {
      os: 'Desktop',
      title: 'Computer (Chrome, Safari, Edge)',
      steps: [
        'Desktop browsers do not expose a native phone contacts picker API.',
        'MozBook offers manual entry by typing an email or phone number.',
        'You can also copy the direct Travel Companion invitation link to send via email or chat.',
      ],
    },
  ],
};

/**
 * Standard MozBook Permission UX Explanations
 * Explains the relevant purpose before requesting device access.
 */
export const PERMISSION_PURPOSES: Record<
  PermissionType,
  {
    title: string;
    rationale: string;
    detail: string;
    deniedAdvice: string;
  }
> = {
  camera: {
    title: 'Allow MozBook to Access Camera?',
    rationale: 'Allow camera access to scan your ID / passport for verification or scan guest QR vouchers.',
    detail: 'MozBook uses your device camera for taking room photos, capturing host verification documents (B.I. or Passport), and scanning guest check-in QR codes. We never access your camera in the background.',
    deniedAdvice: 'Camera permission was denied. You can enable it anytime in phone settings, or upload an image file from your device.',
  },
  location: {
    title: 'Allow MozBook to Access Location?',
    rationale: 'Allow location access so MozBook can show what\'s around you and help you find nearby stays, activities and places.',
    detail: 'MozBook uses your device GPS to determine approximate position, calculate distances, and display nearby stays, restaurants, and tours. For hosts, it pinpoints property coordinates on the map.',
    deniedAdvice: 'Location access was denied. You can enable it in phone settings or manually search/select any Mozambique destination.',
  },
  contacts: {
    title: 'Allow MozBook to Access Contacts?',
    rationale: 'Allow contacts access to easily invite travel companions from your phone contacts.',
    detail: 'MozBook accesses your contacts solely when you choose to invite a companion. Only the contact you select is read (name and email or phone). MozBook never uploads or stores your full address book.',
    deniedAdvice: 'Contacts access was denied. You can still invite companions by manually entering their email, phone number, or sharing an invite link.',
  },
};

class PermissionManager {
  /**
   * Has the user already granted this permission in MozBook or browser?
   */
  isGranted(type: PermissionType): boolean {
    const saved = localStorage.getItem(`${STORAGE_KEY_PREFIX}${type}`);
    return saved === 'granted';
  }

  /**
   * Has the user already been solicited for this permission?
   * If true, we should not prompt the introductory rationale modal again.
   */
  hasBeenSolicited(type: PermissionType): boolean {
    const status = localStorage.getItem(`${STORAGE_KEY_PREFIX}${type}`);
    const solicited = localStorage.getItem(`${STORAGE_KEY_PREFIX}${type}_solicited`);
    return status === 'granted' || solicited === 'true';
  }

  setSolicited(type: PermissionType): void {
    localStorage.setItem(`${STORAGE_KEY_PREFIX}${type}_solicited`, 'true');
  }

  /**
   * Query native browser Permissions API if supported.
   */
  async queryNativeState(type: PermissionType): Promise<PermissionState> {
    if (type === 'contacts') {
      // The Web Contact Picker API does not expose a persistent browser permission state via navigator.permissions.
      return 'prompt';
    }

    try {
      if (typeof navigator !== 'undefined' && 'permissions' in navigator && navigator.permissions.query) {
        // Note: Safari does not support query({ name: 'camera' }) in older versions
        const permName = type === 'camera' ? ('camera' as PermissionName) : ('geolocation' as PermissionName);
        const result = await navigator.permissions.query({ name: permName });
        if (result.state === 'granted') {
          this.saveStatus(type, 'granted');
          return 'granted';
        } else if (result.state === 'denied') {
          this.saveStatus(type, 'denied');
          return 'denied';
        }
      }
    } catch {
      // Fallback gracefully if permissions.query throws for specific permission names
    }

    // Return stored status or default to 'prompt'
    const stored = localStorage.getItem(`${STORAGE_KEY_PREFIX}${type}`) as PermissionState | null;
    return stored || 'prompt';
  }

  saveStatus(type: PermissionType, state: PermissionState): void {
    localStorage.setItem(`${STORAGE_KEY_PREFIX}${type}`, state);
    localStorage.setItem(`${STORAGE_KEY_PREFIX}${type}_timestamp`, new Date().toISOString());
  }

  /**
   * Request Camera permission directly through getUserMedia.
   */
  async requestCamera(): Promise<{ success: boolean; error?: string }> {
    this.setSolicited('camera');
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      this.saveStatus('camera', 'denied');
      return {
        success: false,
        error: 'Camera hardware is not supported or not accessible in this browser environment.',
      };
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
        audio: false,
      });

      // Stop tracks immediately after granting
      stream.getTracks().forEach((track) => track.stop());
      this.saveStatus('camera', 'granted');
      return { success: true };
    } catch (err: any) {
      const isDenied = err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError';
      if (isDenied) {
        this.saveStatus('camera', 'denied');
      }
      return {
        success: false,
        error: isDenied
          ? 'Camera permission was denied. You can enable it anytime in your phone or browser settings.'
          : err.message || 'Unable to access camera.',
      };
    }
  }

  /**
   * Request Location permission directly through navigator.geolocation.
   */
  async requestLocation(): Promise<{
    success: boolean;
    coords?: { lat: number; lng: number };
    error?: string;
  }> {
    this.setSolicited('location');
    if (!navigator.geolocation) {
      this.saveStatus('location', 'denied');
      return {
        success: false,
        error: 'Geolocation is not supported by your browser.',
      };
    }

    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          this.saveStatus('location', 'granted');
          resolve({
            success: true,
            coords: {
              lat: parseFloat(pos.coords.latitude.toFixed(5)),
              lng: parseFloat(pos.coords.longitude.toFixed(5)),
            },
          });
        },
        (err) => {
          if (err.code === 1) {
            // PERMISSION_DENIED
            this.saveStatus('location', 'denied');
            resolve({
              success: false,
              error: 'Location access was denied. You can turn it on in your phone settings or search manually.',
            });
          } else {
            resolve({
              success: false,
              error: 'Could not acquire your current location coordinates. Please try again.',
            });
          }
        },
        { timeout: 10000, enableHighAccuracy: true }
      );
    });
  }

  /**
   * Check if native Web Contacts API is supported by the user's browser (e.g. Android Chrome).
   */
  isContactPickerSupported(): boolean {
    return (
      typeof window !== 'undefined' &&
      typeof navigator !== 'undefined' &&
      'contacts' in navigator &&
      ('ContactsManager' in window || typeof (navigator as any).contacts?.select === 'function')
    );
  }

  /**
   * Request Contacts picker on supported browsers to select a travel companion.
   * Only reads the contact(s) explicitly picked by the user.
   * Never uploads or reads the entire address book.
   */
  async requestContacts(options?: { multiple?: boolean }): Promise<{
    success: boolean;
    contacts?: ContactInfo[];
    nativeSupported: boolean;
    error?: string;
  }> {
    // If native Contact Picker is not supported
    if (!this.isContactPickerSupported()) {
      return {
        success: false,
        nativeSupported: false,
        error: "Contacts aren't supported on this device/browser.",
      };
    }

    try {
      const props = ['name', 'email', 'tel'];
      const contacts = await (navigator as any).contacts.select(props, {
        multiple: options?.multiple ?? false,
      });

      if (contacts && contacts.length > 0) {
        const formatted: ContactInfo[] = contacts.map((c: any) => ({
          name: Array.isArray(c.name) ? c.name[0] : (c.name || 'Travel Companion'),
          email: Array.isArray(c.email) ? c.email[0] : (c.email || ''),
          tel: Array.isArray(c.tel) ? c.tel[0] : (c.tel || ''),
        }));
        return {
          success: true,
          contacts: formatted,
          nativeSupported: true,
        };
      } else {
        // User closed/cancelled the picker without selecting
        return {
          success: false,
          nativeSupported: true,
          error: 'No contact selected. You can try again or enter details manually.',
        };
      }
    } catch (err: any) {
      const isDenied = err.name === 'NotAllowedError' || err.name === 'SecurityError';
      return {
        success: false,
        nativeSupported: true,
        error: isDenied
          ? 'Contacts permission was denied or cancelled in the browser.'
          : err.message || 'Unable to open contact picker.',
      };
    }
  }

  /**
   * Reset local storage permission state (allows user to re-experience the one-off prompt flow)
   */
  reset(type: PermissionType): void {
    localStorage.removeItem(`${STORAGE_KEY_PREFIX}${type}`);
    localStorage.removeItem(`${STORAGE_KEY_PREFIX}${type}_solicited`);
    localStorage.removeItem(`${STORAGE_KEY_PREFIX}${type}_timestamp`);
  }
}

export const permissionService = new PermissionManager();
