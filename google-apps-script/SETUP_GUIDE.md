# APEX INFRASTRUCTURE — Google Apps Script Deployment Guide

This guide walks you through connecting the APEX INFRASTRUCTURE website contact form to the target Google Sheet using Google Apps Script.

---

## 1. Target Google Sheet
- **Google Sheet URL:** [https://docs.google.com/spreadsheets/d/1hRUWN2PW-Tglf9a_6ZyrZlAM3sEPi3yBUtSpzLTUnPk/edit](https://docs.google.com/spreadsheets/d/1hRUWN2PW-Tglf9a_6ZyrZlAM3sEPi3yBUtSpzLTUnPk/edit)
- **Google Sheet ID:** `1hRUWN2PW-Tglf9a_6ZyrZlAM3sEPi3yBUtSpzLTUnPk`
- **Columns (A to H):**
  1. **A:** Submission ID
  2. **B:** Name
  3. **C:** Phone Number
  4. **D:** Email ID
  5. **E:** Company Name
  6. **F:** Project Type
  7. **G:** Project Location
  8. **H:** Estimation Budget

---

## 2. Deploying Google Apps Script (Step-by-Step)

### Step 1: Open Google Apps Script
1. Open the Google Sheet in your web browser:
   `https://docs.google.com/spreadsheets/d/1hRUWN2PW-Tglf9a_6ZyrZlAM3sEPi3yBUtSpzLTUnPk/edit`
2. In the top menu bar, click **Extensions** > **Apps Script**.
3. A new tab will open with the Apps Script code editor.

### Step 2: Paste the Script Code
1. Delete any sample code inside `Code.gs`.
2. Open the file [`google-apps-script/Code.gs`](./Code.gs) in this repository and copy its entire contents.
3. Paste the contents into the Apps Script editor.
4. Click the **Save** icon (diskette icon) or press `Ctrl + S`.
5. You can rename the project at the top to `APEX INFRASTRUCTURE Form Webhook`.

### Step 3: Deploy as a Web App
1. In the top-right corner of the Apps Script editor, click **Deploy** > **New deployment**.
2. Next to "Select type", click the **gear icon** (⚙️) and select **Web app**.
3. Configure the following deployment settings:
   - **Description:** `Apex Infrastructure Contact Form v1`
   - **Execute as:** `Me (your Google account email)` *(CRITICAL: This allows the script to write to your sheet without exposing credentials)*
   - **Who has access:** `Anyone` *(CRITICAL: This allows the contact form submissions to reach the script securely)*
4. Click **Deploy**.
5. If prompted, click **Authorize access**:
   - Choose your Google account.
   - If you see "Google hasn't verified this app", click **Advanced** -> **Go to APEX INFRASTRUCTURE Form Webhook (unsafe)**.
   - Click **Allow**.

### Step 4: Copy the Web App URL
1. Once deployed, you will see a window with **Web app URL**:
   It will look like:
   `https://script.google.com/macros/s/AKfycb.../exec`
2. Copy this URL.

---

## 3. Connecting to the APEX Website

### Option A: Using the Node.js Server (`server.js`) — Recommended
1. In the project root folder, open or create the `.env` file.
2. Set the `GOOGLE_SHEETS_WEBHOOK_URL` variable to your copied Web App URL:
   ```env
   PORT=3000
   GOOGLE_SHEETS_WEBHOOK_URL=https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec
   ```
3. Start the server:
   ```bash
   npm start
   ```
4. The server will now securely proxy all `/api/quote` submissions to Google Sheets, acquire the unique `APX-XXXX` ID, and return it to the website.

### Option B: Direct Frontend Integration (For Static Hosting / CDN / GitHub Pages)
If you deploy the website without the Node.js server (e.g. Netlify, Vercel, GitHub Pages), you can provide the Web App URL directly in `public/js/app.js` or in `window.GOOGLE_SCRIPT_URL`:
```html
<script>
  window.GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec';
</script>
```
The frontend automatically falls back to direct Apps Script submission if configured.

---

## 4. Verification & Testing

1. Submit a test enquiry via the website form.
2. Verify that:
   - Submit button disables and displays "Submitting...".
   - The enquiry receives the next sequential ID (e.g., `APX-0001`).
   - The row is appended to the Google Sheet under columns A through H.
   - The success modal appears showing:
     - **Thank You!**
     - **Your enquiry has been successfully submitted to APEX INFRASTRUCTURE.**
     - **Submission ID: APX-0001**
     - **Please keep this Submission ID for future communication.**
     - **Back to Home** button.
