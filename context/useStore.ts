import { create } from 'zustand';

export interface User {
  uid: string;
  name?: string;
  email: string | null;
  maxVehicles?: number;
}

export interface Car {
  id: string;
  userId: string;
  name: string;
  model: string;
  year: string;
  regNumber: string;
  plate: string;
  engineCC: string;
  mileage: string;
  purchasePrice: string;
  imageUrl?: string;
  type?: 'car' | 'bike';
}

interface AppState {
  user: User | null;
  setUser: (user: User | null) => void;
  cars: Car[];
  setCars: (cars: Car[]) => void;
  selectedCar: Car | null;
  setSelectedCar: (car: Car | null) => void;
  language: string;
  setLanguage: (lang: string) => void;
  currency: string;
  setCurrency: (currency: string) => void;
  isDarkMode: boolean;
  toggleDarkMode: () => void;
  isDeleting: boolean;
  deletingMessage: string;
  activeDeleteCount: number;
  deleteStartedAt: number | null;
  deleteSession: number;
  startDeleting: (msg?: string) => void;
  stopDeleting: () => void;
  clearState: () => void;
}

const MIN_DELETE_LOADER_DURATION = 700;

export const useStore = create<AppState>((set, get) => ({
  user: null,
  setUser: (user) => set({ user }),
  cars: [],
  setCars: (cars) => set({ cars }),
  selectedCar: null,
  setSelectedCar: (car) => set({ selectedCar: car }),
  language: 'en',
  setLanguage: (language) => set({ language }),
  currency: 'PKR',
  setCurrency: (currency) => set({ currency }),
  isDarkMode: true,
  toggleDarkMode: () => set((state) => ({ isDarkMode: !state.isDarkMode })),
  isDeleting: false,
  deletingMessage: 'Deleting...',
  activeDeleteCount: 0,
  deleteStartedAt: null,
  deleteSession: 0,
  startDeleting: (deletingMessage = 'Deleting...') => set((state) => ({
    isDeleting: true,
    deletingMessage,
    activeDeleteCount: state.activeDeleteCount + 1,
    deleteStartedAt: Date.now(),
    deleteSession: state.deleteSession + 1,
  })),
  stopDeleting: () => {
    const { activeDeleteCount, deleteStartedAt, deleteSession } = get();
    const remainingDeletes = Math.max(0, activeDeleteCount - 1);

    if (remainingDeletes > 0) {
      set({ activeDeleteCount: remainingDeletes });
      return;
    }

    const remainingDisplayTime = Math.max(0, MIN_DELETE_LOADER_DURATION - (Date.now() - (deleteStartedAt || Date.now())));
    set({ activeDeleteCount: 0 });

    const hideLoader = () => {
      const currentState = get();
      if (currentState.activeDeleteCount === 0 && currentState.deleteSession === deleteSession) {
        set({ isDeleting: false, deleteStartedAt: null });
      }
    };

    if (remainingDisplayTime > 0) {
      setTimeout(hideLoader, remainingDisplayTime);
    } else {
      hideLoader();
    }
  },
  clearState: () => set({
    user: null,
    cars: [],
    selectedCar: null,
    language: 'en',
    currency: 'PKR',
    isDarkMode: true,
    isDeleting: false,
    activeDeleteCount: 0,
    deleteStartedAt: null,
    deleteSession: 0,
  }),
}));
