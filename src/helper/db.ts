// db.js
import mongoose from "mongoose";

async function connectDB(): Promise<void> {
  try {
    await mongoose.connect(process.env.MONGODB_URI as string,{
        dbName:"invoices-app"
    });
    console.log('MongoDB connected');
  } catch (err) {
    if (err instanceof Error) {
    console.error('MongoDB connection error:', err.message);
    console.log(err);
  } else {
    console.error('Unknown error:', err);
  }
    process.exit(1);
  }
}

export default connectDB;