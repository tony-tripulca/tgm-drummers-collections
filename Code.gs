/*
 * TGM Drummers Collections - Google Apps Script
 *
 * SETUP:
 * 1. Open script.google.com and create a new project.
 * 2. Paste this file into Code.gs.
 * 3. Edit CONFIG below.
 * 4. Deploy > New deployment > Web app.
 *    Execute as: Me
 *    Who has access: Anyone (only if you intend this form to be public).
 * 5. Copy the Web app URL ending in /exec into CONFIG.appsScriptUrl in index.js.
 *
 * The browser sends JSON as text/plain. The script stores the optional image
 * in Drive, gets the saved file URL, then submits collection details and
 * the URL in the Google Form's Receipt field.
 */

const CONFIG = {
  DRIVE_FOLDER_ID: "YOUR_GOOGLE_DRIVE_FOLDER_ID",

  // Use the Google Forms responder URL, not the edit URL.
  // Example format: https://docs.google.com/forms/d/e/FORM_ID/formResponse
  GOOGLE_FORM_RESPONSE_URL: "YOUR_GOOGLE_FORM_RESPONSE_URL",

  // Replace each value with the matching entry.xxxxx field ID.
  FORM_ENTRY_IDS: {
    name: "entry.111111111",
    amount: "entry.222222222",
    paymentMethod: "entry.333333333",
    notes: "entry.444444444",
    receipt: "entry.555555555"
  },

  MAX_EVIDENCE_SIZE_BYTES: 5 * 1024 * 1024
};

function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) {
      throw new Error("Request body is empty.");
    }

    const payload = JSON.parse(e.postData.contents);

    if (payload.action !== "submitCollection") {
      throw new Error("Unsupported action.");
    }

    validateConfig_();
    validatePayload_(payload);

    let receiptUrl = "";

    if (payload.evidence && payload.evidence.base64) {
      const file = saveEvidence_(payload);
      receiptUrl = file.getUrl();
    }

    submitGoogleForm_(payload, receiptUrl);

    return jsonResponse_({
      success: true,
      message: "Collection submitted.",
      evidenceSaved: Boolean(receiptUrl),
      receiptUrl: receiptUrl
    });
  } catch (error) {
    console.error(error && error.stack ? error.stack : error);
    return jsonResponse_({
      success: false,
      message: error && error.message ? error.message : "Submission failed."
    });
  }
}

function validateConfig_() {
  if (CONFIG.DRIVE_FOLDER_ID.indexOf("YOUR_") === 0) {
    throw new Error("Set DRIVE_FOLDER_ID in Code.gs.");
  }
  if (CONFIG.GOOGLE_FORM_RESPONSE_URL.indexOf("YOUR_") !== -1) {
    throw new Error("Set GOOGLE_FORM_RESPONSE_URL in Code.gs.");
  }
  const sampleIds = [
    "entry.111111111",
    "entry.222222222",
    "entry.333333333",
    "entry.444444444",
    "entry.555555555"
  ];
  Object.keys(CONFIG.FORM_ENTRY_IDS).forEach(function(key) {
    if (!/^entry\.\d+$/.test(String(CONFIG.FORM_ENTRY_IDS[key])) ||
        sampleIds.indexOf(CONFIG.FORM_ENTRY_IDS[key]) !== -1) {
      throw new Error("Replace the sample Google Form entry IDs in Code.gs.");
    }
  });
}

function validatePayload_(payload) {
  const allowedNames = ["Angello", "Daryll", "Edge", "Genesis", "Jorim", "Mae", "Noel", "Othniel", "FA"];
  const allowedMethods = ["GCASH", "BANK TRANSFER", "F2F"];

  if (allowedNames.indexOf(String(payload.name)) === -1) {
    throw new Error("Invalid name.");
  }
  if (!Number.isFinite(Number(payload.amount)) || Number(payload.amount) <= 0) {
    throw new Error("Invalid amount.");
  }
  if (allowedMethods.indexOf(String(payload.paymentMethod)) === -1) {
    throw new Error("Invalid payment method.");
  }
  if (payload.evidence) {
    if (!payload.evidence.base64 || !payload.evidence.mimeType || !payload.evidence.fileName) {
      throw new Error("Evidence file data is incomplete.");
    }
    if (!/^image\/(jpeg|png|webp|gif|heic|heif)$/i.test(payload.evidence.mimeType)) {
      throw new Error("Unsupported evidence image type.");
    }
    const estimatedBytes = Math.floor(payload.evidence.base64.length * 3 / 4);
    if (estimatedBytes > CONFIG.MAX_EVIDENCE_SIZE_BYTES) {
      throw new Error("Evidence image exceeds the 5 MB limit.");
    }
  }
}

function saveEvidence_(payload) {
  const folder = DriveApp.getFolderById(CONFIG.DRIVE_FOLDER_ID);
  const evidence = payload.evidence;
  const bytes = Utilities.base64Decode(evidence.base64);
  const safeOriginalName = String(evidence.fileName).replace(/[^\w.\-]/g, "_");
  const timestamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyyMMdd_HHmmss");
  const fileName = timestamp + "_" + String(payload.name) + "_" + safeOriginalName;
  const blob = Utilities.newBlob(bytes, evidence.mimeType, fileName);
  return folder.createFile(blob);
}

function submitGoogleForm_(payload, receiptUrl) {
  const formPayload = {};
  formPayload[CONFIG.FORM_ENTRY_IDS.name] = String(payload.name);
  formPayload[CONFIG.FORM_ENTRY_IDS.amount] = String(payload.amount);
  formPayload[CONFIG.FORM_ENTRY_IDS.paymentMethod] = String(payload.paymentMethod);
  formPayload[CONFIG.FORM_ENTRY_IDS.notes] = String(payload.notes || "");
  formPayload[CONFIG.FORM_ENTRY_IDS.receipt] = String(receiptUrl || "");

  const response = UrlFetchApp.fetch(CONFIG.GOOGLE_FORM_RESPONSE_URL, {
    method: "post",
    payload: formPayload,
    followRedirects: true,
    muteHttpExceptions: true
  });

  const statusCode = response.getResponseCode();
  if (statusCode < 200 || statusCode >= 400) {
    throw new Error("Google Forms returned HTTP " + statusCode + ".");
  }
}

function jsonResponse_(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
