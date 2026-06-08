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

if (plateInput) {
  plateInput.addEventListener("input", () => {
    plateInput.value = cleanPlate(plateInput.value);
  });
}

if (quickPhotoBtn && platePhotoInput) {
  quickPhotoBtn.addEventListener("click", () => {
    quickPhotoMode = true;
    platePhotoInput.click();
  });

  platePhotoInput.addEventListener("change", async () => {
    const file = platePhotoInput.files && platePhotoInput.files[0];

    if (!file) {
      return;
    }

    try {
      selectedPlatePhotoBase64 = "";
      selectedPlatePhotoName = "";
      scannedPlate = "";

      result.innerHTML = `<div class="notice">Reading plate photo...</div>`;

      selectedPlatePhotoName = file.name || "plate-photo.jpg";
      selectedPlatePhotoBase64 = await resizeImageToBase64(file, 1500, 0.9);

      if (platePhotoPreview) {
        platePhotoPreview.innerHTML = `
          <div class="notice">
            Photo loaded. Scanning the plate now...
            <img
              class="plate-preview-img"
              src="${selectedPlatePhotoBase64}"
              alt="Plate photo preview"
            />
          </div>
        `;
      }

      scannedPlate = await scanPlateFromImage(selectedPlatePhotoBase64);

      if (plateInput && scannedPlate) {
        plateInput.value = scannedPlate;
      }

      if (platePhotoPreview) {
        if (scannedPlate) {
          platePhotoPreview.innerHTML = `
            <div class="notice good">
              <strong>Plate photo ready.</strong><br>
              LotPass scanned this plate:
              <br>
              <span class="ocr-pill">${escapeHtml(scannedPlate)}</span>
              <br><br>
              Please correct the plate number if needed, then submit.
              <img
                class="plate-preview-img"
                src="${selectedPlatePhotoBase64}"
                alt="Plate photo preview"
              />
            </div>
          `;
        } else {
          platePhotoPreview.innerHTML = `
            <div class="notice warn">
              <strong>Plate photo ready.</strong><br>
              LotPass could not confidently read the plate.
              You can type the plate number, or submit it as a photo review for the counter.
              <img
                class="plate-preview-img"
                src="${selectedPlatePhotoBase64}"
                alt="Plate photo preview"
              />
            </div>
          `;
        }
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
  const hasPhoto = Boolean(selectedPlatePhotoBase64);

  if (!typedPlate && !hasPhoto) {
    result.innerHTML = `
      <div class="notice bad">
        Please enter a license plate number or use Quick Photo Plate.
      </div>
    `;
    return;
  }

  const payload = new URLSearchParams();

  payload.set("action", "submit");
  payload.set("source", hasPhoto ? "public_quick_photo" : "public_form");

  payload.set("plate", typedPlate || scannedPlate || "PHOTO");
  payload.set("vehicleColor", data.get("vehicleColor") || "");
  payload.set("vehicleMakeModel", data.get("vehicleMakeModel") || "");
  payload.set("phone", data.get("phone") || "");

  payload.set("parkingType", data.get("parkingType") || "Event Parking");

  let notes = data.get("notes") || "";

  if (hasPhoto) {
    const quickNoteParts = ["QUICK PHOTO PLATE REVIEW"];

    if (scannedPlate) {
      quickNoteParts.push("OCR: " + scannedPlate);
    }

    if (notes) {
      quickNoteParts.push(notes);
    }

    notes = quickNoteParts.join(" | ");

    payload.set("quickPhoto", "yes");
    payload.set("platePhotoBase64", selectedPlatePhotoBase64);
    payload.set("platePhotoName", selectedPlatePhotoName || "plate-photo.jpg");
    payload.set("scannedPlate", scannedPlate || "");
  } else {
    payload.set("quickPhoto", "no");
    payload.set("platePhotoBase64", "");
    payload.set("platePhotoName", "");
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

    const passId = json.pass && json.pass["Pass ID"]
      ? json.pass["Pass ID"]
      : "Created";

    result.innerHTML = `
      <div class="notice good">
        <strong>Request received.</strong><br>
        Pass ID: ${escapeHtml(passId)}<br><br>
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

  try {
    const ocrResult = await Tesseract.recognize(imageBase64, "eng", {
      tessedit_char_whitelist: "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
    });

    const rawText = ocrResult && ocrResult.data && ocrResult.data.text
      ? ocrResult.data.text
      : "";

    return findBestPlate(rawText);
  } catch (err) {
    console.warn("Plate OCR failed:", err);
    return "";
  }
}

function findBestPlate(text) {
  const cleaned = String(text || "")
    .toUpperCase()
    .replace(/[^A-Z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const words = cleaned.split(" ");
  const candidates = [];

  words.forEach(word => {
    const plate = cleanPlate(word);

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

  const bestTexasLikePlate = candidates.find(value =>
    value.length === 7 &&
    /^[A-Z0-9]+$/.test(value) &&
    /[A-Z]/.test(value) &&
    /[0-9]/.test(value)
  );

  if (bestTexasLikePlate) {
    return bestTexasLikePlate;
  }

  const mixedCandidate = candidates.find(value =>
    value.length >= 5 &&
    value.length <= 8 &&
    /[A-Z]/.test(value) &&
    /[0-9]/.test(value)
  );

  if (mixedCandidate) {
    return mixedCandidate;
  }

  return candidates[0] || "";
}

function resizeImageToBase64(file, maxWidth = 1500, quality = 0.9) {
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
