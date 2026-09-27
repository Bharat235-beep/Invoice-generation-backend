// testSave.js
require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('./helper/db');
const Invoice = require('./models/invoices');
const { generateInvoicePDF } = require('./helper/generateInvoice');

const fakeOrder = {
  orderNumber: '1001',
  createdAt: new Date(),
  customerName: 'Jane Doe',
  customerEmail: 'jane@example.com',
  totalPrice: 89.97,
  lineItems: [
    { title: 'Blue T-Shirt', quantity: 2, price: 24.99 },
    { title: 'Cap', quantity: 1, price: 39.99 },
  ],
};

async function run() {
  await connectDB();

  const pdfPath = await generateInvoicePDF(fakeOrder);

  const invoice = await Invoice.create({
    shopifyOrderId: 'fake-order-12345', // stand-in until we wire real webhook data
    orderNumber: fakeOrder.orderNumber,
    customerEmail: fakeOrder.customerEmail,
    totalPrice: fakeOrder.totalPrice,
    pdfPath,
  });

  console.log('Saved invoice:', invoice);
  mongoose.connection.close();
}

run();