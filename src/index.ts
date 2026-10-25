import { Request, Response } from 'express';
const express = require("express");
const dotenv = require("dotenv");
const cors = require('cors');
const crypto = require("crypto")
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import User from './models/User';
const Invoice = require('./models/Invoices').default;
const connectDB = require("./helper/db").default;
import rateLimit from 'express-rate-limit';
const {generateInvoicePDF} = require("./helper/generateInvoice")
import { IInvoice } from './models/Invoices';
import { HydratedDocument } from 'mongoose';
import requireAuth,{requireAdmin} from "./middleware/requireAuth"
const {sendInvoiceEmail} = require("./helper/sendInvoiceEmail")
const app = express();
app.set('trust proxy', 1); // trust the first proxy hop (Render's load balancer)

dotenv.config()
const allowedOrigins = [
  'https://invoice-dashboard-sepia-eta.vercel.app',
  'http://localhost:5173',
];

app.use(cors({
  origin: function (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) {
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
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: 'Too many login attempts, please try again later.' },
});


interface ShopifyOrderPayload {
  id: number;
  email: string;
  order_number?: number;
  name?: string;
  total_price: string;
  customer?: { first_name: string; last_name: string };
  line_items: { title: string; quantity: number; price: string }[];
}
app.get('/api/admin-check', requireAuth, requireAdmin, (req:Request, res:Response) => res.json({ ok: true }));
app.post('/api/auth/login', loginLimiter, express.json(), async (req: Request, res: Response) => {
  try {
  const { email, password } = req.body;
  if (typeof email !== 'string' || typeof password !== 'string') {
    return res.status(400).json({ error: 'Email and password required' });
  }

  const user = await User.findOne({ email: email.toLowerCase() });
console.log('user found:', !!user);
if (user) {
  console.log('password matches:', await bcrypt.compare(password, user.passwordHash));
}
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }

  const token = jwt.sign({ userId: user.id, role: user.role }, process.env.JWT_SECRET as string, { expiresIn: '1d' });
  res.json({ token });
  } catch (err) {
    let message:string = "Error";
    if (err instanceof Error) {
      message = err.message
    }
    res.status(500).json({ error: message });
  }
});
app.post('/webhooks/orders/paid', express.raw({ type: 'application/json' }), async (req:Request, res:Response) => {
  try {
    const hmacHeader = req.headers['x-shopify-hmac-sha256'];
    if (!hmacHeader || typeof hmacHeader !== 'string') {
      return res.status(401).send('Unauthorized');
    }
    const body = req.body;

    const generatedHash = crypto
      .createHmac('sha256', process.env.SHOPIFY_API_SECRET as string)
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
      if (err instanceof Error) {
        console.error('Failed to process order:', err.message);
      }
    });
  } catch (err) {
    if(err instanceof Error){
      console.error('Webhook error:', err.message);
      if (!res.headersSent) res.status(500).send('Error');
    }
    else{
      res.status(500).send('Error');
    }
  }
});
app.get('/api/invoices/:id/pdf',requireAuth, async (req:Request, res:Response) => {
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
    let message:string = "Error";
    if (err instanceof Error) {
      message = err.message
    }
    res.status(500).json({ error: message });
  }
});
app.get('/api/invoices',requireAuth, async (req: Request, res: Response) => {
  try {
    const invoices = await Invoice.find().sort({ createdAt: -1 });
    res.json(invoices);
  } catch (err) {
    let message:string = "Error";
    if (err instanceof Error) {
      message = err.message
    }
    res.status(500).json({ error: message });
  }
});
app.post('/api/demo/send-invoice', demoLimiter,express.json(), async (req: Request, res: Response) => {
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
    let message:string = "Error";
    if (err instanceof Error) {
      message = err.message
    }
    res.status(500).json({ error: message });
  }
});
async function processOrder(order:ShopifyOrderPayload) {
  if (!order.email) return;

  const invoiceData = {
    shopifyOrderId: String(order.id),
    orderNumber: String(order.order_number || order.name || 'unknown'),
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

  let invoice: HydratedDocument<IInvoice>;
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
    if(emailErr instanceof Error){
      invoice.emailStatus = 'failed';
      invoice.emailError = emailErr.message;
    }

  }

  await invoice.save();
  console.log(`Processed order ${order.id}, email status: ${invoice.emailStatus}`);
}
connectDB();
app.listen(3000,()=>{
    console.log("Server started !!")
})