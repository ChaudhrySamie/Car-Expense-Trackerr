import { db } from '../services/firebase';
import firebase from 'firebase/compat/app';

export interface MonthlySummary {
  summaryText: string;
  generatedAt: Date | any;
}

// Internal helper that performs data aggregation, API call, and caching
async function generateAndSaveSummary(
  userId: string,
  vehicleId: string,
  vehicleName: string,
  expenses: any[],
  currency: string,
  language: string,
  fallbackTemplate: (currency: string, totalSpent: string, moreOrLess: string) => string,
  moreText: string,
  lessText: string,
  docRef: any
): Promise<MonthlySummary | null> {
  try {
    const now = new Date();
    // 2. Data Aggregation
    const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const previousMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    
    let totalSpent = 0;
    let previousMonthSpent = 0;
    let fuelSpent = 0;
    let overduePayments = 0;
    
    let totalLiters = 0;
    let totalDistance = 0;
    let minOdometer = Infinity;
    let maxOdometer = 0;

    let hasOilChangeThisMonth = false;

    expenses.forEach(exp => {
      if (!exp.date || !exp.amount) return;
      const expDate = new Date(exp.date);
      
      // Current Month
      if (expDate >= currentMonthStart) {
        totalSpent += Number(exp.amount);
        
        if (exp.category === 'Fuel') {
          fuelSpent += Number(exp.amount);
          if (exp.liters) totalLiters += Number(exp.liters);
          if (exp.odometer) {
            minOdometer = Math.min(minOdometer, Number(exp.odometer));
            maxOdometer = Math.max(maxOdometer, Number(exp.odometer));
          }
        }
        
        if (exp.category === 'Finance' && exp.status === 'Overdue') { // Approximation for overdue
           overduePayments++;
        }
        
        if (exp.category === 'OilChange') {
           hasOilChangeThisMonth = true;
        }
      } 
      // Previous Month
      else if (expDate >= previousMonthStart && expDate < currentMonthStart) {
        previousMonthSpent += Number(exp.amount);
      }
    });

    let avgMileage = 0;
    if (totalLiters > 0 && maxOdometer > minOdometer) {
      avgMileage = (maxOdometer - minOdometer) / totalLiters;
    }

    const summaryInput = {
      vehicleName,
      month: now.toLocaleString('default', { month: 'long', year: 'numeric' }),
      totalSpent,
      previousMonthSpent,
      fuelSpent,
      avgMileage: Number(avgMileage.toFixed(2)),
      overduePayments,
      oilChangeStatus: hasOilChangeThisMonth ? "completed this month" : "on schedule" // basic heuristic
    };

    const apiKey = process.env.EXPO_PUBLIC_GEMINI_API_KEY;
    
    if (!apiKey) {
        throw new Error('Gemini API key is missing');
    }

    // 3. Call Gemini
    const prompt = `You are a friendly car-expense assistant. Using this data: ${JSON.stringify(summaryInput)}, write a warm, 3-sentence summary of the user's spending this month in ${language} language. Mention one positive thing and one area to watch. Keep it under 60 words.`;

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }]
      })
    });

    if (!response.ok) {
      if (response.status === 429) {
        console.warn('Gemini API: Rate limit or daily quota reached (429). Showing fallback summary.');
        throw new Error('QUOTA_EXCEEDED');
      } else if (response.status === 503) {
        console.warn('Gemini API: Service temporarily unavailable (503).');
        throw new Error('SERVICE_UNAVAILABLE');
      } else {
        throw new Error(`API call failed with status: ${response.status}`);
      }
    }

    const data = await response.json();
    const summaryText = data.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!summaryText) {
        throw new Error('No summary text returned from API');
    }

    // 4. Save to Cache
    await docRef.set({
      summaryText: summaryText.trim(),
      generatedAt: firebase.firestore.FieldValue.serverTimestamp()
    });

    return {
      summaryText: summaryText.trim(),
      generatedAt: new Date()
    };

  } catch (error) {
    console.error('Error generating monthly AI summary:', error);
    
    // 5. Fallback if API fails
    const now = new Date();
    const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const previousMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    
    let totalSpent = 0;
    let previousMonthSpent = 0;
    
    expenses.forEach(exp => {
      if (!exp.date || !exp.amount) return;
      const expDate = new Date(exp.date);
      if (expDate >= currentMonthStart) totalSpent += Number(exp.amount);
      else if (expDate >= previousMonthStart && expDate < currentMonthStart) previousMonthSpent += Number(exp.amount);
    });

    const moreOrLess = totalSpent > previousMonthSpent ? moreText : lessText;
    const fallbackText = fallbackTemplate(currency, totalSpent.toLocaleString(), moreOrLess);

    return {
      summaryText: fallbackText,
      generatedAt: new Date() // Don't cache it, so we return a temporary object
    };
  }
}

export const getOrGenerateMonthlySummary = async (
  userId: string,
  vehicleId: string,
  vehicleName: string,
  expenses: any[],
  currency: string,
  language: string,
  fallbackTemplate: (currency: string, totalSpent: string, moreOrLess: string) => string,
  moreText: string,
  lessText: string
): Promise<MonthlySummary | null> => {
  const now = new Date();
  const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  
  // 1. Check Cache
  const docRef = db
    .collection('users')
    .doc(userId)
    .collection('vehicles')
    .doc(vehicleId)
    .collection('monthlySummaries')
    .doc(currentMonthKey);

  try {
    const docSnap = await docRef.get();
    if (docSnap.exists) {
      const data = docSnap.data();
      return {
        summaryText: data?.summaryText,
        generatedAt: data?.generatedAt?.toDate ? data.generatedAt.toDate() : new Date(data?.generatedAt)
      };
    }
  } catch (error) {
    console.error('Error reading summary cache:', error);
  }

  return await generateAndSaveSummary(
    userId, vehicleId, vehicleName, expenses, currency, language, fallbackTemplate, moreText, lessText, docRef
  );
};

export const forceRegenerateMonthlySummary = async (
  userId: string,
  vehicleId: string,
  vehicleName: string,
  expenses: any[],
  currency: string,
  language: string,
  fallbackTemplate: (currency: string, totalSpent: string, moreOrLess: string) => string,
  moreText: string,
  lessText: string
): Promise<MonthlySummary | null> => {
  const now = new Date();
  const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  
  const docRef = db
    .collection('users')
    .doc(userId)
    .collection('vehicles')
    .doc(vehicleId)
    .collection('monthlySummaries')
    .doc(currentMonthKey);

  return await generateAndSaveSummary(
    userId, vehicleId, vehicleName, expenses, currency, language, fallbackTemplate, moreText, lessText, docRef
  );
};
