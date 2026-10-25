import 'dotenv/config';
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import connectDB from '../helper/db';
import User from '../models/User';

async function upsertUser(email: string, password: string, role: 'admin' | 'demo'): Promise<void> {
  const normalized = email.toLowerCase();
  const passwordHash = await bcrypt.hash(password, 10);
  await User.findOneAndUpdate(
    { email: normalized },
    { email: normalized, passwordHash, role },
    { upsert: true }
  );
  console.log(`${role} user ready: ${normalized}`);
}

async function seed(): Promise<void> {
  const { ADMIN_EMAIL, ADMIN_PASSWORD, DEMO_EMAIL, DEMO_PASSWORD } = process.env;
  if (!ADMIN_EMAIL || !ADMIN_PASSWORD || !DEMO_EMAIL || !DEMO_PASSWORD) {
    throw new Error('ADMIN_EMAIL, ADMIN_PASSWORD, DEMO_EMAIL and DEMO_PASSWORD must all be set');
  }
  if (ADMIN_EMAIL.toLowerCase() === DEMO_EMAIL.toLowerCase()) {
    throw new Error('Admin and demo emails must be different');
  }

  await connectDB();
  await upsertUser(ADMIN_EMAIL, ADMIN_PASSWORD, 'admin');
  await upsertUser(DEMO_EMAIL, DEMO_PASSWORD, 'demo');
  await mongoose.connection.close();
}

seed().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});