import { db, storage } from './firebase';
import firebase from 'firebase/compat/app';

// === Cars Collection ===
const CARS_COLLECTION = 'cars';

export const addCarToDb = async (carData: any) => {
  try {
    const docRef = await db.collection(CARS_COLLECTION).add({
      ...carData,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    return { id: docRef.id, ...carData };
  } catch (error) {
    console.error("Error adding car: ", error);
    throw error;
  }
};

export const fetchUserCars = async (userId: string) => {
  try {
    const querySnapshot = await db.collection(CARS_COLLECTION).where("userId", "==", userId).get();
    const cars: any[] = [];
    querySnapshot.forEach((doc: any) => {
      cars.push({ id: doc.id, ...doc.data() });
    });
    return cars;
  } catch (error) {
    console.error("Error fetching cars: ", error);
    throw error;
  }
};

export const subscribeToUserCars = (userId: string, callback: (cars: any[]) => void) => {
  return db.collection(CARS_COLLECTION)
    .where("userId", "==", userId)
    .onSnapshot((querySnapshot) => {
      const cars: any[] = [];
      querySnapshot.forEach((doc: any) => {
        cars.push({ id: doc.id, ...doc.data() });
      });
      callback(cars);
    }, (error) => {
      console.error("Error subscribing to cars: ", error);
    });
};

export const getCarById = async (carId: string) => {
  try {
    const doc = await db.collection(CARS_COLLECTION).doc(carId).get();
    if (doc.exists) {
      return { id: doc.id, ...doc.data() };
    }
    return null;
  } catch (error) {
    console.error("Error getting car: ", error);
    throw error;
  }
};

export const updateCarInDb = async (carId: string, carData: any) => {
  try {
    await db.collection(CARS_COLLECTION).doc(carId).update({
      ...carData,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    return { id: carId, ...carData };
  } catch (error) {
    console.error("Error updating car: ", error);
    throw error;
  }
};

export const deleteCarFromDb = async (carId: string) => {
  try {
    await db.collection(CARS_COLLECTION).doc(carId).delete();
  } catch (error) {
    console.error("Error deleting car: ", error);
    throw error;
  }
};

// === Expenses Collection ===
export interface Expense {
  id?: string;
  carId: string;
  category: string;
  date: string;
  amount: number;
  purpose?: string;
  workName?: string;
  // Oil specific
  oilType?: string;
  oilGrade?: string;
  company?: string;
  currentMileage?: string;
  // Shared
  createdAt?: any;
}

const EXPENSES_COLLECTION = 'expenses';

export const addExpenseToDb = async (expenseData: any) => {
  try {
    const docRef = await db.collection(EXPENSES_COLLECTION).add({
      ...expenseData,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    return { id: docRef.id, ...expenseData };
  } catch (error) {
    console.error("Error adding expense: ", error);
    throw error;
  }
};

export const fetchExpensesByCar = async (carId: string) => {
  try {
    const querySnapshot = await db.collection(EXPENSES_COLLECTION).where("carId", "==", carId).get();
    const expenses: any[] = [];
    querySnapshot.forEach((doc: any) => {
      expenses.push({ id: doc.id, ...doc.data() });
    });
    return expenses;
  } catch (error) {
    console.error("Error fetching expenses: ", error);
    throw error;
  }
};

export const fetchExpensesByCategory = async (carId: string, category: string) => {
  try {
    const querySnapshot = await db.collection(EXPENSES_COLLECTION)
      .where("carId", "==", carId)
      .where("category", "==", category)
      .get();
    const expenses: any[] = [];
    querySnapshot.forEach((doc: any) => {
      expenses.push({ id: doc.id, ...doc.data() });
    });
    return expenses;
  } catch (error) {
    console.error("Error fetching expenses by category: ", error);
    throw error;
  }
};

export const subscribeToExpensesByCar = (carId: string, callback: (expenses: any[]) => void) => {
  return db.collection(EXPENSES_COLLECTION)
    .where("carId", "==", carId)
    .onSnapshot((querySnapshot) => {
      const expenses: any[] = [];
      querySnapshot.forEach((doc: any) => {
        expenses.push({ id: doc.id, ...doc.data() });
      });
      callback(expenses);
    }, (error) => {
      console.error("Error subscribing to expenses: ", error);
    });
};

export const subscribeToExpensesByCategory = (carId: string, category: string, callback: (expenses: any[]) => void) => {
  return db.collection(EXPENSES_COLLECTION)
    .where("carId", "==", carId)
    .where("category", "==", category)
    .onSnapshot((querySnapshot) => {
      const expenses: any[] = [];
      querySnapshot.forEach((doc: any) => {
        expenses.push({ id: doc.id, ...doc.data() });
      });
      callback(expenses);
    }, (error) => {
      console.error("Error subscribing to expenses by category: ", error);
    });
};

// === End of File ===
