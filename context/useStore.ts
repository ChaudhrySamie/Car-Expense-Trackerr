import { create } from 'zustand';

export interface User {
  uid: string;
  name?: string;
  email: string | null;
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
}

interface AppState {
  user: User | null;
  setUser: (user: User | null) => void;
  cars: Car[];
  setCars: (cars: Car[]) => void;
  selectedCar: Car | null;
  setSelectedCar: (car: Car | null) => void;
  clearState: () => void;
}

export const useStore = create<AppState>((set) => ({
  user: null,
  setUser: (user) => set({ user }),
  cars: [],
  setCars: (cars) => set({ cars }),
  selectedCar: null,
  setSelectedCar: (car) => set({ selectedCar: car }),
  clearState: () => set({ user: null, cars: [], selectedCar: null }),
}));
