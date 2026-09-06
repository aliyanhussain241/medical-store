// ─────────────────────────────────────────────────────────────
// prisma/seed.js
// Demo seed data — fully fictional names, no real pharma brands
// Run: node prisma/seed.js
// ─────────────────────────────────────────────────────────────
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding demo data...\n');

  // ── 1. Create demo user ─────────────────────────────────────
  const passwordHash = await bcrypt.hash('Demo@12345', 12);
  const user = await prisma.user.upsert({
    where: { email: 'demo@medicalstore.app' },
    update: {},
    create: {
      businessName: 'Rahmat Medical Wholesale',
      ownerName: 'Muhammad Rahmat',
      email: 'demo@medicalstore.app',
      passwordHash,
      phone: '0300-1234567',
      address: 'Shop 12, Haider Market, Lahore',
      role: 'OWNER',
    },
  });
  console.log(`✅ User created: ${user.email}  (Password: Demo@12345)`);

  // ── 2. Companies (fictional distributors) ───────────────────
  const companies = await Promise.all([
    prisma.company.upsert({
      where: { id: 'comp-001' },
      update: {},
      create: {
        id: 'comp-001',
        userId: user.id,
        companyName: 'MediCore Distributors',
        contactPerson: 'Asif Raza',
        phone: '0321-9876543',
        address: 'Warehouse A, Ferozpur Road, Lahore',
        openingBalance: 15000,
        currentBalance: 15000,
      },
    }),
    prisma.company.upsert({
      where: { id: 'comp-002' },
      update: {},
      create: {
        id: 'comp-002',
        userId: user.id,
        companyName: 'HealPlus Pharma Wholesale',
        contactPerson: 'Tariq Mahmood',
        phone: '0333-5551234',
        address: '45-B, Main Gulberg, Lahore',
        openingBalance: 8500,
        currentBalance: 8500,
      },
    }),
    prisma.company.upsert({
      where: { id: 'comp-003' },
      update: {},
      create: {
        id: 'comp-003',
        userId: user.id,
        companyName: 'PharmaCrest Supplies',
        contactPerson: 'Naveed Khan',
        phone: '0311-7774321',
        address: 'Plot 7, Sundar Industrial Estate, Lahore',
        openingBalance: 22000,
        currentBalance: 22000,
      },
    }),
    prisma.company.upsert({
      where: { id: 'comp-004' },
      update: {},
      create: {
        id: 'comp-004',
        userId: user.id,
        companyName: 'AlphaMed Wholesale',
        contactPerson: 'Sajid Iqbal',
        phone: '0345-8889999',
        address: 'Johar Town, Lahore',
        openingBalance: 5000,
        currentBalance: 5000,
      },
    }),
  ]);
  console.log(`✅ ${companies.length} companies created`);

  // ── 3. Customers (fictional pharmacies) ─────────────────────
  const customers = await Promise.all([
    prisma.customer.upsert({
      where: { id: 'cust-001' },
      update: {},
      create: {
        id: 'cust-001',
        userId: user.id,
        customerName: 'Babar Ahmed',
        shopName: 'Al-Shifa Pharmacy',
        phone: '0300-1112233',
        address: 'Model Town, Lahore',
        openingBalance: 3500,
        currentBalance: 3500,
      },
    }),
    prisma.customer.upsert({
      where: { id: 'cust-002' },
      update: {},
      create: {
        id: 'cust-002',
        userId: user.id,
        customerName: 'Khalid Mehmood',
        shopName: 'Noor Medical Store',
        phone: '0311-4445566',
        address: 'Shadman Colony, Lahore',
        openingBalance: 7200,
        currentBalance: 7200,
      },
    }),
    prisma.customer.upsert({
      where: { id: 'cust-003' },
      update: {},
      create: {
        id: 'cust-003',
        userId: user.id,
        customerName: 'Imran Hussain',
        shopName: 'Sehat Pharma',
        phone: '0344-6667788',
        address: 'DHA Phase 5, Lahore',
        openingBalance: 0,
        currentBalance: 0,
      },
    }),
    prisma.customer.upsert({
      where: { id: 'cust-004' },
      update: {},
      create: {
        id: 'cust-004',
        userId: user.id,
        customerName: 'Anwar Saeed',
        shopName: 'Zindagi Chemist',
        phone: '0333-9990011',
        address: 'Township, Lahore',
        openingBalance: 1800,
        currentBalance: 1800,
      },
    }),
    prisma.customer.upsert({
      where: { id: 'cust-005' },
      update: {},
      create: {
        id: 'cust-005',
        userId: user.id,
        customerName: 'Shahzad Ali',
        shopName: 'HealthCare Dispensary',
        phone: '0321-2223344',
        address: 'Faisal Town, Lahore',
        openingBalance: 12000,
        currentBalance: 12000,
      },
    }),
  ]);
  console.log(`✅ ${customers.length} customers created`);

  // ── 4. Products (generic medicine names) ────────────────────
  const products = await Promise.all([
    prisma.product.upsert({
      where: { id: 'prod-001' },
      update: {},
      create: {
        id: 'prod-001',
        userId: user.id,
        productName: 'Paracetamol 500mg Tablets',
        category: 'Analgesic',
        unit: 'strip',
        batchNo: 'PCM-2024-A',
        expiryDate: new Date('2026-06-30'),
        purchasePrice: 18.00,
        salePrice: 25.00,
        stockQty: 500,
        minStockAlert: 50,
      },
    }),
    prisma.product.upsert({
      where: { id: 'prod-002' },
      update: {},
      create: {
        id: 'prod-002',
        userId: user.id,
        productName: 'Amoxicillin 250mg Capsules',
        category: 'Antibiotic',
        unit: 'strip',
        batchNo: 'AMX-2024-B',
        expiryDate: new Date('2026-12-31'),
        purchasePrice: 65.00,
        salePrice: 90.00,
        stockQty: 200,
        minStockAlert: 30,
      },
    }),
    prisma.product.upsert({
      where: { id: 'prod-003' },
      update: {},
      create: {
        id: 'prod-003',
        userId: user.id,
        productName: 'Ibuprofen 400mg Tablets',
        category: 'Anti-inflammatory',
        unit: 'strip',
        batchNo: 'IBU-2024-C',
        expiryDate: new Date('2025-09-30'),
        purchasePrice: 28.00,
        salePrice: 38.00,
        stockQty: 8,              // Low stock — below alert threshold
        minStockAlert: 20,
      },
    }),
    prisma.product.upsert({
      where: { id: 'prod-004' },
      update: {},
      create: {
        id: 'prod-004',
        userId: user.id,
        productName: 'Cetirizine 10mg Tablets',
        category: 'Antihistamine',
        unit: 'strip',
        batchNo: 'CTZ-2024-D',
        expiryDate: new Date('2027-03-31'),
        purchasePrice: 12.00,
        salePrice: 18.00,
        stockQty: 350,
        minStockAlert: 25,
      },
    }),
    prisma.product.upsert({
      where: { id: 'prod-005' },
      update: {},
      create: {
        id: 'prod-005',
        userId: user.id,
        productName: 'Metformin 500mg Tablets',
        category: 'Antidiabetic',
        unit: 'strip',
        batchNo: 'MET-2024-E',
        expiryDate: new Date('2026-09-30'),
        purchasePrice: 22.00,
        salePrice: 32.00,
        stockQty: 120,
        minStockAlert: 20,
      },
    }),
    prisma.product.upsert({
      where: { id: 'prod-006' },
      update: {},
      create: {
        id: 'prod-006',
        userId: user.id,
        productName: 'Omeprazole 20mg Capsules',
        category: 'Antacid / PPI',
        unit: 'strip',
        batchNo: 'OMP-2024-F',
        expiryDate: new Date('2026-06-30'),
        purchasePrice: 35.00,
        salePrice: 50.00,
        stockQty: 180,
        minStockAlert: 20,
      },
    }),
    prisma.product.upsert({
      where: { id: 'prod-007' },
      update: {},
      create: {
        id: 'prod-007',
        userId: user.id,
        productName: 'Multivitamin Syrup 120ml',
        category: 'Vitamin / Supplement',
        unit: 'bottle',
        batchNo: 'MV-2024-G',
        expiryDate: new Date('2025-12-31'),
        purchasePrice: 110.00,
        salePrice: 155.00,
        stockQty: 60,
        minStockAlert: 10,
      },
    }),
    prisma.product.upsert({
      where: { id: 'prod-008' },
      update: {},
      create: {
        id: 'prod-008',
        userId: user.id,
        productName: 'Chlorphenamine 4mg Tablets',
        category: 'Antihistamine',
        unit: 'strip',
        batchNo: 'CPN-2024-H',
        expiryDate: new Date('2027-01-31'),
        purchasePrice: 8.00,
        salePrice: 14.00,
        stockQty: 400,
        minStockAlert: 30,
      },
    }),
    prisma.product.upsert({
      where: { id: 'prod-009' },
      update: {},
      create: {
        id: 'prod-009',
        userId: user.id,
        productName: 'Azithromycin 250mg Tablets',
        category: 'Antibiotic',
        unit: 'strip',
        batchNo: 'AZI-2024-I',
        expiryDate: new Date('2026-08-31'),
        purchasePrice: 90.00,
        salePrice: 130.00,
        stockQty: 75,
        minStockAlert: 15,
      },
    }),
    prisma.product.upsert({
      where: { id: 'prod-010' },
      update: {},
      create: {
        id: 'prod-010',
        userId: user.id,
        productName: 'Normal Saline 500ml IV Bag',
        category: 'IV Fluids',
        unit: 'bag',
        batchNo: 'NS-2024-J',
        expiryDate: new Date('2026-03-31'),
        purchasePrice: 55.00,
        salePrice: 75.00,
        stockQty: 5,               // Low stock
        minStockAlert: 20,
      },
    }),
    prisma.product.upsert({
      where: { id: 'prod-011' },
      update: {},
      create: {
        id: 'prod-011',
        userId: user.id,
        productName: 'Atorvastatin 10mg Tablets',
        category: 'Lipid-lowering',
        unit: 'strip',
        batchNo: 'ATV-2024-K',
        expiryDate: new Date('2027-06-30'),
        purchasePrice: 45.00,
        salePrice: 65.00,
        stockQty: 90,
        minStockAlert: 15,
      },
    }),
    prisma.product.upsert({
      where: { id: 'prod-012' },
      update: {},
      create: {
        id: 'prod-012',
        userId: user.id,
        productName: 'Aspirin 75mg Tablets',
        category: 'Antiplatelet',
        unit: 'strip',
        batchNo: 'ASP-2024-L',
        expiryDate: new Date('2026-11-30'),
        purchasePrice: 6.00,
        salePrice: 10.00,
        stockQty: 600,
        minStockAlert: 50,
      },
    }),
  ]);
  console.log(`✅ ${products.length} products created`);

  console.log('\n🎉 Seed complete! Demo login:');
  console.log('   Email:    demo@medicalstore.app');
  console.log('   Password: Demo@12345\n');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
