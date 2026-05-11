/* ===========================================================
   LotPass T88 Print Bridge
   Raspberry Pi 400 -> Epson TM-T88 network printer

   Browser admin page sends JSON to:
   POST http://PI_IP:3000/print-parking-pass

npm init -y
npm install express cors escpos escpos-network qrcode

node server.js

pm2 start server.js --name lotpass-print-bridge
pm2 save


=========================================================== */

const express = require("express");
const cors = require("cors");
const escpos = require("escpos");
const QRCode = require("qrcode");

escpos.Network = require("escpos-network");

const app = express();
const SERVER_PORT = 3000;

const PRINTER_IP = "192.168.1.229";
const PRINTER_PORT = 9100;

app.use(cors());
app.use(express.json({ limit: "3mb" }));

function safeText(value, fallback = "") {
  return String(value || fallback).replace(/[\r\n]+/g, " ").trim();
}

function line(char = "=", count = 42) {
  return char.repeat(count);
}

function openPrinter() {
  const device = new escpos.Network(PRINTER_IP, PRINTER_PORT);
  const printer = new escpos.Printer(device, { encoding: "GB18030" });
  return { device, printer };
}

function printText(printer, text) {
  printer.text(String(text || ""));
}

async function printParkingPass(payload) {
  const locationName = safeText(payload.locationName, "PARKING");
  const passId = safeText(payload.passId);
  const plate = safeText(payload.plate).toUpperCase();
  const vehicle = [payload.vehicleColor, payload.vehicleMakeModel].map(v => safeText(v)).filter(Boolean).join(" ");
  const parkingType = safeText(payload.parkingType, "Event Parking");
  const amount = safeText(payload.amount);
  const validUntil = safeText(payload.validUntil, "Tonight");
  const verificationUrl = safeText(payload.verificationUrl);
  const dailyPhrase = safeText(payload.dailyPhrase, "VALID TODAY");
  const staffInitials = safeText(payload.staffInitials);

  const qrDataUrl = verificationUrl
    ? await QRCode.toDataURL(verificationUrl, { margin: 1, width: 220 })
    : null;

  const { device, printer } = openPrinter();

  return new Promise((resolve, reject) => {
    device.open((err) => {
      if (err) return reject(err);

      try {
        printer
          .align("ct")
          .style("b")
          .size(2, 2)
          .text("PARKING PASS")
          .size(1, 1)
          .text(locationName)
          .style("normal")
          .text(line("="));

        printer
          .style("b")
          .size(2, 2)
          .text(plate || "NO PLATE")
          .size(1, 1)
          .style("normal")
          .text(vehicle || "Vehicle info not provided")
          .text(line("-"));

        printer
          .align("lt")
          .text(`Type: ${parkingType}`)
          .text(`Valid Until: ${validUntil}`)
          .text(`Amount: ${amount ? "$" + amount : ""}`)
          .text(`Pass ID: ${passId}`)
          .text(`Phrase: ${dailyPhrase}`)
          .text(`Staff: ${staffInitials || ""}`)
          .text(`Printed: ${new Date().toLocaleString()}`)
          .text(line("-"));

        printer
          .align("ct")
          .style("b")
          .text("PLACE ON DASHBOARD")
          .style("normal")
          .text("Scan QR to verify");

        if (qrDataUrl) {
          const base64 = qrDataUrl.replace(/^data:image\/png;base64,/, "");
          const imageBuffer = Buffer.from(base64, "base64");
          escpos.Image.load(imageBuffer, "image/png", (image) => {
            printer
              .align("ct")
              .image(image, "d24")
              .then(() => {
                printer
                  .text(line("="))
                  .feed(3)
                  .cut()
                  .close();
                resolve();
              })
              .catch(reject);
          });
        } else {
          printer
            .text(line("="))
            .feed(3)
            .cut()
            .close();
          resolve();
        }
      } catch (printErr) {
        reject(printErr);
      }
    });
  });
}

app.get("/health", (req, res) => {
  res.json({ ok: true, service: "LotPass print bridge" });
});

app.post("/print-parking-pass", async (req, res) => {
  try {
    await printParkingPass(req.body || {});
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: err.message || String(err) });
  }
});

app.listen(SERVER_PORT, "0.0.0.0", () => {
  console.log(`LotPass print bridge running on port ${SERVER_PORT}`);
  console.log(`Printer target: ${PRINTER_IP}:${PRINTER_PORT}`);
});
