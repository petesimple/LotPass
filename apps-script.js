/* ===========================================================
   LotPass Apps Script
   Google Sheets backend for parking pass requests, admin updates,
   and public verification.
=========================================================== */

const SHEET_PARKING = "Parking";
const SHEET_SETTINGS = "Settings";

const HEADERS = [
  "Timestamp",
  "Pass ID",
  "Date",
  "Location ID",
  "Location Name",
  "Status",
  "Payment Status",
  "Print Status",
  "Plate",
  "Vehicle Color",
  "Vehicle Make Model",
  "Phone",
  "Parking Type",
  "Amount",
  "Payment Method",
  "Staff Initials",
  "Valid From",
  "Valid Until",
  "Printed At",
  "Print Count",
  "Voided At",
  "Void Reason",
  "Verification URL",
  "Notes",
  "Source",
  "Daily Phrase"
];

function doGet(e) {
  return handleRequest(e);
}

function doPost(e) {
  return handleRequest(e);
}

function handleRequest(e) {
  try {
    const params = getParams(e);
    const action = String(params.action || "").trim();

    if (action === "submit") return jsonResponse(submitParking(params));
    if (action === "listToday") return jsonResponse(listToday(params));
    if (action === "markPaid") return jsonResponse(updateStatus(params, "paid"));
    if (action === "markPrinted") return jsonResponse(markPrinted(params));
    if (action === "void") return jsonResponse(voidPass(params));
    if (action === "verify") return jsonResponse(verifyPass(params));
    if (action === "settings") return jsonResponse({ ok: true, settings: getSettings() });

    return jsonResponse({ ok: false, error: "Unknown action." });
  } catch (err) {
    return jsonResponse({ ok: false, error: err.message || String(err) });
  }
}

function getParams(e) {
  const params = Object.assign({}, e && e.parameter ? e.parameter : {});

  if (e && e.postData && e.postData.contents) {
    try {
      const body = JSON.parse(e.postData.contents);
      Object.assign(params, body);
    } catch (err) {
      // Form encoded requests are already in e.parameter.
    }
  }

  return params;
}

function getSpreadsheet() {
  return SpreadsheetApp.getActiveSpreadsheet();
}

function getSheet(name) {
  const sheet = getSpreadsheet().getSheetByName(name);
  if (!sheet) throw new Error("Missing sheet: " + name);
  return sheet;
}

function ensureParkingHeaders() {
  const sheet = getSheet(SHEET_PARKING);
  const firstRow = sheet.getRange(1, 1, 1, HEADERS.length).getValues()[0];
  const needsHeaders = firstRow.every(v => !v);
  if (needsHeaders) sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);
}

function getSettings() {
  const sheet = getSheet(SHEET_SETTINGS);
  const values = sheet.getDataRange().getValues();
  const settings = {};

  for (let i = 1; i < values.length; i++) {
    const key = String(values[i][0] || "").trim();
    const value = String(values[i][1] || "").trim();
    if (key) settings[key] = value;
  }

  return settings;
}

function todayKey(dateObj) {
  return Utilities.formatDate(dateObj, Session.getScriptTimeZone(), "yyyy-MM-dd");
}

function displayDate(dateObj) {
  return Utilities.formatDate(dateObj, Session.getScriptTimeZone(), "EEEE MMMM d, yyyy");
}

function cleanText(value) {
  return String(value || "").trim();
}

function cleanPlate(value) {
  return cleanText(value).toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function generatePassId(locationId, now) {
  const sheet = getSheet(SHEET_PARKING);
  const day = Utilities.formatDate(now, Session.getScriptTimeZone(), "yyyyMMdd");
  const prefix = cleanText(locationId || "LP").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 3) || "LP";
  const values = sheet.getDataRange().getValues();
  let count = 0;

  for (let i = 1; i < values.length; i++) {
    const passId = String(values[i][1] || "");
    if (passId.indexOf(prefix + "-" + day) === 0) count++;
  }

  return prefix + "-" + day + "-" + String(count + 1).padStart(4, "0");
}

function submitParking(params) {
  ensureParkingHeaders();

  const settings = getSettings();
  const now = new Date();
  const dateKey = todayKey(now);
  const locationId = settings.location_id || "lotpass";
  const locationName = settings.location_name || "Parking";
  const dailyPhrase = settings.daily_phrase || "VALID TODAY";
  const plate = cleanPlate(params.plate);

  if (!plate) throw new Error("Plate number is required.");

  const passId = generatePassId(locationId, now);
  const verifyBase = settings.verify_base_url || "";
  const verificationUrl = verifyBase ? verifyBase + "?id=" + encodeURIComponent(passId) : "";
  const validUntil = settings.valid_until || "02:00";

  const rowObj = {
    "Timestamp": now,
    "Pass ID": passId,
    "Date": dateKey,
    "Location ID": locationId,
    "Location Name": locationName,
    "Status": "pending",
    "Payment Status": "unpaid",
    "Print Status": "not_printed",
    "Plate": plate,
    "Vehicle Color": cleanText(params.vehicleColor),
    "Vehicle Make Model": cleanText(params.vehicleMakeModel),
    "Phone": cleanText(params.phone),
    "Parking Type": cleanText(params.parkingType) || settings.parking_type_default || "Event Parking",
    "Amount": cleanText(params.amount) || settings.default_amount || "",
    "Payment Method": "",
    "Staff Initials": "",
    "Valid From": now,
    "Valid Until": validUntil,
    "Printed At": "",
    "Print Count": 0,
    "Voided At": "",
    "Void Reason": "",
    "Verification URL": verificationUrl,
    "Notes": cleanText(params.notes),
    "Source": cleanText(params.source) || "public_form",
    "Daily Phrase": dailyPhrase
  };

  const row = HEADERS.map(h => rowObj[h] !== undefined ? rowObj[h] : "");
  getSheet(SHEET_PARKING).appendRow(row);

  return { ok: true, pass: rowObj };
}

