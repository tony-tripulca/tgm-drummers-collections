/*
 * TGM Drummers Collections
 *
 * Frontend behavior:
 * - Preset and custom amount selection
 * - Payment-method information panels
 * - Receipt image preview
 * - POST submission to Google Apps Script
 *
 * IMPORTANT:
 * Set APPS_SCRIPT_URL to your deployed Apps Script Web App URL.
 */

(() => {
  "use strict";

  const CONFIG = {
    APPS_SCRIPT_URL:
      "https://script.google.com/macros/s/AKfycbwZZdshvz0gSOvEkKyiG_XK1H6UNhn_n1K9ewFUE3UdwNqHGTbL4stPG4SkVPp5Rh5D_A/exec",
    MAX_RECEIPT_SIZE_MB: 5,
  };

  document.addEventListener("DOMContentLoaded", () => {
    const form = document.getElementById("collectionForm");
    const otherAmountOption = document.getElementById("otherAmountOption");
    const otherAmountWrap = document.getElementById("otherAmountWrap");
    const otherAmountInput = document.getElementById("otherAmount");
    const paymentMethod = document.getElementById("paymentMethod");
    const receiptInput = document.getElementById("evidence");
    const receiptPreview = document.getElementById("evidencePreview");
    const fileName = document.getElementById("fileName");
    const submitButton = document.getElementById("submitButton");
    const statusMessage = document.getElementById("statusMessage");

    if (
      !form ||
      !otherAmountOption ||
      !otherAmountWrap ||
      !otherAmountInput ||
      !paymentMethod ||
      !receiptInput ||
      !receiptPreview ||
      !fileName ||
      !submitButton ||
      !statusMessage
    ) {
      console.error(
        "TGM Drummers Collections: One or more required HTML elements are missing.",
      );
      return;
    }

    let previewObjectUrl = null;

    // Show the custom amount field only when "Others" is selected.
    document.querySelectorAll('input[name="amountOption"]').forEach((radio) => {
      radio.addEventListener("change", () => {
        const customAmountSelected = otherAmountOption.checked;
        otherAmountWrap.hidden = !customAmountSelected;
        otherAmountInput.required = customAmountSelected;

        if (!customAmountSelected) {
          otherAmountInput.value = "";
        }
      });
    });

    // Show the information panel for the selected payment method.
    const paymentPanels = {
      GCASH: document.getElementById("gcashInfo"),
      "BANK TRANSFER": document.getElementById("bankInfo"),
      F2F: document.getElementById("f2fInfo"),
    };

    paymentMethod.addEventListener("change", () => {
      Object.values(paymentPanels).forEach((panel) => {
        if (panel) panel.hidden = true;
      });

      const selectedPanel = paymentPanels[paymentMethod.value];
      if (selectedPanel) selectedPanel.hidden = false;
    });

    // Display QR images if the configured image files exist.
    ["gcash", "bank"].forEach((type) => {
      const image = document.getElementById(`${type}QrImage`);
      const placeholder = document.getElementById(`${type}QrPlaceholder`);

      if (!image || !placeholder) return;

      image.addEventListener("load", () => {
        image.hidden = false;
        placeholder.hidden = true;
      });

      image.addEventListener("error", () => {
        image.hidden = true;
        placeholder.hidden = false;
      });

      // Handle an image that was already loaded from cache.
      if (image.complete && image.naturalWidth > 0) {
        image.hidden = false;
        placeholder.hidden = true;
      }
    });

    // Receipt selection and temporary local preview.
    receiptInput.addEventListener("change", () => {
      clearReceiptPreview();

      const receiptFile = receiptInput.files && receiptInput.files[0];
      if (!receiptFile) {
        fileName.textContent = "No image selected";
        clearStatus();
        return;
      }

      if (!receiptFile.type.startsWith("image/")) {
        receiptInput.value = "";
        fileName.textContent = "No image selected";
        showStatus("Please select an image file for the receipt.", "error");
        return;
      }

      const maxBytes = CONFIG.MAX_RECEIPT_SIZE_MB * 1024 * 1024;
      if (receiptFile.size > maxBytes) {
        receiptInput.value = "";
        fileName.textContent = "No image selected";
        showStatus(
          `Receipt image must be ${CONFIG.MAX_RECEIPT_SIZE_MB} MB or smaller.`,
          "error",
        );
        return;
      }

      previewObjectUrl = URL.createObjectURL(receiptFile);
      receiptPreview.src = previewObjectUrl;
      receiptPreview.hidden = false;
      fileName.textContent = `${receiptFile.name} (${formatFileSize(receiptFile.size)})`;
      clearStatus();
    });

    // Form submission.
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      clearStatus();

      if (!form.reportValidity()) return;

      if (
        !CONFIG.APPS_SCRIPT_URL ||
        CONFIG.APPS_SCRIPT_URL === "YOUR_APPS_SCRIPT_WEB_APP_URL"
      ) {
        showStatus(
          "Setup required: add your deployed Google Apps Script Web App URL in index.js.",
          "error",
        );
        return;
      }

      const formData = new FormData(form);
      const selectedAmount = formData.get("amountOption");
      const amount =
        selectedAmount === "other"
          ? Number(formData.get("otherAmount"))
          : Number(selectedAmount);

      if (!Number.isFinite(amount) || amount <= 0) {
        showStatus("Please enter a valid amount greater than zero.", "error");
        return;
      }

      const receiptFile = receiptInput.files && receiptInput.files[0];

      if (
        receiptFile &&
        receiptFile.size > CONFIG.MAX_RECEIPT_SIZE_MB * 1024 * 1024
      ) {
        showStatus(
          `Receipt image must be ${CONFIG.MAX_RECEIPT_SIZE_MB} MB or smaller.`,
          "error",
        );
        return;
      }

      submitButton.disabled = true;
      submitButton.textContent = "Preparing submission...";

      try {
        let receipt = null;

        if (receiptFile) {
          receipt = {
            fileName: receiptFile.name,
            mimeType: receiptFile.type,
            base64: await readFileAsBase64(receiptFile),
          };
        }

        const payload = {
          action: "submitCollection",
          submittedAt: new Date().toISOString(),
          name: String(formData.get("name")),
          amount,
          paymentMethod: String(formData.get("paymentMethod")),
          notes: String(formData.get("notes") || "").trim(),
          evidence: receipt,
        };

        submitButton.textContent = "Sending...";

        /*
         * Apps Script ContentService responses are redirected and browser CORS
         * handling can make a direct fetch response unreadable. This simple
         * POST is sent in no-cors mode; therefore a resolved fetch means only
         * that the browser dispatched the request, not that the server confirmed
         * the Drive upload and Google Form submission.
         */
        await fetch(CONFIG.APPS_SCRIPT_URL, {
          method: "POST",
          mode: "no-cors",
          headers: {
            "Content-Type": "text/plain;charset=utf-8",
          },
          body: JSON.stringify(payload),
        });

        showStatus(
          "Your submission request was sent. Please verify the Google Form response and the receipt in Google Drive before submitting again.",
          "info",
        );

        form.reset();
        resetConditionalFields();
      } catch (error) {
        console.error("TGM Drummers Collections submission failed:", error);
        showStatus(
          "Unable to send the submission. Check your internet connection and Apps Script Web App URL, then try again.",
          "error",
        );
      } finally {
        submitButton.disabled = false;
        submitButton.textContent = "Submit Collection";
      }
    });

    function resetConditionalFields() {
      otherAmountWrap.hidden = true;
      otherAmountInput.required = false;

      Object.values(paymentPanels).forEach((panel) => {
        if (panel) panel.hidden = true;
      });

      clearReceiptPreview();
      fileName.textContent = "No image selected";
    }

    function clearReceiptPreview() {
      if (previewObjectUrl) {
        URL.revokeObjectURL(previewObjectUrl);
        previewObjectUrl = null;
      }

      receiptPreview.removeAttribute("src");
      receiptPreview.hidden = true;
    }

    function showStatus(message, type) {
      statusMessage.textContent = message;
      statusMessage.className = `status show ${type}`;
    }

    function clearStatus() {
      statusMessage.textContent = "";
      statusMessage.className = "status";
    }
  });

  function readFileAsBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = () => {
        const dataUrl = String(reader.result || "");
        const commaIndex = dataUrl.indexOf(",");

        if (commaIndex === -1) {
          reject(new Error("Unable to encode the receipt image."));
          return;
        }

        resolve(dataUrl.slice(commaIndex + 1));
      };

      reader.onerror = () => {
        reject(reader.error || new Error("Unable to read the receipt image."));
      };

      reader.readAsDataURL(file);
    });
  }

  function formatFileSize(bytes) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  }

  function showStatus(message, type) {
    const statusMessage = document.getElementById("statusMessage");
    if (!statusMessage) return;
    statusMessage.textContent = message;
    statusMessage.className = `status show ${type}`;
  }

  function clearStatus() {
    const statusMessage = document.getElementById("statusMessage");
    if (!statusMessage) return;
    statusMessage.textContent = "";
    statusMessage.className = "status";
  }
})();
