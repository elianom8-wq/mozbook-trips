import React, { createContext, useContext, useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

export interface SearchFilters {
  destination: string;
  checkIn: string;
  checkOut: string;
  datePreset?: string;
  adults: number;
  children: number;
  infants: number;
  pets: number;
}

const DEFAULT_FILTERS: SearchFilters = {
  destination: '',
  checkIn: '',
  checkOut: '',
  datePreset: '',
  adults: 0,
  children: 0,
  infants: 0,
  pets: 0,
};

interface SearchContextType {
  filters: SearchFilters;
  setFilters: React.Dispatch<React.SetStateAction<SearchFilters>>;
  updateFilters: (partial: Partial<SearchFilters>) => void;
  clearFilters: () => void;
  isSearchActive: boolean;
  totalGuests: number;
  searchModalOpen: boolean;
  setSearchModalOpen: (open: boolean) => void;
  activeTab: 'where' | 'when' | 'who';
  setActiveTab: (tab: 'where' | 'when' | 'who') => void;
  openSearchTab: (tab?: 'where' | 'when' | 'who') => void;
  executeSearch: () => void;
}

const SearchContext = createContext<SearchContextType | undefined>(undefined);

export function SearchProvider({ children }: { children: React.ReactNode }) {
  const [filters, setFilters] = useState<SearchFilters>(DEFAULT_FILTERS);
  const [searchModalOpen, setSearchModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'where' | 'when' | 'who'>('where');

  const navigate = useNavigate();
  const location = useLocation();

  // Parse URL query params on initial load
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const dest = params.get('destination') || '';
    const inDate = params.get('checkIn') || '';
    const outDate = params.get('checkOut') || '';
    const preset = params.get('datePreset') || '';
    const adults = parseInt(params.get('adults') || '0', 10);
    const childrenCount = parseInt(params.get('children') || '0', 10);
    const infants = parseInt(params.get('infants') || '0', 10);
    const pets = parseInt(params.get('pets') || '0', 10);

    if (dest || inDate || outDate || preset || adults > 0 || childrenCount > 0 || infants > 0 || pets > 0) {
      setFilters({
        destination: dest,
        checkIn: inDate,
        checkOut: outDate,
        datePreset: preset,
        adults: isNaN(adults) ? 0 : adults,
        children: isNaN(childrenCount) ? 0 : childrenCount,
        infants: isNaN(infants) ? 0 : infants,
        pets: isNaN(pets) ? 0 : pets,
      });
    }
  }, []);

  const updateFilters = (partial: Partial<SearchFilters>) => {
    setFilters((prev) => ({ ...prev, ...partial }));
  };

  const clearFilters = () => {
    setFilters(DEFAULT_FILTERS);
    if (location.pathname === '/') {
      navigate('/', { replace: true });
    }
  };

  const totalGuests = filters.adults + filters.children;

  const isSearchActive = Boolean(
    filters.destination.trim() ||
    filters.checkIn ||
    filters.checkOut ||
    filters.datePreset ||
    totalGuests > 0 ||
    filters.pets > 0
  );

  const openSearchTab = (tab: 'where' | 'when' | 'who' = 'where') => {
    setActiveTab(tab);
    setSearchModalOpen(true);
  };

  const executeSearch = () => {
    setSearchModalOpen(false);
    const params = new URLSearchParams();
    if (filters.destination.trim()) params.set('destination', filters.destination.trim());
    if (filters.checkIn) params.set('checkIn', filters.checkIn);
    if (filters.checkOut) params.set('checkOut', filters.checkOut);
    if (filters.datePreset) params.set('datePreset', filters.datePreset);
    if (filters.adults > 0) params.set('adults', filters.adults.toString());
    if (filters.children > 0) params.set('children', filters.children.toString());
    if (filters.infants > 0) params.set('infants', filters.infants.toString());
    if (filters.pets > 0) params.set('pets', filters.pets.toString());

    const queryString = params.toString();
    navigate(`/${queryString ? `?${queryString}` : ''}`);
  };

  return (
    <SearchContext.Provider
      value={{
        filters,
        setFilters,
        updateFilters,
        clearFilters,
        isSearchActive,
        totalGuests,
        searchModalOpen,
        setSearchModalOpen,
        activeTab,
        setActiveTab,
        openSearchTab,
        executeSearch,
      }}
    >
      {children}
    </SearchContext.Provider>
  );
}

export function useSearch() {
  const context = useContext(SearchContext);
  if (!context) {
    throw new Error('useSearch must be used within a SearchProvider');
  }
  return context;
}
