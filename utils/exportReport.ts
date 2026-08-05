/**
 * exportReport.ts
 * Generates a complete vehicle history PDF (fuel, expenses, oil/service, finance)
 * and opens the native share sheet — no data is sent to any backend.
 *
 * Stack:
 *   expo-print       → HTML → PDF on-device
 *   expo-file-system → write PDF to documentDirectory
 *   expo-sharing     → open native share/save sheet
 */

import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { fetchExpensesByCar } from '../services/db';
import { Car } from '../context/useStore';

// ─── theme colours mirrored from utils/theme.ts (light palette) ──────────────
const C = {
  primary: '#0EA5E9',
  secondary: '#8B5CF6',
  success: '#10B981',
  warning: '#F59E0B',
  danger: '#EF4444',
  text: '#0F172A',
  textSecondary: '#64748B',
  border: '#E2E8F0',
  surface: '#FFFFFF',
  accentLight: '#E0F2FE',
  fuel: '#F97316',
  oil: '#10B981',
  finance: '#8B5CF6',
};

// ─── helpers ──────────────────────────────────────────────────────────────────

function fmt(n: number, currency: string): string {
  return `${currency} ${n.toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })}`;
}

function safeDate(raw: any): string {
  if (!raw) return '—';
  if (typeof raw === 'string') return raw;
  // Firestore Timestamp
  if (raw?.toDate) return raw.toDate().toISOString().split('T')[0];
  return String(raw);
}

function today(): string {
  return new Date().toISOString().split('T')[0];
}

// ─── HTML table helpers ───────────────────────────────────────────────────────

function thead(cols: string[]): string {
  return `<tr>${cols.map(c => `<th>${c}</th>`).join('')}</tr>`;
}

function trow(cells: (string | number | undefined | null)[]): string {
  return `<tr>${cells.map(c => `<td>${c ?? '—'}</td>`).join('')}</tr>`;
}

function emptyRow(cols: number, msg = 'No records found'): string {
  return `<tr><td colspan="${cols}" class="empty">${msg}</td></tr>`;
}

// ─── HTML template ────────────────────────────────────────────────────────────

