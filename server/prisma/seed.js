import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const passwordHash = await bcrypt.hash('Demo@1234', 10);

const users = [
  ['Platform Admin', 'admin@sunpower.in', '9000000001', 'SUPER_ADMIN'],
  ['Aarav Mehta', 'director@sunpower.in', '9000000002', 'DIRECTOR'],
  ['Riya Shah', 'sales@sunpower.in', '9000000003', 'SALES_EXECUTIVE'],
  ['Kiran Rao', 'survey@sunpower.in', '9000000004', 'SURVEY_TECHNICIAN'],
  ['Neeraj Kapoor', 'warehouse@sunpower.in', '9000000005', 'WAREHOUSE_MANAGER'],
  ['Vikram Singh', 'installation@sunpower.in', '9000000006', 'INSTALLATION_TECHNICIAN'],
  ['Maya Iyer', 'support@sunpower.in', '9000000007', 'SUPPORT_EXECUTIVE'],
];

for (const [name, email, phone, role] of users) {
  await prisma.user.upsert({
    where: { email },
    update: { name, phone, role, passwordHash, isActive: true },
    create: { name, email, phone, role, passwordHash },
  });
}

const products = [
  ['SP-PANEL-550', '550W Mono Solar Panel', 'PANEL', 'PCS', true, 12000, 17500, 120],
  ['SP-INV-3K', '3 kW On-Grid Inverter', 'INVERTER', 'PCS', true, 58000, 82000, 60],
  ['SP-INV-5K', '5 kW On-Grid Inverter', 'INVERTER', 'PCS', true, 82000, 112000, 60],
  ['SP-BAT-5K', '5 kWh Lithium Battery', 'BATTERY', 'PCS', true, 105000, 145000, 60],
  ['SP-MOUNT-SET', 'Aluminium Mounting Structure', 'MOUNTING_STRUCTURE', 'SET', false, 18000, 28000, 10],
  ['SP-DC-BOX', 'DC Protection Box', 'DC_BOX', 'PCS', false, 4500, 7500, 10],
  ['SP-AC-BOX', 'AC Protection Box', 'AC_BOX', 'PCS', false, 4500, 7500, 10],
  ['SP-CABLE', 'Solar Cable', 'CABLE', 'METER', false, 90, 150, 100],
  ['SP-EARTH', 'Earthing and Lightning Kit', 'EARTHING', 'SET', false, 8500, 14000, 10],
];

const productRows = {};
for (const [sku, name, category, unit, isSerialized, costPrice, sellPrice, warrantyMonths] of products) {
  productRows[sku] = await prisma.product.upsert({
    where: { sku },
    update: { name, category, unit, isSerialized, costPrice, sellPrice, warrantyMonths, taxPercent: 13.8 },
    create: { sku, name, category, unit, isSerialized, costPrice, sellPrice, warrantyMonths, taxPercent: 13.8 },
  });
}

const kitDefinitions = [
  ['On-Grid 1 kW', 'ON_GRID', 1, [['SP-PANEL-550', 2], ['SP-INV-3K', 1], ['SP-MOUNT-SET', 1], ['SP-DC-BOX', 1], ['SP-AC-BOX', 1], ['SP-CABLE', 30], ['SP-EARTH', 1]]],
  ['On-Grid 3 kW', 'ON_GRID', 3, [['SP-PANEL-550', 6], ['SP-INV-3K', 1], ['SP-MOUNT-SET', 1], ['SP-DC-BOX', 1], ['SP-AC-BOX', 1], ['SP-CABLE', 60], ['SP-EARTH', 1]]],
  ['On-Grid 5 kW', 'ON_GRID', 5, [['SP-PANEL-550', 10], ['SP-INV-5K', 1], ['SP-MOUNT-SET', 1], ['SP-DC-BOX', 1], ['SP-AC-BOX', 1], ['SP-CABLE', 80], ['SP-EARTH', 1]]],
  ['Off-Grid 3 kW', 'OFF_GRID', 3, [['SP-PANEL-550', 6], ['SP-INV-3K', 1], ['SP-BAT-5K', 1], ['SP-MOUNT-SET', 1], ['SP-DC-BOX', 1], ['SP-CABLE', 60], ['SP-EARTH', 1]]],
  ['Off-Grid 5 kW', 'OFF_GRID', 5, [['SP-PANEL-550', 10], ['SP-INV-5K', 1], ['SP-BAT-5K', 2], ['SP-MOUNT-SET', 1], ['SP-DC-BOX', 1], ['SP-CABLE', 80], ['SP-EARTH', 1]]],
];

for (const [name, systemType, capacityKw, items] of kitDefinitions) {
  const existing = await prisma.kitTemplate.findFirst({ where: { name } });
  const kit = existing
    ? await prisma.kitTemplate.update({
        where: { id: existing.id },
        data: { systemType, capacityKw, isActive: true },
      })
    : await prisma.kitTemplate.create({
        data: {
          name,
          systemType,
          capacityKw,
          description: `${capacityKw} kW ${systemType.replace('_', '-').toLowerCase()} solar package`,
        },
      });
  for (const [sku, quantity] of items) {
    const product = productRows[sku];
    await prisma.kitTemplateItem.upsert({
      where: { kitTemplateId_productId: { kitTemplateId: kit.id, productId: product.id } },
      update: { quantity },
      create: { kitTemplateId: kit.id, productId: product.id, quantity },
    });
  }
}

const settings = {
  advancePercent: 30,
  defaultTaxPercent: 13.8,
  labourRatePerHour: 350,
  serviceVisitCharge: 500,
  quoteValidityDays: 15,
  company: {
    name: 'SunPower Solutions',
    phone: '+91 40 2355 7788',
    email: 'hello@sunpower.in',
    address: 'Plot 42, Road No. 12, Banjara Hills, Hyderabad, Telangana 500034',
  },
};
for (const [key, value] of Object.entries(settings)) {
  await prisma.setting.upsert({ where: { key }, update: { value }, create: { key, value } });
}

console.log('Seed complete. Demo staff password: Demo@1234');
await prisma.$disconnect();
