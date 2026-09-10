/**
 * ============================================================================
 * APEX INFRASTRUCTURE — Google Apps Script Web App
 * ============================================================================
 * 
 * QUICK SETUP:
 * 1. Open your Google Sheet in your web browser.
 * 2. Click "Extensions" > "Apps Script".
 * 3. Replace any code with this file and click Save.
 * 4. Click "Deploy" > "New deployment" > Select "Web app".
 *    - Execute as: "Me"
 *    - Who has access: "Anyone"
 * 5. Copy the generated Web App URL and use it in your .env or website.
 * 
 * NOTE: When installed via Extensions > Apps Script, this script connects
 * AUTOMATICALLY to your active Google Sheet. No sheet ID or link is required!
 * 
 * EXACT GOOGLE SHEET COLUMNS (Auto-created if sheet is blank):
 * A: Submission ID
 * B: Name
 * C: Phone Number
 * D: Email ID
 * E: Company Name
 * F: Project Type
 * G: Project Location
 * H: Estimation Budget
 * 
 * UNIQUE SUBMISSION ID RULES:
 * 1. Generated strictly on server side using this Apps Script.
 * 2. Format: APX-0001, APX-0002, APX-0003, ...
 * 3. Checks Column A for existing IDs and increments the highest number by 1.
 * 4. LockService is used to prevent duplicate IDs across concurrent submissions.
 * 5. Returns JSON { status: "success", submissionId: "APX-XXXX" }
 * ============================================================================
 */

// OPTIONAL: Leave empty if you installed this via Extensions > Apps Script in your Google Sheet.
// Only enter a Sheet ID if running as an independent standalone script project.
var SPREADSHEET_ID = '';

var SHEET_COLUMNS = [
  'Submission ID',
  'Name',
  'Phone Number',
  'Email ID',
  'Company Name',
  'Project Type',
  'Project Location',
  'Estimation Budget'
];

/**
 * Access the target spreadsheet and the first sheet/tab.
 * Automatically uses the active spreadsheet when bound to a sheet,
 * or falls back to SPREADSHEET_ID / Script Properties for standalone setups.
 */
function getTargetSheet() {
  var ss = null;

  // 1. Primary: Use the active spreadsheet (when opened via Extensions > Apps Script)
  try {
    ss = SpreadsheetApp.getActiveSpreadsheet();
  } catch (err) {
    // Not running as container-bound script
  }

  // 2. Secondary: Check explicit SPREADSHEET_ID variable if configured
  if (!ss && typeof SPREADSHEET_ID === 'string' && SPREADSHEET_ID.trim().length > 0) {
    try {
      ss = SpreadsheetApp.openById(SPREADSHEET_ID.trim());
    } catch (err) {
      // Invalid or inaccessible ID
    }
  }

  // 3. Tertiary: Check Script Properties (Project Settings > Script Properties)
  if (!ss) {
    try {
      var propId = PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID');
      if (propId && propId.trim().length > 0) {
        ss = SpreadsheetApp.openById(propId.trim());
      }
    } catch (err) {
      // Property not found or invalid
    }
  }

  if (!ss) {
    throw new Error('Unable to access Google Sheet. Please install this script directly inside your Google Sheet via Extensions > Apps Script, or specify SPREADSHEET_ID.');
  }

  // Use the existing first sheet/tab
  return ss.getSheets()[0];
}

/**
 * Ensures header row exists in row 1 if sheet is empty.
 */
function ensureHeaderRow(sheet) {
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(SHEET_COLUMNS);
    var headerRange = sheet.getRange(1, 1, 1, SHEET_COLUMNS.length);
    headerRange.setFontWeight('bold');
    headerRange.setBackground('#0f1217');
    headerRange.setFontColor('#f4f6f9');
  } else {
    // Verify first row has headers, if not set them
    var firstRow = sheet.getRange(1, 1, 1, SHEET_COLUMNS.length).getValues()[0];
    var hasHeaders = firstRow.some(function(val) {
      return String(val).trim().length > 0;
    });
    if (!hasHeaders) {
      sheet.getRange(1, 1, 1, SHEET_COLUMNS.length).setValues([SHEET_COLUMNS]);
    }
  }
}

/**
 * Scans Column A for existing APX-XXXX submission IDs,
 * finds the highest existing number, and generates the next unique ID.
 */
