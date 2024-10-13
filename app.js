require("dotenv").config();
const express = require("express");
const nodemailer = require("nodemailer");
const cors = require("cors");
// const PDFDocument = require("pdfkit");
// const PDFDocument = require("pdfkit-table");
const fs = require("fs");
const { default: PDFDocumentWithTables } = require("pdfkit-table");
const app = express();
const port = process.env.PORT || 3000;

app.use(cors());

app.use(express.json());

const formatDate = (date) => {
  const day = date.getDate();
  const month = date.getMonth() + 1;
  const year = date.getFullYear();
  return `${day}/${month}/${year}`; // format "DD/MM/YYYY"
};

// fungsi untuk membuat PDF laporan pesanan
function createOrderPDF(orderData, userEmail, callback) {
  const doc = new PDFDocumentWithTables();
  const filePath = `./receipt_${userEmail}.pdf`;

  const writeStream = fs.createWriteStream(filePath);

  doc.pipe(writeStream);

  // header laporan
  doc.fontSize(20).text("Laporan Belanja Anda", { align: "center" });
  doc.moveDown();
  doc.fontSize(12).text(`Nama: ${orderData.userName}`);
  doc.text(
    `Alamat: ${orderData.alamat.detail}, ${orderData.alamat["kota-kab"]}, ${orderData.alamat.provinsi}`
  );
  doc.text(`No. HP: ${orderData.nomorHP}`);
  doc.text(`Tanggal: ${formatDate(new Date())}`);
  doc.text(`Metode Pembayaran: ${orderData.paymentMethod}`);

  if (orderData.paymentMethod.toLowerCase() === "paypal") {
    doc.text(`ID Paypal: ${orderData.paypalID}`);
  }

  doc.moveDown();
  // doc.fontSize(14).text("Detail Produk", { underline: true });
  // doc.moveDown();
  const productTable = {
    title: "Detail Produk",
    headers: ["No", "Nama Produk", "Jumlah", "Harga"],
    rows: orderData.products.map((product, index) => [
      index + 1, // Nomor produk
      product.namaProduk, // Nama Produk
      product.jumlah, // Jumlah
      `${product.harga}`, // Harga
    ]),
  };

  // Menampilkan tabel
  doc.table(productTable, {
    columnsSize: [50, 200, 100, 100], // Mengatur ukuran kolom
    prepareHeader: () => doc.fontSize(12),
    prepareRow: (row, i) => doc.fontSize(10), // Mengatur ukuran font baris
  });

  doc.moveDown();
  doc.text(`Total Biaya: ${orderData.total}`, { align: "right" });
  // const tableTop = 200;
  // const itemNoX = 50;
  // const itemNameX = 100;
  // const itemQuantityX = 300;
  // const itemPriceX = 400;

  // doc.text("No", itemNoX, tableTop);
  // doc.text("Nama Produk", itemNameX, tableTop);
  // doc.text("Jumlah", itemQuantityX, tableTop);
  // doc.text("Harga", itemPriceX, tableTop);

  // let y = tableTop + 25;

  // orderData.products.forEach((product, index) => {
  //   doc.text(index + 1, itemNoX, y);
  //   doc.text(product.namaProduk, itemNameX, y);
  //   doc.text(product.jumlah, itemQuantityX, y);
  //   doc.text(`${product.harga}`, itemPriceX, y);
  //   y += 25;
  // });

  // doc.moveDown();
  // doc.text(`Total Biaya: ${orderData.total}`, { align: "right" });

  console.log("PDF creation started...");

  doc.end();

  writeStream.on("finish", () => {
    console.log("PDF writing finished.");
    console.log("Sending email...");
    callback(filePath); // pastikan callback dipanggil
  });

  writeStream.on("error", (err) => {
    console.error("Error writing PDF:", err);
  });
}

// route untuk mengirim laporan pembelian
app.post("/send-receipt", async (req, res) => {
  const { orderData, userEmail } = req.body;
  console.log("Received request to send receipt...");

  try {
    createOrderPDF(orderData, userEmail, async (filePath) => {
      console.log("Attempting to send email...");

      const transporter = nodemailer.createTransport({
        service: "gmail",
        auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_PASS,
        },
      });

      const mailOptions = {
        from: process.env.EMAIL_USER,
        to: userEmail,
        subject: "Laporan Pembelian",
        text: `Terima kasih telah berbelanja. Silakan cek lampiran untuk laporan belanja Anda.`,
        attachments: [
          {
            filename: `receipt_${userEmail}.pdf`,
            path: filePath,
            contentType: "application/pdf",
          },
        ],
      };

      try {
        const info = await transporter.sendMail(mailOptions);
        console.log("Email sent: ", info.response);

        fs.unlinkSync(filePath);
        console.log("PDF file deleted after email sent.");

        res
          .status(200)
          .send({ success: true, message: "Laporan berhasil dikirim" });
      } catch (emailErr) {
        console.error("Error sending email:", emailErr);
        res.status(500).send({
          success: false,
          message: "Gagal mengirim laporan",
          error: emailErr.message,
        });
      }
    });
  } catch (error) {
    console.error("Error in /send-receipt:", error);
    res.status(500).send({
      success: false,
      message: "Gagal mengirim laporan",
      error: error.message,
    });
  }
});

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
