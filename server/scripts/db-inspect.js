// DB Inspection Script — checks all collections and recent data
import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

const PAD = 28;

async function inspect() {
  console.log('\n=== Connecting to MongoDB Atlas ===');
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected:', mongoose.connection.host);

  const db = mongoose.connection.db;
  const collections = await db.listCollections().toArray();

  console.log('\n╔══════════════════════════════════════════════════╗');
  console.log('║          COLLECTION DOCUMENT COUNTS               ║');
  console.log('╚══════════════════════════════════════════════════╝');
  const counts = {};
  for (const col of collections) {
    const count = await db.collection(col.name).countDocuments();
    counts[col.name] = count;
    console.log(`  ${col.name.padEnd(PAD)} ${count} docs`);
  }

  // ── RECENT ORDERS (last 5) ──────────────────────────────────────
  console.log('\n╔══════════════════════════════════════════════════╗');
  console.log('║          RECENT ORDERS (last 5)                   ║');
  console.log('╚══════════════════════════════════════════════════╝');
  const orders = await db.collection('orders')
    .find({})
    .sort({ createdAt: -1 })
    .limit(5)
    .toArray();
  orders.forEach(o => {
    console.log(`  ${(o.orderNumber || o._id.toString()).padEnd(35)} paymentMethod=${o.paymentMethod}  status=${o.status}  paymentStatus=${o.paymentStatus}  total=₹${o.totalAmount || o.total || '?'}  zone=${o.shippingZone || 'n/a'}  createdAt=${o.createdAt ? new Date(o.createdAt).toISOString().slice(0,19) : 'n/a'}`);
  });

  // ── RECENT UPI PAYMENTS (last 5) ───────────────────────────────
  if (counts['upipayments'] > 0 || counts['upi_payments'] > 0) {
    const upiCol = counts['upipayments'] ? 'upipayments' : 'upi_payments';
    console.log('\n╔══════════════════════════════════════════════════╗');
    console.log('║          RECENT UPI PAYMENTS (last 5)             ║');
    console.log('╚══════════════════════════════════════════════════╝');
    const upis = await db.collection(upiCol)
      .find({})
      .sort({ createdAt: -1 })
      .limit(5)
      .toArray();
    upis.forEach(u => {
      console.log(`  ${u._id.toString().padEnd(28)} status=${u.status}  amount=₹${u.amount}  utrNumber=${u.utrNumber || 'none'}  createdAt=${u.createdAt ? new Date(u.createdAt).toISOString().slice(0,19) : 'n/a'}`);
    });
  }

  // ── USERS ───────────────────────────────────────────────────────
  console.log('\n╔══════════════════════════════════════════════════╗');
  console.log('║          USERS                                     ║');
  console.log('╚══════════════════════════════════════════════════╝');
  const users = await db.collection('users').find({}).toArray();
  users.forEach(u => {
    console.log(`  ${u.email.padEnd(35)} role=${u.role}  uid=${u._id}`);
  });

  // ── PRODUCTS ────────────────────────────────────────────────────
  console.log('\n╔══════════════════════════════════════════════════╗');
  console.log('║          PRODUCTS                                  ║');
  console.log('╚══════════════════════════════════════════════════╝');
  const products = await db.collection('products')
    .find({})
    .project({ name: 1, price: 1, stock: 1, artisanId: 1, approved: 1 })
    .limit(10)
    .toArray();
  products.forEach(p => {
    console.log(`  ${(p.name || 'unnamed').padEnd(35)} ₹${p.price}  stock=${p.stock}  approved=${p.approved}  id=${p._id}`);
  });

  // ── ARTISANS ────────────────────────────────────────────────────
  if (counts['artisans'] > 0) {
    console.log('\n╔══════════════════════════════════════════════════╗');
    console.log('║          ARTISANS                                  ║');
    console.log('╚══════════════════════════════════════════════════╝');
    const artisans = await db.collection('artisans')
      .find({})
      .project({ name: 1, email: 1, status: 1, approved: 1 })
      .limit(10)
      .toArray();
    artisans.forEach(a => {
      console.log(`  ${(a.name || a.email || 'unnamed').padEnd(35)} status=${a.status || 'n/a'}  approved=${a.approved}  id=${a._id}`);
    });
  }

  // ── SETTLEMENTS ─────────────────────────────────────────────────
  if (counts['settlements'] > 0) {
    console.log('\n╔══════════════════════════════════════════════════╗');
    console.log('║          SETTLEMENTS (last 5)                     ║');
    console.log('╚══════════════════════════════════════════════════╝');
    const settlements = await db.collection('settlements')
      .find({})
      .sort({ createdAt: -1 })
      .limit(5)
      .toArray();
    settlements.forEach(s => {
      console.log(`  ${s._id.toString().padEnd(28)} artisan=${s.artisanId}  amount=₹${s.amount}  status=${s.status}  createdAt=${s.createdAt ? new Date(s.createdAt).toISOString().slice(0,19) : 'n/a'}`);
    });
  }

  // ── CATEGORIES ──────────────────────────────────────────────────
  if (counts['categories'] > 0) {
    console.log('\n╔══════════════════════════════════════════════════╗');
    console.log('║          CATEGORIES                               ║');
    console.log('╚══════════════════════════════════════════════════╝');
    const cats = await db.collection('categories').find({}).toArray();
    cats.forEach(c => {
      console.log(`  ${(c.name || c.slug || 'unnamed').padEnd(35)} id=${c._id}`);
    });
  }

  console.log('\n=== Inspection complete ===\n');
  await mongoose.disconnect();
}

inspect().catch(err => { console.error(err); process.exit(1); });
