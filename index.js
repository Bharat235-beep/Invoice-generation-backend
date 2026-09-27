const express = require("express");
const dotenv = require("dotenv");
const cors = require('cors');
const crypto = require("crypto")
const Invoice = require("./models/invoices");
const connectDB = require("./helper/db")
const rateLimit = require('express-rate-limit');
const {generateInvoicePDF} = require("./helper/generateInvoice")
const {sendInvoiceEmail} = require("./helper/sendInvoiceEmail")
const app = express();
app.set('trust proxy', 1); // trust the first proxy hop (Render's load balancer)

dotenv.config()
const allowedOrigins = [
  'https://invoice-dashboard-sepia-eta.vercel.app/',
  'http://localhost:5173',
];

app.use(cors({
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
}));

const demoLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 3,
  message: { error: 'Too many requests, please try again in an hour.' },
});

app.post('/webhooks/orders/paid', express.raw({ type: 'application/json' }), async (req, res) => {
  try {
    const hmacHeader = req.headers['x-shopify-hmac-sha256'];
    const body = req.body;

    const generatedHash = crypto
      .createHmac('sha256', process.env.SHOPIFY_API_SECRET)
      .update(body)
      .digest('base64');

    const trusted = crypto.timingSafeEqual(
      Buffer.from(generatedHash, 'utf8'),
      Buffer.from(hmacHeader, 'utf8')
    );

    if (!trusted) return res.status(401).send('Unauthorized');

    const order = JSON.parse(body);
    console.log("Order--",order)
    res.status(200).send('OK'); // respond fast, Shopify doesn't need to wait for the rest

    // Everything below runs AFTER responding
    processOrder(order).catch((err) => {
      console.error('Failed to process order:', err.message);
    });
  } catch (err) {
    console.error('Webhook error:', err.message);
    if (!res.headersSent) res.status(500).send('Error');
  }
});
app.get('/api/invoices/:id/pdf', async (req, res) => {
  try {
    const invoice = await Invoice.findById(req.params.id);
    if (!invoice) return res.status(404).send('Invoice not found');

    const pdfBuffer = await generateInvoicePDF({
      orderNumber: invoice.orderNumber,
      createdAt: invoice.createdAt,
      customerName: invoice.customerName || "Guest",
      customerEmail: invoice.customerEmail,
      totalPrice: invoice.totalPrice,
      lineItems: invoice.lineItems,
    });

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename=invoice-${invoice.orderNumber}.pdf`,
    });
    res.send(pdfBuffer);
  } catch (err) {
    console.log("Error",err)
    res.status(500).json({ error: err.message });
  }
});
app.get('/api/invoices', async (req, res) => {
  try {
    const invoices = await Invoice.find().sort({ createdAt: -1 });
    res.json(invoices);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
app.post('/api/demo/send-invoice', demoLimiter,express.json(), async (req, res) => {
  try {
    const { email } = req.body;
    console.log("Body---",req.body);
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: 'Valid email required' });
  }

    const fakeOrder = {
      orderNumber: 'DEMO-' + Math.floor(Math.random() * 9000 + 1000),
      createdAt: new Date(),
      customerName: 'Demo Customer',
      customerEmail: email,
      totalPrice: 129.98,
      lineItems: [
        { title: 'Sample Product A', quantity: 1, price: 79.99 },
        { title: 'Sample Product B', quantity: 1, price: 49.99 },
      ],
    };

    const pdfBuffer = await generateInvoicePDF(fakeOrder);
    await sendInvoiceEmail(email, pdfBuffer, fakeOrder.orderNumber);

    res.json({ success: true, message: 'Demo invoice sent!' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
async function processOrder(order) {
  if (!order.email) return;

  const invoiceData = {
    shopifyOrderId: String(order.id),
    orderNumber: order.order_number || order.name,
    customerName: order.customer
      ? `${order.customer.first_name} ${order.customer.last_name}`
      : 'Guest',
    customerEmail: order.email,
    totalPrice: parseFloat(order.total_price),
    lineItems: order.line_items.map((item) => ({
      title: item.title,
      quantity: item.quantity,
      price: parseFloat(item.price),
    })),
  };

  const existing = await Invoice.findOne({ shopifyOrderId: invoiceData.shopifyOrderId });

  if (existing && existing.emailStatus !== 'failed') {
    console.log(`Invoice already exists for order ${order.id}, skipping`);
    return;
  }

  let invoice;
  if (existing) {
    // retry case: update the existing record instead of creating a duplicate
    Object.assign(existing, invoiceData);
    invoice = existing;
  } else {
    invoice = new Invoice(invoiceData);
  }

  const pdfBuffer = await generateInvoicePDF({
    ...invoiceData,
    createdAt: invoice.createdAt || new Date(),
  });

  try {
    await sendInvoiceEmail(invoiceData.customerEmail, pdfBuffer, invoiceData.orderNumber);
    invoice.emailStatus = 'sent';
    invoice.emailSentAt = new Date();
    invoice.emailError = undefined; // clear any stale error from a previous failed attempt
  } catch (emailErr) {
    invoice.emailStatus = 'failed';
    invoice.emailError = emailErr.message;
  }

  await invoice.save();
  console.log(`Processed order ${order.id}, email status: ${invoice.emailStatus}`);
}
connectDB();
app.listen(3000,()=>{
    console.log("Server started !!")
})