function buildHtml(params: {
  car: Car;
  currency: string;
  exportDate: string;
  fuelLogs: any[];
  expenseLogs: any[];
  oilLogs: any[];
  financeSetup: any | null;
  financePayments: any[];
}): string {
  const {
    car, currency, exportDate,
    fuelLogs, expenseLogs, oilLogs,
    financeSetup, financePayments,
  } = params;

  // ── Summary totals ──────────────────────────────────────────────────────────
  const totalFuelCost = fuelLogs.reduce((s, e) => s + (e.amount || 0), 0);
  const totalExpenseCost = expenseLogs.reduce((s, e) => s + (e.amount || 0), 0);
  const totalServiceCost = oilLogs.reduce((s, e) => s + (e.amount || 0), 0);

  let totalFinancePaid = 0;
  let financeLabel = 'N/A';
  if (financeSetup) {
    try {
      const cfg = JSON.parse(financeSetup.purpose || '{}');
      const downPayment = cfg.downPayment || 0;
      const initialPaidMonths = cfg.initialPaidMonths || 0;
      const installment = cfg.installment || 0;
      const paymentsTotal = financePayments.reduce((s, e) => s + (e.amount || 0), 0);
      totalFinancePaid = downPayment + (initialPaidMonths * installment) + paymentsTotal;
      financeLabel = fmt(totalFinancePaid, currency);
    } catch {
      totalFinancePaid = financeSetup.amount || 0;
      financeLabel = fmt(totalFinancePaid, currency);
    }
  }

  const grandTotal = totalFuelCost + totalExpenseCost + totalServiceCost + totalFinancePaid;

  // ── Fuel rows ────────────────────────────────────────────────────────────────
  const fuelRows = fuelLogs.length
    ? fuelLogs
      .sort((a, b) => safeDate(b.date).localeCompare(safeDate(a.date)))
      .map(e => trow([
        safeDate(e.date),
        e.liters != null ? `${Number(e.liters).toFixed(2)} L` : '—',
        fmt(e.amount || 0, currency),
        e.odometer ? `${e.odometer} km` : '—',
        e.mileage ? `${Number(e.mileage).toFixed(1)} km/L` : '—',
      ])).join('')
    : emptyRow(5);

  // ── Expense rows ──────────────────────────────────────────────────────────
  const expenseRows = expenseLogs.length
    ? expenseLogs
      .sort((a, b) => safeDate(b.date).localeCompare(safeDate(a.date)))
      .map(e => trow([
        safeDate(e.date),
        e.category || '—',
        fmt(e.amount || 0, currency),
        e.purpose || e.workName || '—',
      ])).join('')
    : emptyRow(4);

  // ── Oil/Service rows ──────────────────────────────────────────────────────
  const oilRows = oilLogs.length
    ? oilLogs
      .sort((a, b) => safeDate(b.date).localeCompare(safeDate(a.date)))
      .map(e => trow([
        safeDate(e.date),
        e.oilType || e.brand || e.workName || 'Oil Change',
        fmt(e.amount || 0, currency),
        (e.odometer || e.currentMileage) ? `${e.odometer || e.currentMileage} km` : '—',
      ])).join('')
    : emptyRow(4);

  // ── Finance EMI rows ────────────────────────────────────────────────────────
  let financeRows = '';
  if (!financeSetup) {
    financeRows = emptyRow(4, 'No finance setup found for this vehicle');
  } else if (financePayments.length === 0) {
    financeRows = emptyRow(4, 'Finance setup exists but no payments recorded yet');
  } else {
    financeRows = financePayments
      .sort((a, b) => safeDate(b.date).localeCompare(safeDate(a.date)))
      .map(e => trow([
        safeDate(e.date),
        e.workName || e.payType || 'Monthly Installment',
        fmt(e.amount || 0, currency),
        '&#10003; Paid',
      ])).join('');
  }

  // ── Finance setup info box ───────────────────────────────────────────────────
  let financeInfoBox = '';
  if (financeSetup) {
    try {
      const cfg = JSON.parse(financeSetup.purpose || '{}');
      financeInfoBox = `
        <div class="finance-info">
          <span><strong>Total Price:</strong> ${fmt(cfg.totalPrice || 0, currency)}</span>
          <span><strong>Down Payment:</strong> ${fmt(cfg.downPayment || 0, currency)}</span>
          <span><strong>Monthly Installment:</strong> ${fmt(cfg.installment || 0, currency)}</span>
          <span><strong>Tenure:</strong> ${cfg.tenure || '?'} Months</span>
          <span><strong>Start Date:</strong> ${cfg.startDate || '—'}</span>
        </div>`;
    } catch { /* ignore */ }
  }

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${car.name} ${car.model} — Full Report</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, 'Segoe UI', Roboto, Arial, sans-serif;
      font-size: 13px;
      color: ${C.text};
      background: #ffffff;
      padding: 32px 28px;
    }

    /* Header */
    .report-header {
      background: linear-gradient(135deg, ${C.primary} 0%, ${C.secondary} 100%);
      color: #fff;
      border-radius: 16px;
      padding: 28px 32px;
      margin-bottom: 28px;
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
    }
    .app-name    { font-size: 22px; font-weight: 800; letter-spacing: 0.5px; margin-bottom: 4px; }
    .app-tagline { font-size: 12px; opacity: 0.85; }
    .vehicle-block { text-align: right; }
    .vehicle-name  { font-size: 18px; font-weight: 700; }
    .vehicle-meta  { font-size: 12px; opacity: 0.85; margin-top: 4px; }
    .export-date   { font-size: 11px; opacity: 0.75; margin-top: 6px; }

    /* Summary */
    .summary-grid {
      display: grid;
      grid-template-columns: repeat(5, 1fr);
      gap: 12px;
      margin-bottom: 28px;
    }
    .summary-card {
      background: ${C.surface};
      border: 1.5px solid ${C.border};
      border-radius: 12px;
      padding: 14px 12px;
      text-align: center;
    }
    .s-label {
      font-size: 10px; font-weight: 600;
      text-transform: uppercase; letter-spacing: 0.6px;
      color: ${C.textSecondary}; margin-bottom: 6px;
    }
    .s-value { font-size: 13px; font-weight: 800; color: ${C.primary}; word-break: break-all; }
    .summary-card.grand .s-value { color: ${C.secondary}; font-size: 14px; }

    /* Sections */
    .section { margin-bottom: 28px; page-break-inside: avoid; }
    .section-title {
      font-size: 14px; font-weight: 800; color: ${C.text};
      margin-bottom: 10px; padding-bottom: 6px;
      border-bottom: 2.5px solid ${C.primary};
    }
    .dot { width: 8px; height: 8px; border-radius: 50%; display: inline-block; margin-right: 6px; }

    /* Tables */
    table {
      width: 100%; border-collapse: collapse;
      background: ${C.surface}; border-radius: 10px;
      overflow: hidden; border: 1.5px solid ${C.border};
    }
    th {
      background: ${C.accentLight}; color: ${C.text};
      font-size: 10px; font-weight: 700;
      text-transform: uppercase; letter-spacing: 0.5px;
      padding: 10px 12px; text-align: left;
      border-bottom: 1.5px solid ${C.border};
    }
    td {
      padding: 9px 12px; font-size: 12px;
      color: ${C.text}; border-bottom: 1px solid ${C.border};
    }
    tr:last-child td { border-bottom: none; }
    tr:nth-child(even) td { background: #F8FAFC; }
    td.empty { text-align: center; color: ${C.textSecondary}; font-style: italic; padding: 20px; }

    /* Finance info box */
    .finance-info {
      display: flex; flex-wrap: wrap; gap: 10px;
      background: #F5F3FF; border: 1.5px solid #DDD6FE;
      border-radius: 10px; padding: 14px 16px;
      margin-bottom: 14px; font-size: 12px; color: ${C.text};
    }
    .finance-info span { flex: 1 1 45%; }

    /* Footer */
    .report-footer {
      margin-top: 36px;
      padding-top: 20px;
      border-top: 1.5px solid ${C.border};
      display: flex;
      justify-content: center;
      align-items: center;
      page-break-inside: avoid;
    }
    .footer-card {
      background: #F8FAFC;
      border: 1px solid ${C.border};
      border-radius: 12px;
      padding: 12px 24px;
      text-align: center;
      width: 100%;
    }
    .footer-row {
      font-size: 12px;
      color: ${C.textSecondary};
      font-weight: 500;
      margin-bottom: 4px;
    }
    .footer-brand {
      font-weight: 700;
      color: ${C.primary};
    }
    .footer-sep {
      margin: 0 8px;
      color: ${C.border};
    }
    .footer-email {
      font-size: 11px;
      color: ${C.textSecondary};
      opacity: 0.85;
    }
  </style>
</head>
<body>

  <!-- HEADER -->
  <div class="report-header">
    <div>
      <div class="app-name">&#9889; Mile Mint</div>
      <div class="app-tagline">Complete Vehicle Expense Report</div>
    </div>
    <div class="vehicle-block">
      <div class="vehicle-name">${car.name} ${car.model}</div>
      <div class="vehicle-meta">${car.year} &bull; ${car.plate}${car.engineCC ? ` &bull; ${car.engineCC} cc` : ''}</div>
      <div class="export-date">Generated: ${exportDate}</div>
    </div>
  </div>

  <!-- SUMMARY -->
  <div class="summary-grid">
    <div class="summary-card">
      <div class="s-label">Fuel</div>
      <div class="s-value">${fmt(totalFuelCost, currency)}</div>
    </div>
    <div class="summary-card">
      <div class="s-label">Expenses</div>
      <div class="s-value">${fmt(totalExpenseCost, currency)}</div>
    </div>
    <div class="summary-card">
      <div class="s-label">Service</div>
      <div class="s-value">${fmt(totalServiceCost, currency)}</div>
    </div>
    <div class="summary-card">
      <div class="s-label">Finance</div>
      <div class="s-value">${financeLabel}</div>
    </div>
    <div class="summary-card grand">
      <div class="s-label">Grand Total</div>
      <div class="s-value">${fmt(grandTotal, currency)}</div>
    </div>
  </div>

  <!-- FUEL LOGS -->
  <div class="section">
    <div class="section-title">
      <span class="dot" style="background:${C.fuel};"></span>
      Fuel Logs (${fuelLogs.length} records)
    </div>
    <table>
      ${thead(['Date', 'Liters', 'Cost', 'Odometer', 'Mileage'])}
      <tbody>${fuelRows}</tbody>
    </table>
  </div>

  <!-- EXPENSE LOGS -->
  <div class="section">
    <div class="section-title">
      <span class="dot" style="background:${C.danger};"></span>
      Expense Logs (${expenseLogs.length} records)
    </div>
    <table>
      ${thead(['Date', 'Category', 'Amount', 'Notes'])}
      <tbody>${expenseRows}</tbody>
    </table>
  </div>

  <!-- SERVICE / OIL LOGS -->
  <div class="section">
    <div class="section-title">
      <span class="dot" style="background:${C.oil};"></span>
      Service / Oil Change Logs (${oilLogs.length} records)
    </div>
    <table>
      ${thead(['Date', 'Type / Brand', 'Cost', 'Odometer'])}
      <tbody>${oilRows}</tbody>
    </table>
  </div>

  <!-- FINANCE / EMI -->
  <div class="section">
    <div class="section-title">
      <span class="dot" style="background:${C.secondary};"></span>
      Finance / EMI Records (${financePayments.length} payments)
    </div>
    ${financeInfoBox}
    <table>
      ${thead(['Date', 'Type', 'Amount', 'Status'])}
      <tbody>${financeRows}</tbody>
    </table>
  </div>

  <!-- FOOTER -->
  <div class="report-footer">
    <div class="footer-card">
      <div class="footer-row">
        <span>Generated by <strong class="footer-brand">Mile Mint</strong></span>
        <span class="footer-sep">&bull;</span>
        <span>⚡Developed by <strong class="footer-brand">Chaudhry Samie</strong></span>
      </div>
      <div class="footer-email">chaudhrysamie@gmail.com</div>
    </div>
  </div>

</body>
</html>`;
}

// ─── Main export function ─────────────────────────────────────────────────────

/**
 * Generates a full PDF report for the given vehicle, saves it locally,
 * and opens the native share/save sheet.
 * No data is uploaded to Firebase or any backend.
 */
export async function exportVehicleReport(car: Car, currency: string): Promise<void> {
  // 1. Fetch ALL expenses for this vehicle from Firestore
  const allExpenses = await fetchExpensesByCar(car.id);

  // 2. Partition by category
  const fuelLogs = allExpenses.filter(e => e.category === 'Fuel');
  const oilLogs = allExpenses.filter(e => e.category === 'OilChange');
  const financeAll = allExpenses.filter(e => e.category === 'Finance');
  const financeSetup = financeAll.find(e => e.workName === 'Finance_Setup') ?? null;
  const financePayments = financeAll.filter(e => e.workName !== 'Finance_Setup');
  const expenseLogs = allExpenses.filter(
    e => !['Fuel', 'OilChange', 'Finance'].includes(e.category)
  );

  const exportDate = today();

  // 3. Build HTML template
  const html = buildHtml({
    car, currency, exportDate,
    fuelLogs, expenseLogs, oilLogs,
    financeSetup, financePayments,
  });

  // 4. Render to PDF — happens fully on-device, no backend
  const { uri: pdfUri } = await Print.printToFileAsync({ html, base64: false });

  // 5. Build the display filename (used in share sheet title)
  const vehicleSlug = (car.name || 'Vehicle').replace(/\s+/g, '_');
  const fileName = `${vehicleSlug}_FullReport_${exportDate}.pdf`;

  // 6. Open native share sheet — user can Save to Files, email, WhatsApp, etc.
  //    expo-print already writes the file locally; we share directly from that URI.
  const canShare = await Sharing.isAvailableAsync();
  if (!canShare) {
    throw new Error('Sharing is not available on this device.');
  }
  await Sharing.shareAsync(pdfUri, {
    mimeType: 'application/pdf',
    dialogTitle: `Share ${fileName}`,
    UTI: 'com.adobe.pdf',
  });
}