function generateNextSubmissionId(sheet) {
  var lastRow = sheet.getLastRow();
  var maxNumber = 0;

  if (lastRow > 0) {
    // Fetch all values in Column A
    var columnAValues = sheet.getRange(1, 1, lastRow, 1).getValues();

    for (var i = 0; i < columnAValues.length; i++) {
      var cellVal = String(columnAValues[i][0]).trim();
      var match = cellVal.match(/^APX-(\d+)$/i);
      if (match) {
        var num = parseInt(match[1], 10);
        if (!isNaN(num) && num > maxNumber) {
          maxNumber = num;
        }
      }
    }
  }

  var nextNumber = maxNumber + 1;
  // Pad with zeroes to at least 4 digits: APX-0001, APX-0002...
  var paddedNumber = ('0000' + nextNumber).slice(-Math.max(4, String(nextNumber).length));
  return 'APX-' + paddedNumber;
}

/**
 * Handles incoming POST requests from the website or backend.
 */
function doPost(e) {
  // 1. Acquire Script Lock to guarantee thread safety against concurrent submissions
  var lock = LockService.getScriptLock();
  // Wait up to 30 seconds for concurrent requests to clear
  var hasLock = lock.tryLock(30000);

  if (!hasLock) {
    return createJsonResponse({
      status: 'error',
      message: 'Server is busy processing enquiries. Please try again in a few moments.'
    });
  }

  try {
    // 2. Parse request payload
    var data = {};
    if (e && e.postData && e.postData.contents) {
      try {
        data = JSON.parse(e.postData.contents);
      } catch (jsonErr) {
        // Fallback for urlencoded data
        data = e.parameter || {};
      }
    } else if (e && e.parameter) {
      data = e.parameter;
    }

    // 3. Extract and sanitize fields
    var name = String(data.name || '').trim();
    var phone = String(data.phone || '').trim();
    var email = String(data.email || '').trim();
    var company = String(data.company || data.companyName || '').trim();
    var projectType = String(data.projectType || '').trim();
    var projectLocation = String(data.projectLocation || '').trim();
    var budget = String(data.estimationBudget || data.estimatedBudget || '').trim();

    // 4. Validate required fields
    var missingFields = [];
    if (!name) missingFields.push('Name');
    if (!phone) missingFields.push('Phone Number');
    if (!email) missingFields.push('Email ID');
    if (!projectType) missingFields.push('Project Type');
    if (!projectLocation) missingFields.push('Project Location');
    if (!budget) missingFields.push('Estimation Budget');

    if (missingFields.length > 0) {
      return createJsonResponse({
        status: 'error',
        message: 'Missing required fields: ' + missingFields.join(', ')
      });
    }

    // Validate email format
    var emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return createJsonResponse({
        status: 'error',
        message: 'Invalid email address format.'
      });
    }

    // 5. Open target sheet and ensure headers
    var sheet = getTargetSheet();
    ensureHeaderRow(sheet);

    // 6. Generate next unique Submission ID based on highest existing ID in Column A
    var submissionId = generateNextSubmissionId(sheet);

    // 7. Assemble exact row mapping:
    // Column A: Submission ID
    // Column B: Name
    // Column C: Phone Number
    // Column D: Email ID
    // Column E: Company Name
    // Column F: Project Type
    // Column G: Project Location
    // Column H: Estimation Budget
    var row = [
      submissionId,
      name,
      phone,
      email,
      company,
      projectType,
      projectLocation,
      budget
    ];

    sheet.appendRow(row);

    // Force commit to ensure row is written before releasing lock
    SpreadsheetApp.flush();

    // 8. Return success response with generated Submission ID
    return createJsonResponse({
      status: 'success',
      submissionId: submissionId,
      message: 'Your enquiry has been successfully submitted to APEX INFRASTRUCTURE.'
    });

  } catch (error) {
    return createJsonResponse({
      status: 'error',
      message: 'Unable to submit your enquiry right now. Please try again. (' + error.message + ')'
    });
  } finally {
    // Always release lock
    lock.releaseLock();
  }
}

/**
 * Handles GET requests (Health check / status inspection)
 */
function doGet(e) {
  try {
    var sheet = getTargetSheet();
    var lastRow = sheet.getLastRow();
    return createJsonResponse({
      status: 'ok',
      message: 'APEX INFRASTRUCTURE Google Sheets API is operational.',
      totalRows: lastRow
    });
  } catch (err) {
    return createJsonResponse({
      status: 'error',
      message: err.message
    });
  }
}

/**
 * Creates JSON text output with MIME type application/json
 */
function createJsonResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