function getRowsAsObjects() {
  ensureParkingHeaders();
  const sheet = getSheet(SHEET_PARKING);
  const values = sheet.getDataRange().getValues();
  const rows = [];

  for (let i = 1; i < values.length; i++) {
    const obj = { rowNumber: i + 1 };
    HEADERS.forEach((h, idx) => obj[h] = values[i][idx]);
    if (obj["Pass ID"]) rows.push(obj);
  }

  return rows;
}

function listToday(params) {
  requireAdminPin(params);
  const today = todayKey(new Date());
  const rows = getRowsAsObjects().filter(r => String(r["Date"]) === today);
  return { ok: true, rows: rows.map(formatRowForClient) };
}

function formatRowForClient(row) {
  const out = {};
  Object.keys(row).forEach(k => {
    const value = row[k];
    out[k] = value instanceof Date
      ? Utilities.formatDate(value, Session.getScriptTimeZone(), "yyyy-MM-dd HH:mm:ss")
      : value;
  });
  return out;
}

function requireAdminPin(params) {
  const settings = getSettings();
  const expected = String(settings.admin_pin || "").trim();
  const actual = String(params.pin || "").trim();
  if (expected && actual !== expected) throw new Error("Invalid admin PIN.");
}

function findRowByPassId(passId) {
  const sheet = getSheet(SHEET_PARKING);
  const values = sheet.getDataRange().getValues();
  const id = cleanText(passId);

  for (let i = 1; i < values.length; i++) {
    if (String(values[i][1] || "") === id) {
      return { sheet, rowNumber: i + 1, values: values[i] };
    }
  }

  return null;
}

function setCell(rowNumber, header, value) {
  const col = HEADERS.indexOf(header) + 1;
  if (col < 1) throw new Error("Unknown header: " + header);
  getSheet(SHEET_PARKING).getRange(rowNumber, col).setValue(value);
}

function updateStatus(params, type) {
  requireAdminPin(params);
  const found = findRowByPassId(params.passId);
  if (!found) throw new Error("Pass not found.");

  if (type === "paid") {
    setCell(found.rowNumber, "Status", "paid");
    setCell(found.rowNumber, "Payment Status", "paid");
    setCell(found.rowNumber, "Payment Method", cleanText(params.paymentMethod) || "in_person");
    setCell(found.rowNumber, "Staff Initials", cleanText(params.staffInitials));
  }

  return { ok: true, passId: params.passId };
}

function markPrinted(params) {
  requireAdminPin(params);
  const found = findRowByPassId(params.passId);
  if (!found) throw new Error("Pass not found.");

  const currentCount = Number(found.values[HEADERS.indexOf("Print Count")] || 0);
  setCell(found.rowNumber, "Status", "printed");
  setCell(found.rowNumber, "Print Status", currentCount > 0 ? "reprinted" : "printed");
  setCell(found.rowNumber, "Printed At", new Date());
  setCell(found.rowNumber, "Print Count", currentCount + 1);

  return { ok: true, passId: params.passId, printCount: currentCount + 1 };
}

function voidPass(params) {
  requireAdminPin(params);
  const found = findRowByPassId(params.passId);
  if (!found) throw new Error("Pass not found.");

  setCell(found.rowNumber, "Status", "void");
  setCell(found.rowNumber, "Voided At", new Date());
  setCell(found.rowNumber, "Void Reason", cleanText(params.reason));

  return { ok: true, passId: params.passId };
}

function verifyPass(params) {
  const found = findRowByPassId(params.passId || params.id);
  if (!found) return { ok: true, valid: false, reason: "not_found" };

  const row = {};
  HEADERS.forEach((h, idx) => row[h] = found.values[idx]);

  const status = String(row["Status"] || "").toLowerCase();
  const payment = String(row["Payment Status"] || "").toLowerCase();
  const printStatus = String(row["Print Status"] || "").toLowerCase();

  const valid = status !== "void" && payment === "paid" && printStatus !== "not_printed";

  return {
    ok: true,
    valid,
    reason: valid ? "valid" : "not_paid_printed_or_void",
    pass: formatRowForClient(row)
  };
}

function jsonResponse(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
