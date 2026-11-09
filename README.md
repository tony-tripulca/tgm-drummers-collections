# TGM Drummers Collections

Mobile-first collection form with a Google Apps Script integration for saving optional receipt to Google Drive and submitting collection details to Google Forms.

## Project structure

```text
TGM-Drummers-Collections/
├── index.html
├── index.css
├── index.js
├── Code.gs
└── README.md
```

## Frontend setup

1. Open `index.js`.
2. Replace `YOUR_APPS_SCRIPT_WEB_APP_URL` with the deployed Apps Script Web App URL ending in `/exec`.
3. Keep `index.html`, `index.css`, and `index.js` in the same folder.
4. Open `index.html` in a modern browser, or host the folder on a static web host.

## Apps Script setup

1. Visit https://script.google.com and create a new project.
2. Copy the contents of `Code.gs` into the Apps Script editor.
3. In `Code.gs`, configure:
   - `DRIVE_FOLDER_ID`: the ID from the destination Google Drive folder URL.
   - `GOOGLE_FORM_RESPONSE_URL`: the Google Form responder URL ending in `/formResponse`.
   - `FORM_ENTRY_IDS`: the actual `entry.xxxxx` identifiers for Name, Amount, Payment Method, Notes, and Receipt.
4. Save the project.
5. Select **Deploy → New deployment → Web app**.
6. Set **Execute as** to **Me**.
7. Set access according to your intended audience. For a public form, choose **Anyone** if available in your account/organization.
8. Deploy, authorize the requested Google permissions, and copy the Web App URL ending in `/exec`.
9. Paste that URL into `CONFIG.appsScriptUrl` in `index.js`.

## Finding Google Form entry IDs

Open the Google Form's responder page, inspect the page source or browser developer tools, and identify the `entry.xxxxx` field name associated with each question. Use the exact IDs in `FORM_ENTRY_IDS`. The Apps Script submits the form's text answers to the responder `/formResponse` endpoint.

The Google Form should have compatible questions for Name, Amount, Payment Method, Notes, and **Receipt**. Add a short-answer question named `Receipt` to the Google Form and put its `entry.xxxxx` identifier in `FORM_ENTRY_IDS.receipt`. Apps Script saves the uploaded image to Drive, obtains its file URL, and submits that URL into the Receipt form field. If no evidence image is attached, the Receipt field is submitted as blank.

## Finding the Drive folder ID

Open the destination folder in Google Drive. Its URL will look similar to:

```text
https://drive.google.com/drive/folders/FOLDER_ID_HERE
```

Copy the folder ID portion into `DRIVE_FOLDER_ID`.

## Evidence upload behavior

- Evidence is optional and accepts image files.
- The browser displays a temporary local preview before submission.
- On submission, the selected image is encoded as Base64 and sent in the POST payload.
- Apps Script decodes the image and creates a file in the configured Drive folder.
- The saved Google Drive file URL is submitted to the Google Form field named `Receipt`; it is not displayed in the app.
- The current client and Apps Script limit is 5 MB per evidence image.

## Important browser/CORS behavior

The frontend uses `fetch()` with `mode: "no-cors"` and a `text/plain` JSON body to avoid a CORS preflight when calling Apps Script. Browsers return an opaque response in this mode. Therefore, the page can indicate that the request was sent, but it cannot read the Apps Script success/error response or guarantee that both Drive and Forms processing completed.

For production use, add a verification method or use a same-origin proxy / supported CORS architecture if the UI must display a confirmed server-side result. Avoid telling users that a record is saved based only on the browser's fetch promise resolving.

## Security and operational notes

- A public Apps Script URL can be called by anyone who obtains it. Validate data server-side and consider abuse controls before public deployment.
- The Apps Script runs as the deploying Google account and writes files into that account's Drive.
- Do not put passwords, OAuth tokens, or private credentials in frontend JavaScript.
- Apps Script and Drive quotas apply to the Google account.
- Test with a dedicated form and Drive folder before using real collection records.
- The sample account details and QR image paths in the HTML are placeholders; replace them before publishing.

## Current scope

Included:
- Name dropdown
- Preset amounts and custom amount
- Payment method dropdown with conditional details
- Optional receipt image upload/capture and local preview
- Optional notes
- Google Apps Script POST integration scaffold
- Google Drive image saving
- Google Forms text-field submission

Not included:
- Collection dashboard/history
- Authentication or role-based access
- Duplicate submission protection
- Server-side confirmation displayed in the browser
- Displaying the Receipt URL in the app
