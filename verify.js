const APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbxwA4In5-tBNeJKwVo41Qw-aNCLDmI0v59WB9qSVNnmI8Cad2bYl3EywQT_US8dI2QUWg/exec";

const card = document.getElementById("verifyCard");
const form = document.getElementById("verifyForm");
const manualPassIdInput = document.getElementById("manualPassId");

const params = new URLSearchParams(window.location.search);
const urlPassId = params.get("id") || params.get("passId") || "";

form.addEventListener("submit", event => {
  event.preventDefault();

  const manualPassId = manualPassIdInput.value.trim();

  if (!manualPassId) {
    card.innerHTML = `<div class="notice bad">Please enter a pass ID.</div>`;
    return;
  }

  verify(manualPassId);
});

if (urlPassId) {
  manualPassIdInput.value = urlPassId;
  verify(urlPassId);
}

async function verify(passId) {
  card.innerHTML = `<div class="notice">Checking pass...</div>`;

  try {
    const payload = new URLSearchParams();
    payload.set("action", "verify");
    payload.set("passId", passId);

    const response = await fetch(APPS_SCRIPT_URL, {
      method: "POST",
      body: payload
    });

    const data = await response.json();

    if (!data.ok) {
      throw new Error(data.error || "Verification failed.");
    }

    if (!data.valid) {
      card.innerHTML = `
        <div class="notice bad">
          <h2>INVALID PASS</h2>
          Reason: ${escapeHtml(data.reason)}
        </div>
        ${data.pass ? passDetails(data.pass) : ""}
      `;
      return;
    }

    card.innerHTML = `
      <div class="notice good">
        <h2>VALID PARKING PASS</h2>
        This pass is paid and printed.
      </div>
      ${passDetails(data.pass)}
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
