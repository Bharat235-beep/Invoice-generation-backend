// models/Invoice.js
import mongoose, { Schema, Document } from 'mongoose';

interface ILineItem {
  title: string;
  quantity: number;
  price: number;
}

export interface IInvoice extends Document {
  shopifyOrderId: string;
  orderNumber: string;
  customerName: string;
  customerEmail: string;
  totalPrice: number;
  lineItems: ILineItem[];
  emailStatus: 'pending' | 'sent' | 'failed';
  emailSentAt?: Date;
  emailError?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

const invoiceSchema = new Schema<IInvoice>(
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

export default mongoose.model<IInvoice>('Invoice', invoiceSchema);