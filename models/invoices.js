// models/Invoice.js
const mongoose = require('mongoose');

// const invoiceSchema = new mongoose.Schema(
//   {
//     shopifyOrderId: { type: String, required: true, unique: true },
//     orderNumber: String,
//     customerEmail: { type: String, required: true },
//     totalPrice: { type: Number, required: true },
//     pdfPath: { type: String, required: true },
//     emailStatus: {
//       type: String,
//       enum: ['pending', 'sent', 'failed'],
//       default: 'pending',
//     },
//     emailSentAt: Date,
//     emailError: String,
//   },
//   { timestamps: true }
// );
const invoiceSchema = new mongoose.Schema(
  {
    shopifyOrderId: { type: String, required: true, unique: true },
    orderNumber: String,
    customerName: String,
    customerEmail: { type: String, required: true },
    totalPrice: { type: Number, required: true },
    lineItems: [
      {
        title: String,
        quantity: Number,
        price: Number,
      },
    ],
    emailStatus: {
      type: String,
      enum: ['pending', 'sent', 'failed'],
      default: 'pending',
    },
    emailSentAt: Date,
    emailError: String,
  },
  { timestamps: true }
);

module.exports = mongoose.model('Invoice', invoiceSchema);