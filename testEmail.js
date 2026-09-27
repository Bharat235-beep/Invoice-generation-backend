// testEmail.js
require('dotenv').config();
const { generateInvoicePDF } = require('./helper/generateInvoice');
const { sendInvoiceEmail } = require('./helper/sendInvoiceEmail');

const fakeOrder = {
  orderNumber: '1001',
  createdAt: new Date(),
  customerName: 'Jane Doe',
  customerEmail: 'jane@example.com', // this field isn't actually used for sending here
  totalPrice: 89.97,
  lineItems: [
    { title: 'Blue T-Shirt', quantity: 2, price: 24.99 },
    { title: 'Cap', quantity: 1, price: 39.99 },
  ],
};

async function run() {
  const pdfPath = await generateInvoicePDF(fakeOrder);

  const info = await sendInvoiceEmail(
    'rajkumar45burail@gmail.com', // send to yourself to test
    pdfPath,
    fakeOrder.orderNumber
  );

  console.log('Email sent:', info.messageId);
}

run();