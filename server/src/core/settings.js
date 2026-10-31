import { prisma } from './prisma.js';

export const DEFAULT_SETTINGS = {
  company: {
    name: 'SunPower Solutions',
    gstin: '36AABCS1429P1ZK',
    address: 'Plot 42, Road No. 12, Banjara Hills, Hyderabad, Telangana 500034',
    phone: '+91 40 2355 7788',
    email: 'hello@sunpower.in',
  },
  advancePercent: 30,
  defaultTaxPercent: 13.8,
  labourRatePerHour: 350,
  serviceVisitCharge: 500,
  quoteValidityDays: 15,
  surveySlaHours: 48,
  warrantyExpiryAlertDays: 30,
};

/** Returns every setting as a single object, filling defaults for missing keys. */
export async function getSettings() {
  const rows = await prisma.setting.findMany();
  const map = { ...DEFAULT_SETTINGS };
  for (const row of rows) map[row.key] = row.value;
  return map;
}

export async function getSetting(key) {
  const row = await prisma.setting.findUnique({ where: { key } });
  return row ? row.value : DEFAULT_SETTINGS[key];
}
