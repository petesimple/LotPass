const APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbxwA4In5-tBNeJKwVo41Qw-aNCLDmI0v59WB9qSVNnmI8Cad2bYl3EywQT_US8dI2QUWg/exec";

const form = document.getElementById("parkingForm");
const result = document.getElementById("result");

const plateInput = document.getElementById("plate");
const quickPhotoBtn = document.getElementById("quickPhotoBtn");
const platePhotoInput = document.getElementById("platePhotoInput");
const platePhotoPreview = document.getElementById("platePhotoPreview");

let selectedPlatePhotoBase64 = "";
let selectedPlatePhotoName = "";
let quickPhotoMode = false;
let scannedPlate = "";

function cleanPlate(value) {
  return String(value || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
}

if (quickPhotoBtn && platePhotoInput) {
  quickPhotoBtn.addEventListener("click", () => {
    quickPhotoMode = true;

    if (plateInput) {
      plateInput.removeAttribute("required");
    }

    platePhotoInput.click();
  });

  platePhotoInput.addEventListener("change", async () => {
    const file = platePhotoInput.files && platePhotoInput.files[0];

    if (!file) {
      return;
    }

    try {
      result.innerHTML = `<div class="notice">Reading plate photo...</div>`;

      selectedPlatePhotoName = file.name || "plate-photo.jpg";
      selectedPlatePhotoBase64 = await resizeImageToBase64(file, 1400, 0.9);

      scannedPlate = await scanPlateFromImage(selectedPlatePhotoBase64);

      if (plateInput && scannedPlate) {
        plateInput.value = scannedPlate;
      }

      if (platePhotoPreview) {
        platePhotoPreview.innerHTML = `
          <div class="notice good">
            <strong>Plate photo ready.</strong><br>
            ${
              scannedPlate
                ? `Scanned plate: <strong>${escapeHtml(scannedPlate)}</strong><br>Please correct it if needed, then submit.`
                : `Could not confidently scan the plate.<br>You can type it in, or submit and let the counter review the photo.`
            }
            <br><br>
            <img
              src="${selectedPlatePhotoBase64}"
              alt="Plate photo preview"
              style="max-width:100%;border-radius:12px;border:1px solid rgba(255,255,255,.2);"
            />
          </div>
        `;
      }

      result.innerHTML = "";
    } catch (err) {
      selectedPlatePhotoBase64 = "";
      selectedPlatePhotoName = "";
      scannedPlate = "";

      result.innerHTML = `<div class="notice bad">${escapeHtml(err.message)}</div>`;
    }
  });
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  result.innerHTML = `<div class="notice">Submitting parking request...</div>`;

  const data = new FormData(form);
  const typedPlate = cleanPlate(data.get("plate"));

  if (!typedPlate && !selectedPlatePhotoBase64) {
    result.innerHTML = `<div class="notice bad">Please enter a plate number or use Quick Photo Plate.</div>`;
    return;
  }

  const payload = new URLSearchParams();

  payload.set("action", "submit");
  payload.set("source", quickPhotoMode ? "public_quick_photo" : "public_form");

  payload.set("plate", typedPlate || scannedPlate || "PHOTO");
  payload.set("vehicleColor", data.get("vehicleColor") || "");
  payload.set("vehicleMakeModel", data.get("vehicleMakeModel") || "");
  payload.set("phone", data.get("phone") || "");

  payload.set("parkingType", "Event Parking");

  let notes = data.get("notes") || "";

  if (quickPhotoMode && selectedPlatePhotoBase64) {
    notes = `QUICK PHOTO PLATE REVIEW${scannedPlate ? " | OCR: " + scannedPlate : ""}${notes ? " | " + notes : ""}`;

    payload.set("quickPhoto", "yes");
    payload.set("platePhotoBase64", selectedPlatePhotoBase64);
    payload.set("platePhotoName", selectedPlatePhotoName || "plate-photo.jpg");
    payload.set("scannedPlate", scannedPlate || "");
  } else {
    payload.set("quickPhoto", "no");
    payload.set("scannedPlate", "");
  }

  payload.set("notes", notes);

  try {
    const response = await fetch(APPS_SCRIPT_URL, {
      method: "POST",
      body: payload
    });

    const json = await response.json();

    if (!json.ok) {
      throw new Error(json.error || "Submission failed.");
    }

    form.reset();

    selectedPlatePhotoBase64 = "";
    selectedPlatePhotoName = "";
    scannedPlate = "";
    quickPhotoMode = false;

    if (platePhotoPreview) {
      platePhotoPreview.innerHTML = "";
    }

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

async function scanPlateFromImage(imageBase64) {
  if (!window.Tesseract) {
    return "";
  }

  const result = await Tesseract.recognize(imageBase64, "eng", {
    tessedit_char_whitelist: "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
  });

  const rawText = result && result.data && result.data.text
    ? result.data.text
    : "";

  return findBestPlate(rawText);
}

function findBestPlate(text) {
  const cleaned = String(text || "")
    .toUpperCase()
    .replace(/[^A-Z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const chunks = cleaned.split(" ");

  const candidates = [];

  chunks.forEach(chunk => {
    const plate = cleanPlate(chunk);

    if (plate.length >= 4 && plate.length <= 8) {
      candidates.push(plate);
    }
  });

  const joined = cleanPlate(cleaned);

  for (let size = 8; size >= 4; size--) {
    for (let i = 0; i <= joined.length - size; i++) {
      const possible = joined.slice(i, i + size);

      if (/[A-Z]/.test(possible) && /[0-9]/.test(possible)) {
        candidates.push(possible);
      }
    }
  }

  const texasStyle = candidates.find(value =>
    value.length === 7 &&
    /^[A-Z0-9]+$/.test(value) &&
    /[A-Z]/.test(value) &&
    /[0-9]/.test(value)
  );

  if (texasStyle) {
    return texasStyle;
  }

  return candidates[0] || "";
}

function resizeImageToBase64(file, maxWidth = 1400, quality = 0.9) {
  return new Promise((resolve, reject) => {
    if (!file.type || !file.type.startsWith("image/")) {
      reject(new Error("Please choose a photo of the license plate."));
      return;
    }

    const reader = new FileReader();

    reader.onload = () => {
      const img = new Image();

      img.onload = () => {
        const scale = Math.min(1, maxWidth / img.width);
        const width = Math.round(img.width * scale);
        const height = Math.round(img.height * scale);

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, width, height);

        const base64 = canvas.toDataURL("image/jpeg", quality);
        resolve(base64);
      };

      img.onerror = () => {
        reject(new Error("Could not read that photo."));
      };

      img.src = reader.result;
    };

    reader.onerror = () => {
      reject(new Error("Could not load that photo."));
    };

    reader.readAsDataURL(file);
  });
}

function escapeHtml(value) {
  return String(value || "").replace(/[&<>"]/g, c => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;"
  }[c]));
}
