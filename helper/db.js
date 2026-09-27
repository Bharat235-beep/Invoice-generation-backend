// db.js
const mongoose = require('mongoose');

async function connectDB() {
  try {
    await mongoose.connect(process.env.MONGODB_URI,{
        dbName:"invoices-app"
    });
    console.log('MongoDB connected');
  } catch (err) {
      console.error('MongoDB connection error:', err.message);
      console.log(err)
    process.exit(1);
  }
}

module.exports = connectDB;