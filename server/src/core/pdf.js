import PDFDocument from 'pdfkit';
import { getSettings } from './settings.js';

export const INR = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 2,
});

export const money = (value) => INR.format(Number(value || 0));
export const dateText = (value) =>
  value ? new Date(value).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

export function startPdf(res, filename) {
  const doc = new PDFDocument({ size: 'A4', margin: 46 });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
  doc.pipe(res);
  return doc;
}

export function drawHeader(doc, company, title, meta = []) {
  doc.fillColor('#0F1B2D').font('Helvetica-Bold').fontSize(20).text(company.name || 'SunPower Solutions');
  doc.font('Helvetica').fontSize(9).fillColor('#6B7280');
  doc.text(company.address || '');
  doc.text(`${company.phone || ''}  ·  ${company.email || ''}  ·  GSTIN ${company.gstin || '—'}`);
  doc.moveDown(0.8);
  doc.moveTo(46, doc.y).lineTo(549, doc.y).strokeColor('#E7E2D8').stroke();
  doc.moveDown(1);
  doc.fillColor('#0F1B2D').font('Helvetica-Bold').fontSize(16).text(title);
  doc.moveDown(0.3);
  doc.font('Helvetica').fontSize(9).fillColor('#6B7280');
  for (const [label, value] of meta) doc.text(`${label}: ${value}`);
  doc.moveDown(1);
}

/**
 * Draws a simple table. columns = [{ label, width, align }]
 */
export function drawTable(doc, columns, rows, { startX = 46 } = {}) {
  const rowHeight = 22;
  let y = doc.y;
  const totalWidth = columns.reduce((s, c) => s + c.width, 0);
  const drawRow = (cells, bold = false) => {
    if (y > 760) {
      doc.addPage();
      y = 46;
    }
    let x = startX;
    doc.rect(x, y, totalWidth, rowHeight).fill(bold ? '#0F1B2D' : '#FFFFFF').stroke('#E7E2D8');
    columns.forEach((col, i) => {
      doc
        .fillColor(bold ? '#FFFFFF' : '#0F1B2D')
        .font(bold ? 'Helvetica-Bold' : 'Helvetica')
        .fontSize(8.5)
        .text(String(cells[i] ?? ''), x + 5, y + 7, {
          width: col.width - 10,
          align: col.align || 'left',
          lineBreak: false,
        });
      x += col.width;
    });
    y += rowHeight;
  };
  drawRow(columns.map((c) => c.label), true);
  rows.forEach((r) => drawRow(r));
  doc.y = y + 8;
  return y;
}

export function drawTotals(doc, lines) {
  doc.moveDown(0.5);
  lines.forEach(([label, value]) => {
    const y = doc.y;
    doc.font('Helvetica').fontSize(9.5).fillColor('#6B7280').text(label, 330, y, { width: 120, align: 'right' });
    doc.font('Helvetica-Bold').fontSize(9.5).fillColor('#0F1B2D').text(value, 455, y, { width: 94, align: 'right' });
  });
  doc.moveDown(0.8);
}

export function drawFooterNote(doc, text) {
  doc.font('Helvetica').fontSize(8).fillColor('#6B7280').text(text, 46, 780, { align: 'center', width: 500 });
}

/** Converts a number into Indian-system words, e.g. 150000 → One Lakh Fifty Thousand. */
export function amountInWords(amount) {
  const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten',
    'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
  const two = (n) => (n < 20 ? ones[n] : `${tens[Math.floor(n / 10)]}${n % 10 ? ` ${ones[n % 10]}` : ''}`);
  const three = (n) => {
    const h = Math.floor(n / 100);
    const rest = n % 100;
    return `${h ? `${ones[h]} Hundred${rest ? ' ' : ''}` : ''}${rest ? two(rest) : ''}`;
  };
  let n = Math.round(Number(amount) || 0);
  if (n === 0) return 'Zero Rupees Only';
  const parts = [];
  const crore = Math.floor(n / 10000000);
  n %= 10000000;
  const lakh = Math.floor(n / 100000);
  n %= 100000;
  const thousand = Math.floor(n / 1000);
  n %= 1000;
  if (crore) parts.push(`${three(crore)} Crore`);
  if (lakh) parts.push(`${three(lakh)} Lakh`);
  if (thousand) parts.push(`${three(thousand)} Thousand`);
  if (n) parts.push(three(n));
  return `${parts.join(' ')} Rupees Only`;
}
