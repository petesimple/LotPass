const APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbxwA4In5-tBNeJKwVo41Qw-aNCLDmI0v59WB9qSVNnmI8Cad2bYl3EywQT_US8dI2QUWg/exec";

const form = document.getElementById("parkingForm");
const result = document.getElementById("result");

const quickPhotoBtn = document.getElementById("quickPhotoBtn");
const platePhotoInput = document.getElementById("platePhotoInput");
const platePhotoPreview = document.getElementById("platePhotoPreview");

let selectedPlatePhotoBase64 = "";
let selectedPlatePhotoName = "";
let quickPhotoMode = false;

function cleanPlate(value) {
  return String(value || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
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
      result.innerHTML = `<div class="notice">Preparing plate photo...</div>`;

      selectedPlatePhotoName = file.name || "plate-photo.jpg";
      selectedPlatePhotoBase64 = await resizeImageToBase64(file, 1200, 0.82);

      if (platePhotoPreview) {
        platePhotoPreview.innerHTML = `
          <div class="notice good">
            <strong>Plate photo ready.</strong><br>
            Submit below to send this quick parking request.
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
      quickPhotoMode = false;

      result.innerHTML = `<div class="notice bad">${escapeHtml(err.message)}</div>`;
    }
  });
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  result.innerHTML = `<div class="notice">Submitting parking request...</div>`;

  const data = new FormData(form);
  const typedPlate = cleanPlate(data.get("plate"));

  const payload = new URLSearchParams();

  payload.set("action", "submit");
  payload.set("source", quickPhotoMode ? "public_quick_photo" : "public_form");

  if (quickPhotoMode && selectedPlatePhotoBase64 && !typedPlate) {
    payload.set("plate", "PHOTO");
  } else {
    payload.set("plate", typedPlate);
  }

  payload.set("vehicleColor", data.get("vehicleColor") || "");
  payload.set("vehicleMakeModel", data.get("vehicleMakeModel") || "");
  payload.set("phone", data.get("phone") || "");

  payload.set("parkingType", "Event Parking");

  let notes = data.get("notes") || "";

  if (quickPhotoMode && selectedPlatePhotoBase64) {
    notes = `QUICK PHOTO PLATE REVIEW${notes ? " | " + notes : ""}`;
    payload.set("quickPhoto", "yes");
    payload.set("platePhotoBase64", selectedPlatePhotoBase64);
    payload.set("platePhotoName", selectedPlatePhotoName || "plate-photo.jpg");
  } else {
    payload.set("quickPhoto", "no");
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
    quickPhotoMode = false;

    if (platePhotoPreview) {
      platePhotoPreview.innerHTML = "";
    }

    const quickMessage = json.pass && json.pass["Plate"] === "PHOTO"
      ? "Your plate photo was received. Please go inside, pay at the counter, and pick up your printed dashboard pass."
      : "Please go inside, pay at the counter, and pick up your printed dashboard pass.";

    result.innerHTML = `
      <div class="notice good">
        <strong>Request received.</strong><br>
        Pass ID: ${escapeHtml(json.pass["Pass ID"])}<br><br>
        ${escapeHtml(quickMessage)}
      </div>
    `;
  } catch (err) {
    result.innerHTML = `<div class="notice bad">${escapeHtml(err.message)}</div>`;
  }
});

function resizeImageToBase64(file, maxWidth = 1200, quality = 0.82) {
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
