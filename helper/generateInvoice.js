// generateInvoice.js
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
function generateInvoicePDF(order) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50 });
    const chunks = [];

    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    doc.fontSize(20).text('INVOICE', { align: 'right' });
    doc.moveDown();
    doc.fontSize(10).text(`Order #: ${order.orderNumber}`, { align: 'right' });
    doc.text(`Date: ${new Date(order.createdAt).toLocaleDateString()}`, { align: 'right' });
    doc.moveDown(2);
    
    doc.fontSize(12).text(`Bill To: ${order.customerName}`);
    doc.text(`Email: ${order.customerEmail}`);
    doc.moveDown(2);

    const tableTop = doc.y;
    doc.fontSize(10).text('Item', 50, tableTop);
    doc.text('Qty', 300, tableTop);
    doc.text('Price', 370, tableTop);
    doc.text('Total', 450, tableTop);
    doc.moveTo(50, tableTop + 15).lineTo(550, tableTop + 15).stroke();

    let y = tableTop + 25;
    order.lineItems.forEach((item) => {
      doc.text(item.title, 50, y);
      doc.text(item.quantity.toString(), 300, y);
      doc.text(`$${item.price.toFixed(2)}`, 370, y);
      doc.text(`$${(item.price * item.quantity).toFixed(2)}`, 450, y);
      y += 20;
    });

    doc.moveTo(50, y + 5).lineTo(550, y + 5).stroke();
    doc.fontSize(12).text(`Total: $${order.totalPrice.toFixed(2)}`, 400, y + 20);

    doc.end();
  });
}

module.exports = { generateInvoicePDF };

// function generateInvoicePDF(order) {
//   return new Promise((resolve, reject) => {
//     const fileName = `invoice-${order.orderNumber}.pdf`;
//     // console.log("__dirname",__dirname)
//     const filePath = path.join(__dirname, '../invoices', fileName);

//     const doc = new PDFDocument({ margin: 50 });
//     const stream = fs.createWriteStream(filePath);
//     doc.pipe(stream);

//     // Header
//     doc.fontSize(20).text('INVOICE', { align: 'right' });
//     doc.moveDown();
//     doc.fontSize(10).text(`Order #: ${order.orderNumber}`, { align: 'right' });
//     doc.text(`Date: ${new Date(order.createdAt).toLocaleDateString()}`, { align: 'right' });
//     doc.moveDown(2);

//     // Customer info
//     doc.fontSize(12).text(`Bill To: ${order.customerName}`);
//     doc.text(order.customerEmail);
//     doc.moveDown(2);

//     // Line items table (manual, since PDFKit has no built-in table helper)
//     const tableTop = doc.y;
//     doc.fontSize(10).text('Item', 50, tableTop);
//     doc.text('Qty', 300, tableTop);
//     doc.text('Price', 370, tableTop);
//     doc.text('Total', 450, tableTop);
//     doc.moveTo(50, tableTop + 15).lineTo(550, tableTop + 15).stroke();

//     let y = tableTop + 25;
//     order.lineItems.forEach((item) => {
//       doc.text(item.title, 50, y);
//       doc.text(item.quantity.toString(), 300, y);
//       doc.text(`$${item.price.toFixed(2)}`, 370, y);
//       doc.text(`$${(item.price * item.quantity).toFixed(2)}`, 450, y);
//       y += 20;
//     });

//     doc.moveTo(50, y + 5).lineTo(550, y + 5).stroke();
//     doc.fontSize(12).text(`Total: $${order.totalPrice.toFixed(2)}`, 400, y + 20);

//     doc.end();

//     stream.on('finish', () => resolve(filePath));
//     stream.on('error', reject);
//   });
// }

// module.exports = { generateInvoicePDF };