/**
 * vehicleHealthScore.ts
 * Pure, synchronous calculation — zero side effects, zero Firestore writes.
 * All inputs are derived from data already fetched elsewhere on the Dashboard.
 */

export interface HealthScoreInput {
  lastOilChangeOdometer: number | null;
  currentOdometer: number;
  oilChangeIntervalKm: number; // e.g. 5000
  documents: { name: string; expiryDate: string | null }[];
  financeIsActive: boolean;
  missedOrLateEmiCount: number;
  hasFuelLogs: boolean;
  hasExpenseLogs: boolean;
  hasServiceLogs: boolean;
  monthsWithActivityInLast3: number; // 0-3
}

export interface HealthScoreResult {
  score: number; // 0-100
  labelKey: 'healthScore.excellent' | 'healthScore.good' | 'healthScore.needs_attention' | 'healthScore.at_risk';
  color: 'green' | 'yellow' | 'orange' | 'red';
  topIssueKey: string | null;
  topIssueParams?: any;
}

export function calculateHealthScore(input: HealthScoreInput): HealthScoreResult {
  try {
    let score = 0;
    const issues: { points: number; maxPoints: number; key: string; params?: any }[] = [];

    // 1. Maintenance Health — 30 pts
    let maintenancePoints = 20; // neutral default if no oil data
    if (input.lastOilChangeOdometer !== null && input.oilChangeIntervalKm > 0) {
      const kmSinceOilChange = input.currentOdometer - input.lastOilChangeOdometer;
      const percentUsed = kmSinceOilChange / input.oilChangeIntervalKm;
      if (percentUsed < 0.8) {
        maintenancePoints = 30;
      } else if (percentUsed <= 1.0) {
        maintenancePoints = 18;
      } else {
        const overdueKm = kmSinceOilChange - input.oilChangeIntervalKm;
        maintenancePoints = Math.max(0, 15 - Math.floor(overdueKm / 100));
        issues.push({ points: maintenancePoints, maxPoints: 30, key: 'healthScore.oil_overdue' });
      }
    }
    score += maintenancePoints;

    // 2. Document Validity — 25 pts
    let documentPoints = 25;
    if (input.documents.length > 0) {
      const sharePerDoc = 25 / input.documents.length;
      documentPoints = 0;
      const now = new Date();
      input.documents.forEach(doc => {
        if (!doc.expiryDate) {
          documentPoints += sharePerDoc; // no expiry tracked, don't penalize
          return;
        }
        const expiry = new Date(doc.expiryDate);
        const daysLeft = (expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
        if (daysLeft > 30) {
          documentPoints += sharePerDoc;
        } else if (daysLeft > 0) {
          documentPoints += sharePerDoc * 0.5;
          issues.push({
            points: sharePerDoc * 0.5,
            maxPoints: sharePerDoc,
            key: 'healthScore.doc_expires',
            params: { name: doc.name, days: Math.ceil(daysLeft) }
          });
        } else {
          issues.push({ points: 0, maxPoints: sharePerDoc, key: 'healthScore.doc_expired', params: { name: doc.name } });
        }
      });
    }
    score += documentPoints;

    // 3. Financial Standing — 20 pts
    let financePoints = 20;
    if (input.financeIsActive) {
      if (input.missedOrLateEmiCount === 1) {
        financePoints = 10;
        issues.push({ points: 10, maxPoints: 20, key: 'healthScore.missed_payment' });
      } else if (input.missedOrLateEmiCount >= 2) {
        financePoints = 0;
        issues.push({ points: 0, maxPoints: 20, key: 'healthScore.multiple_missed' });
      }
    }
    score += financePoints;

    // 4. Record Completeness — 15 pts
    let recordPoints = 0;
    if (input.hasFuelLogs) recordPoints += 5;
    if (input.hasExpenseLogs) recordPoints += 5;
    if (input.hasServiceLogs) recordPoints += 5;
    score += recordPoints;

    // 5. Consistency Bonus — 10 pts
    const consistencyMap = [0, 3, 6, 10];
    const consistencyPoints = consistencyMap[Math.min(3, input.monthsWithActivityInLast3)] ?? 0;
    score += consistencyPoints;

    // Clamp score
    score = Math.max(0, Math.min(100, Math.round(score)));

    // Determine label/color
    let labelKey: HealthScoreResult['labelKey'];
    let color: HealthScoreResult['color'];
    if (score >= 85) { labelKey = 'healthScore.excellent'; color = 'green'; }
    else if (score >= 65) { labelKey = 'healthScore.good'; color = 'yellow'; }
    else if (score >= 40) { labelKey = 'healthScore.needs_attention'; color = 'orange'; }
    else { labelKey = 'healthScore.at_risk'; color = 'red'; }

    // Pick worst issue
    let topIssueKey = null;
    let topIssueParams = null;
    if (issues.length > 0) {
      const worstIssue = issues.sort((a, b) => (a.points / a.maxPoints) - (b.points / b.maxPoints))[0];
      topIssueKey = worstIssue.key;
      topIssueParams = worstIssue.params;
    }

    return { score, labelKey, color, topIssueKey, topIssueParams };

  } catch (error) {
    // Fail safe — never crash the Dashboard
    console.error('Health score calculation error:', error);
    return { score: 70, labelKey: 'healthScore.good', color: 'yellow', topIssueKey: null };
  }
}
