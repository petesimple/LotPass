const APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbxwA4In5-tBNeJKwVo41Qw-aNCLDmI0v59WB9qSVNnmI8Cad2bYl3EywQT_US8dI2QUWg/exec";

const pinInput = document.getElementById("pin");
const staffInput = document.getElementById("staffInitials");
const printServerInput = document.getElementById("printServerUrl");
const loadBtn = document.getElementById("loadBtn");
const list = document.getElementById("list");
const message = document.getElementById("message");

pinInput.value = localStorage.getItem("lotpassAdminPin") || "";
staffInput.value = localStorage.getItem("lotpassStaffInitials") || "";
printServerInput.value = localStorage.getItem("lotpassPrintServerUrl") || printServerInput.value;

pinInput.addEventListener("input", () => localStorage.setItem("lotpassAdminPin", pinInput.value));
staffInput.addEventListener("input", () => localStorage.setItem("lotpassStaffInitials", staffInput.value));
printServerInput.addEventListener("input", () => localStorage.setItem("lotpassPrintServerUrl", printServerInput.value));
loadBtn.addEventListener("click", loadToday);

function localDateKey() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

async function appsAction(action, extra = {}) {
  const payload = new URLSearchParams();
  payload.set("action", action);
  payload.set("pin", pinInput.value.trim());

  if (action === "listToday") {
    payload.set("date", localDateKey());
  }

  Object.entries(extra).forEach(([key, value]) => {
    payload.set(key, value == null ? "" : value);
  });

  const response = await fetch(APPS_SCRIPT_URL, {
    method: "POST",
    body: payload
  });

  const data = await response.json();

  if (!data.ok) {
    throw new Error(data.error || "Request failed.");
  }

  return data;
}

async function loadToday() {
  message.innerHTML = `<div class="notice">Loading today...</div>`;
  list.innerHTML = "";

  try {
    const data = await appsAction("listToday");
    const rows = data.rows || [];

    message.innerHTML = `
      <div class="notice good">
        Loaded ${rows.length} parking request(s) for ${escapeHtml(data.requestedDate || "today")}.<br>
        Total rows seen by script: ${escapeHtml(data.totalRowsFound)}
      </div>
    `;

    renderRows(rows);
  } catch (err) {
    message.innerHTML = `<div class="notice bad">${escapeHtml(err.message)}</div>`;
  }
}

function renderRows(rows) {
  if (!rows.length) {
    list.innerHTML = `<div class="notice">No parking requests yet today.</div>`;
    return;
  }

  const sorted = rows.slice().reverse();
  list.innerHTML = sorted.map(rowHtml).join("");

  document.querySelectorAll("[data-action]").forEach(btn => {
    btn.addEventListener("click", handleRowAction);
  });
}

function rowHtml(row) {
  const passId = row["Pass ID"];
  const status = String(row["Status"] || "pending").toLowerCase();
  const paid = String(row["Payment Status"] || "unpaid").toLowerCase();
  const printed = String(row["Print Status"] || "not_printed").toLowerCase();

  return `
    <article class="pass-card">
      <div class="pass-head">
        <div>
          <div class="big-plate">${escapeHtml(row["Plate"])}</div>
          <div class="meta">
            ${escapeHtml(row["Vehicle Color"])} ${escapeHtml(row["Vehicle Make Model"])}<br>
            Pass: ${escapeHtml(passId)}<br>
            Type: ${escapeHtml(row["Parking Type"])} | Amount: $${escapeHtml(row["Amount"])}<br>
            Payment: ${escapeHtml(paid)} | Print: ${escapeHtml(printed)}
          </div>
        </div>
        <span class="status ${escapeHtml(status)}">${escapeHtml(status)}</span>
      </div>
      <div class="actions">
        <button class="good" data-action="markPaid" data-id="${escapeAttr(passId)}">Mark Paid</button>
        <button data-action="print" data-id="${escapeAttr(passId)}">Print</button>
        <button class="secondary" data-action="reprint" data-id="${escapeAttr(passId)}">Reprint</button>
        <button class="bad" data-action="void" data-id="${escapeAttr(passId)}">Void</button>
      </div>
    </article>
  `;
}

async function handleRowAction(event) {
  const action = event.currentTarget.dataset.action;
  const passId = event.currentTarget.dataset.id;

  try {
    if (action === "markPaid") {
      await appsAction("markPaid", {
        passId,
        paymentMethod: "in_person",
        staffInitials: staffInput.value.trim()
      });

      message.innerHTML = `<div class="notice good">Marked paid: ${escapeHtml(passId)}</div>`;
      await loadToday();
      return;
    }

    if (action === "print" || action === "reprint") {
      await printPass(passId);
      await appsAction("markPrinted", { passId });

      message.innerHTML = `<div class="notice good">Printed: ${escapeHtml(passId)}</div>`;
      await loadToday();
      return;
    }

    if (action === "void") {
      const reason = prompt("Void reason?", "Voided by staff") || "Voided by staff";
      await appsAction("void", { passId, reason });

      message.innerHTML = `<div class="notice good">Voided: ${escapeHtml(passId)}</div>`;
      await loadToday();
      return;
    }
  } catch (err) {
    message.innerHTML = `<div class="notice bad">${escapeHtml(err.message)}</div>`;
  }
}

async function getCurrentRow(passId) {
  const data = await appsAction("listToday");
  const rows = data.rows || [];
  return rows.find(r => r["Pass ID"] === passId);
}

async function printPass(passId) {
  const row = await getCurrentRow(passId);

  if (!row) {
    throw new Error("Could not find pass for printing.");
  }

  if (String(row["Payment Status"] || "").toLowerCase() !== "paid") {
    throw new Error("Mark this pass paid before printing.");
  }

  const base = printServerInput.value.trim().replace(/\/$/, "");

  const response = await fetch(base + "/print-parking-pass", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      locationName: row["Location Name"],
      passId: row["Pass ID"],
      plate: row["Plate"],
      vehicleColor: row["Vehicle Color"],
      vehicleMakeModel: row["Vehicle Make Model"],
      parkingType: row["Parking Type"],
      amount: row["Amount"],
      validUntil: row["Valid Until"],
      verificationUrl: row["Verification URL"],
      dailyPhrase: row["Daily Phrase"],
      staffInitials: staffInput.value.trim()
    })
  });

  const data = await response.json();

  if (!data.ok) {
    throw new Error(data.error || "Printer failed.");
  }
}

function escapeHtml(value) {
  return String(value || "").replace(/[&<>"]/g, c => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;"
  }[c]));
}

function escapeAttr(value) {
  return escapeHtml(value).replace(/'/g, "&#39;");
}
