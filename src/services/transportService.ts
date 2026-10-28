import {
  collection,
  getDocs,
  getDoc,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  serverTimestamp,
  orderBy
} from 'firebase/firestore';
import { db, auth } from '../firebase';
import { TransportOffering } from '../types/transport';
import { checkHostVerificationStatus } from './listingService';

const COLLECTION = 'activities_trips';
const STORAGE_KEY_TRANSPORT = 'mozbook_transport_services';

function getLocalTransports(): TransportOffering[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_TRANSPORT);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveLocalTransports(items: TransportOffering[]) {
  try {
    localStorage.setItem(STORAGE_KEY_TRANSPORT, JSON.stringify(items));
  } catch (err) {
    console.warn('LocalStorage save failed for transport:', err);
  }
}

/**
 * Creates a new Transport service for the authenticated partner.
 * Stored in existing 'activities_trips' collection with type: 'transport'.
 */
export async function createTransportService(
  transportData: Omit<TransportOffering, 'id' | 'createdAt' | 'updatedAt'>
): Promise<TransportOffering> {
  const currentUser = auth.currentUser;
  if (!currentUser) {
    throw new Error('Authentication required: You must be logged in to create a transport service.');
  }

  const hostId = transportData.hostId || currentUser.uid;
  const verifStatus = await checkHostVerificationStatus(hostId);
  if (verifStatus.isSuspended) {
    throw new Error('Host account is suspended. Cannot create or publish transport services.');
  }

  let targetStatus = transportData.status || 'published';
  if (targetStatus !== 'draft') {
    targetStatus = verifStatus.isVerified ? (transportData.status || 'published') : 'pending';
  }

  const payload: Omit<TransportOffering, 'id'> = {
    ...transportData,
    hostId,
    status: targetStatus,
    type: 'transport',
    currency: 'MZN',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  const coll = collection(db, COLLECTION);
  const docRef = await addDoc(coll, {
    ...payload,
    isHostVerified: verifStatus.isVerified,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });

  const newOffering: TransportOffering = {
    id: docRef.id,
    ...payload
  };

  const local = getLocalTransports();
  saveLocalTransports([newOffering, ...local.filter(t => t.id !== docRef.id)]);

  return newOffering;
}

/**
 * Updates an existing Transport service.
 */
export async function updateTransportService(
  id: string,
  updates: Partial<TransportOffering>
): Promise<boolean> {
  if (!id) return false;
  if (id.startsWith('tr_')) {
    throw new Error('Cannot update unsynced local transport in Firestore.');
  }

  const docRef = doc(db, COLLECTION, id);
  await updateDoc(docRef, {
    ...updates,
    updatedAt: serverTimestamp()
  });

  const now = new Date().toISOString();
  const local = getLocalTransports();
  const idx = local.findIndex(t => t.id === id);
  if (idx >= 0) {
    local[idx] = { ...local[idx], ...updates, updatedAt: now };
    saveLocalTransports(local);
  }

  return true;
}

/**
 * Retrieves a single Transport service by its document ID.
 */
export async function getTransportServiceById(id: string): Promise<TransportOffering | null> {
  try {
    const docRef = doc(db, COLLECTION, id);
    const snap = await getDoc(docRef);
    if (snap.exists() && snap.data().type === 'transport') {
      return { id: snap.id, ...snap.data() } as TransportOffering;
    }
  } catch (err) {
    console.warn('Firestore getDoc transport failed:', err);
  }

  const local = getLocalTransports();
  return local.find(t => t.id === id) || null;
}

/**
 * Retrieves all Transport services owned by a specific Partner (hostId).
 */
export async function getHostTransportServices(hostId: string): Promise<TransportOffering[]> {
  if (!hostId) return [];

  try {
    const coll = collection(db, COLLECTION);
    const q = query(
      coll,
      where('hostId', '==', hostId),
      where('type', '==', 'transport')
    );
    const snap = await getDocs(q);
    if (!snap.empty) {
      const items: TransportOffering[] = [];
      snap.forEach(d => {
        items.push({ id: d.id, ...d.data() } as TransportOffering);
      });
      return items;
    }
  } catch (err) {
    console.warn('Firestore getHostTransportServices failed, using local cache:', err);
  }

  const local = getLocalTransports();
  return local.filter(t => t.hostId === hostId);
}

/**
 * Deletes a Transport service.
 */
export async function deleteTransportService(id: string): Promise<boolean> {
  try {
    const docRef = doc(db, COLLECTION, id);
    await deleteDoc(docRef);
  } catch (err) {
    console.warn('Firestore deleteDoc transport failed:', err);
  }

  const local = getLocalTransports();
  saveLocalTransports(local.filter(t => t.id !== id));
  return true;
}
