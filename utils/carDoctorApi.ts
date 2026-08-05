/**
 * carDoctorApi.ts
 * Gemini Flash single-turn car troubleshooting + Firestore daily rate-limiting.
 *
 * SECURITY: API key is ONLY read from the EXPO_PUBLIC_GEMINI_API_KEY env var.
 * It is never hardcoded, logged, or stored anywhere.
 */

import { db } from '../services/firebase';
import firebase from '../services/firebase';

// ─── Constants ───────────────────────────────────────────────────────────────
export const DAILY_LIMIT = 5;

/** Returns today's date key in yyyy-mm-dd format (local time). */
export function getTodayKey(): string {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

// ─── Rate-limit helpers (Firebase compat API) ─────────────────────────────────

export interface UsageStatus {
  allowed: boolean;
  remaining: number;
  current: number;
}

/**
 * Reads the current usage for today and returns whether the user is allowed to
 * ask another question and how many uses remain.
 * Does NOT write anything to Firestore.
 */
export async function checkUsage(userId: string): Promise<UsageStatus> {
  const today = getTodayKey();
  const usageRef = db
    .collection('users')
    .doc(userId)
    .collection('carDoctorUsage')
    .doc(today);

  const snap = await usageRef.get();
  const current = snap.exists ? (snap.data()?.count ?? 0) : 0;
  const remaining = Math.max(0, DAILY_LIMIT - current);

  return {
    allowed: current < DAILY_LIMIT,
    remaining,
    current,
  };
}

/**
 * Increments the usage counter by 1.
 * ONLY call this after a successful AI response — never on errors.
 */
export async function incrementUsage(userId: string): Promise<void> {
  const today = getTodayKey();
  const usageRef = db
    .collection('users')
    .doc(userId)
    .collection('carDoctorUsage')
    .doc(today);

  await usageRef.set(
    { count: firebase.firestore.FieldValue.increment(1) },
    { merge: true }
  );
}

// ─── Gemini Flash API call ────────────────────────────────────────────────────

const GEMINI_MODEL = 'gemini-2.5-flash';

/**
 * Sends a single-turn car troubleshooting prompt to Gemini Flash.
 * Returns the AI answer text.
 * Throws an Error if the network call fails or the response is malformed.
 *
 * @param userInput - The user's car problem description.
 */
export async function askCarDoctor(userInput: string): Promise<string> {
  const apiKey = process.env.EXPO_PUBLIC_GEMINI_API_KEY;

  const isPlaceholder = !apiKey || apiKey.trim() === '' || apiKey === 'your_gemini_api_key_here';
  const isValidFormat = apiKey ? apiKey.startsWith('AIza') : false;


  if (isPlaceholder) {
    console.error('[CarDoctor] ❌ API key is missing or placeholder — check .env and restart Expo server.');
    throw new Error('API key not configured.');
  }

  if (!isValidFormat) {
    console.warn('[CarDoctor] ⚠️ Warning: Gemini API key usually starts with "AIza". Your key starts with:', apiKey.substring(0, 4) + '...');
  }

  const prompt =
    `You are a helpful car troubleshooting assistant. A user describes this car problem: "${userInput}". ` +
    `Give 2-3 brief, general possible reasons in plain simple language. ` +
    `IMPORTANT FORMATTING RULES: ` +
    `Do NOT use markdown formatting like asterisks, bold, or headers. ` +
    `Do NOT use "**" anywhere in your response. ` +
    `Write in plain sentences only, using simple numbered points like "1. ... 2. ... 3. ..." if listing multiple reasons. ` +
    `Keep your answer under 80 words total. ` +
    `Always end with this exact sentence on its own line: "This is general guidance only — please consult a qualified mechanic for an actual diagnosis."`;

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      // Surface the exact API error message (quota exceeded, bad key, wrong model, etc.)
      const apiError = data?.error?.message ?? JSON.stringify(data);
      console.error(`[CarDoctor] ❌ API error ${response.status}:`, apiError);
      throw new Error(`API error ${response.status}: ${apiError}`);
    }

    const text: string | undefined =
      data?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!text) {
      console.error('[CarDoctor] ❌ Candidates array or text field missing in response:', JSON.stringify(data));
      throw new Error('Empty response from AI.');
    }

    console.log('[CarDoctor] ✅ Answer received successfully.');
    return text;

  } catch (error: any) {
    // Re-log with full detail so Metro console shows the real root cause
    console.error('[CarDoctor] ❌ Caught error in askCarDoctor:', error?.message ?? error);
    throw error; // re-throw so the modal's catch block still shows the friendly UI message
  }
}
