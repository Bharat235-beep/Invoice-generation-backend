// test.js — run this standalone first
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

generateInvoicePDF(fakeOrder).then((filePath) => {
  console.log('PDF created at:', filePath);
});