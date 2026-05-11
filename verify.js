const APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbxwA4In5-tBNeJKwVo41Qw-aNCLDmI0v59WB9qSVNnmI8Cad2bYl3EywQT_US8dI2QUWg/exec";

const card = document.getElementById("verifyCard");
const params = new URLSearchParams(window.location.search);
const passId = params.get("id") || params.get("passId") || "";

verify();

async function verify() {
  if (!passId) {
    card.innerHTML = `<div class="notice bad">No pass ID provided.</div>`;
    return;
  }

  try {
    const payload = new URLSearchParams();
    payload.set("action", "verify");
    payload.set("passId", passId);

    const response = await fetch(APPS_SCRIPT_URL, { method: "POST", body: payload });
    const json = await response.json();

    if (!json.ok) throw new Error(json.error || "Verification failed.");

    if (!json.valid) {
      card.innerHTML = `
        <div class="notice bad">
          <h2>INVALID PASS</h2>
          Reason: ${escapeHtml(json.reason)}
        </div>
        ${json.pass ? passDetails(json.pass) : ""}
      `;
      return;
    }

    card.innerHTML = `
      <div class="notice good">
        <h2>VALID PARKING PASS</h2>
        This pass is paid and printed.
      </div>
      ${passDetails(json.pass)}
    `;
  } catch (err) {
    card.innerHTML = `<div class="notice bad">${escapeHtml(err.message)}</div>`;
  }
}

function passDetails(pass) {
  return `
    <div class="big-plate">${escapeHtml(pass["Plate"])}</div>
    <p class="meta">
      Location: ${escapeHtml(pass["Location Name"])}<br>
      Vehicle: ${escapeHtml(pass["Vehicle Color"])} ${escapeHtml(pass["Vehicle Make Model"])}<br>
      Pass ID: ${escapeHtml(pass["Pass ID"])}<br>
      Status: ${escapeHtml(pass["Status"])}<br>
      Payment: ${escapeHtml(pass["Payment Status"])}<br>
      Print: ${escapeHtml(pass["Print Status"])}<br>
      Valid Until: ${escapeHtml(pass["Valid Until"])}<br>
      Daily Phrase: ${escapeHtml(pass["Daily Phrase"])}
    </p>
  `;
}

function escapeHtml(value) {
  return String(value || "").replace(/[&<>"]/g, c => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;"
  }[c]));
}
