const nodemailer = require('nodemailer');

function getTransporter() {
  return nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 587,
    secure: false, // STARTTLS, not implicit TLS
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
    family: 4,
  });
}
async function sendInvoiceEmail(toEmail, pdfBuffer, orderNumber) {
  const transporter = getTransporter();

  const info = await transporter.sendMail({
    from: `"Your Store" <${process.env.EMAIL_USER}>`,
    to: toEmail,
    subject: `Invoice for Order #${orderNumber}`,
    text: `Hi, thanks for your order! Please find your invoice attached.`,
    attachments: [
      {
        filename: `invoice-${orderNumber}.pdf`,
        content: pdfBuffer, // Nodemailer accepts a Buffer directly here — no path needed
      },
    ],
  });

  return info;
}
// async function sendInvoiceEmail(toEmail, pdfPath, orderNumber) {
//   console.log("toEmail--",toEmail);
//   console.log("pdfPath--",pdfPath);
//   console.log("orderNumber--",orderNumber);
//   const transporter = getTransporter(); // created fresh each call, env vars guaranteed loaded by now

//   const info = await transporter.sendMail({
//     from: `"Your Store" <${process.env.EMAIL_USER}>`,
//     to: toEmail,
//     subject: `Invoice for Order #${orderNumber}`,
//     text: `Hi, thanks for your order! Please find your invoice attached.`,
//     attachments: [
//       {
//         filename: `invoice-${orderNumber}.pdf`,
//         path: pdfPath,
//       },
//     ],
//   });

//   return info;
// }

module.exports = { sendInvoiceEmail };