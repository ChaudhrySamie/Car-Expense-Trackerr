import { db, storage } from './firebase';
import firebase from 'firebase/compat/app';
import { useStore } from '../context/useStore';

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
  const { startDeleting, stopDeleting } = useStore.getState();
  startDeleting();
  try {
    // 1. Delete all expenses belonging to this car
    const expensesSnap = await db.collection(EXPENSES_COLLECTION).where('carId', '==', carId).get();
    if (!expensesSnap.empty) {
      const batch = db.batch();
      expensesSnap.docs.forEach((doc: any) => batch.delete(doc.ref));
      await batch.commit();
    }
    // 2. Delete the car document itself
    await db.collection(CARS_COLLECTION).doc(carId).delete();
  } catch (error) {
    console.error("Error deleting car: ", error);
    throw error;
  } finally {
    stopDeleting();
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
  brand?: string;
  viscosity?: string;
  filterBrand?: string;
  // Fuel specific
  liters?: number;
  pricePerLiter?: number;
  odometer?: number;
  isFullTank?: boolean;
  // Shared
  createdAt?: any;
}

const EXPENSES_COLLECTION = 'expenses';
export const MAX_EXPENSE_AMOUNT = 100_000_000;
export const MAX_FUEL_LITERS = 1_000;
export const MAX_FUEL_RATE_PER_LITER = 100_000;
export const MAX_ODOMETER_KM = 10_000_000;
export const MAX_OIL_BRAND_LENGTH = 50;
export const MAX_OIL_VISCOSITY_LENGTH = 20;

const validateExpenseAmount = (expenseData: any) => {
  const amount = Number(expenseData?.amount);
  if (!Number.isFinite(amount) || amount <= 0 || amount > MAX_EXPENSE_AMOUNT) {
    const error: any = new Error('Expense amount is outside the allowed range.');
    error.code = 'validation/amount-out-of-range';
    throw error;
  }
};

const validateOptionalNumber = (value: unknown, maximum: number, errorCode: string) => {
  if (value === undefined || value === null || value === '') return;
  const numberValue = Number(value);
  if (!Number.isFinite(numberValue) || numberValue < 0 || numberValue > maximum) {
    const error: any = new Error('A numeric value is outside the allowed range.');
    error.code = errorCode;
    throw error;
  }
};

const validateOptionalText = (value: unknown, maximumLength: number, errorCode: string) => {
  if (value === undefined || value === null) return;
  if (String(value).length > maximumLength) {
    const error: any = new Error('Text is longer than allowed.');
    error.code = errorCode;
    throw error;
  }
};

const validateExpenseDetails = (expenseData: any) => {
  validateExpenseAmount(expenseData);
  validateOptionalNumber(expenseData?.liters, MAX_FUEL_LITERS, 'validation/liters-out-of-range');
  validateOptionalNumber(expenseData?.pricePerLiter, MAX_FUEL_RATE_PER_LITER, 'validation/rate-out-of-range');
  validateOptionalNumber(expenseData?.odometer, MAX_ODOMETER_KM, 'validation/odometer-out-of-range');
  validateOptionalNumber(expenseData?.currentMileage, MAX_ODOMETER_KM, 'validation/odometer-out-of-range');
  validateOptionalText(expenseData?.brand, MAX_OIL_BRAND_LENGTH, 'validation/brand-too-long');
  validateOptionalText(expenseData?.viscosity, MAX_OIL_VISCOSITY_LENGTH, 'validation/viscosity-too-long');
};

export const addExpenseToDb = async (expenseData: any) => {
  try {
    validateExpenseDetails(expenseData);
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

export const updateExpenseInDb = async (expenseId: string, expenseData: any) => {
  try {
    validateExpenseDetails(expenseData);
    await db.collection(EXPENSES_COLLECTION).doc(expenseId).update({
      ...expenseData,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    return { id: expenseId, ...expenseData };
  } catch (error) {
    console.error("Error updating expense: ", error);
    throw error;
  }
};

export const deleteExpenseFromDb = async (expenseId: string) => {
  const { startDeleting, stopDeleting } = useStore.getState();
  startDeleting();
  try {
    await db.collection(EXPENSES_COLLECTION).doc(expenseId).delete();
  } catch (error) {
    console.error("Error deleting expense: ", error);
    throw error;
  } finally {
    stopDeleting();
  }
};

export const deleteExpensesByCategory = async (carId: string, category: string) => {
  const { startDeleting, stopDeleting } = useStore.getState();
  startDeleting();
  try {
    const querySnapshot = await db.collection(EXPENSES_COLLECTION)
      .where("carId", "==", carId)
      .where("category", "==", category)
      .get();
    
    const batch = db.batch();
    querySnapshot.forEach((doc: any) => {
      batch.delete(doc.ref);
    });
    
    await batch.commit();
  } catch (error) {
    console.error("Error deleting expenses by category: ", error);
    throw error;
  } finally {
    stopDeleting();
  }
};

// === User Activity ===
export const updateUserActivity = async (userId: string, activity: string) => {
  if (!userId) return;
  try {
    await db.collection('users').doc(userId).update({
      lastActivity: activity,
      lastActivityTime: firebase.firestore.FieldValue.serverTimestamp()
    });
  } catch (error) {
    console.error("Error updating user activity: ", error);
  }
};

// === End of File ===
