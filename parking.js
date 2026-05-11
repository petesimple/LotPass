const APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbxwA4In5-tBNeJKwVo41Qw-aNCLDmI0v59WB9qSVNnmI8Cad2bYl3EywQT_US8dI2QUWg/exec";

const form = document.getElementById("parkingForm");
const result = document.getElementById("result");

function cleanPlate(value) {
  return String(value || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  result.innerHTML = `<div class="notice">Submitting parking request...</div>`;

  const data = new FormData(form);
  const payload = new URLSearchParams();
  payload.set("action", "submit");
  payload.set("source", "public_form");
  payload.set("plate", cleanPlate(data.get("plate")));
  payload.set("vehicleColor", data.get("vehicleColor") || "");
  payload.set("vehicleMakeModel", data.get("vehicleMakeModel") || "");
  payload.set("phone", data.get("phone") || "");
  payload.set("parkingType", data.get("parkingType") || "Event Parking");
  payload.set("notes", data.get("notes") || "");

  try {
    const response = await fetch(APPS_SCRIPT_URL, {
      method: "POST",
      body: payload
    });
    const json = await response.json();

    if (!json.ok) throw new Error(json.error || "Submission failed.");

    form.reset();
    result.innerHTML = `
      <div class="notice good">
        <strong>Request received.</strong><br>
        Pass ID: ${escapeHtml(json.pass["Pass ID"])}<br><br>
        Please go inside, pay at the counter, and pick up your printed dashboard pass.
      </div>
    `;
  } catch (err) {
    result.innerHTML = `<div class="notice bad">${escapeHtml(err.message)}</div>`;
  }
});

function escapeHtml(value) {
  return String(value || "").replace(/[&<>"]/g, c => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;"
  }[c]));
}
