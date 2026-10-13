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
import { db } from '../firebase';
import { TransportOffering } from '../types/transport';

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
  const now = new Date().toISOString();
  let newId = 'tr_' + Date.now();

  const payload: Omit<TransportOffering, 'id'> = {
    ...transportData,
    type: 'transport',
    currency: 'MZN',
    createdAt: now,
    updatedAt: now
  };

  try {
    const coll = collection(db, COLLECTION);
    const docRef = await addDoc(coll, {
      ...payload,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    newId = docRef.id;
  } catch (err) {
    console.warn('Firestore addDoc transport failed, fallback to local storage:', err);
  }

  const newOffering: TransportOffering = {
    id: newId,
    ...payload
  };

  const local = getLocalTransports();
  saveLocalTransports([newOffering, ...local.filter(t => t.id !== newId)]);

  return newOffering;
}

/**
 * Updates an existing Transport service.
 */
export async function updateTransportService(
  id: string,
  updates: Partial<TransportOffering>
): Promise<boolean> {
  const now = new Date().toISOString();

  try {
    const docRef = doc(db, COLLECTION, id);
    await updateDoc(docRef, {
      ...updates,
      updatedAt: serverTimestamp()
    });
  } catch (err) {
    console.warn('Firestore updateDoc transport failed, updating local storage:', err);
  }

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
