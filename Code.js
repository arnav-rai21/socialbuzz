const ADMIN_EMAIL      = 'sachitanand.rai@timesinternet.in';
const EVENTS_LIST_KEY  = 'EVENTS_LIST';
const REPORT_SHEET_ID  = '1mdoDi-rL-lTmywgpsUGsYD9jQl8cogeia4WTNhiqtD4';
const REPORT_SHEET_TAB = 'EventDashboard';
const VERCEL_URL       = '';  // to be filled after Vercel deploy

// ── Key helpers ───────────────────────────────────────────────────────────────

function eventConfigKey_(slug) {
  return 'EVENT_CONFIG_' + (slug || 'default');
}

// ── Entry point: GET ──────────────────────────────────────────────────────────

function doGet(e) {
  var params = (e && e.parameter) || {};

  // LinkedIn OAuth success callback
  if (params.code && params.state) {
    return handleLinkedInCallback_(params.code, params.state);
  }

  // LinkedIn OAuth error callback
  if (params.error && params.state) {
    var errMsg = params.error_description
      ? decodeURIComponent(String(params.error_description).replace(/\+/g, ' '))
      : String(params.error);
    PropertiesService.getScriptProperties().deleteProperty('LI_STATE_' + params.state);
    return HtmlService.createHtmlOutput(buildPopupHtml_('error', errMsg, params.state));
  }

  // Social-share OG preview page
  if (params.share) {
    return serveSocialPreviewPage_(params.share);
  }

  // JSON API — bootstrap data
  if (params.action === 'bootstrap') {
    var eventSlug = params.event || 'default';
    var mode      = params.mode  || '';
    return ContentService.createTextOutput(
      JSON.stringify({ success: true, data: getBootstrapData_(eventSlug, mode) })
    ).setMimeType(ContentService.MimeType.JSON);
  }

  // JSON API — action via GET (Vercel proxy uses this to avoid POST redirect issues)
  if (params.apiAction) {
    try {
      var body   = JSON.parse(decodeURIComponent(params.apiAction));
      var result = dispatchAction_(body);
      return ContentService.createTextOutput(JSON.stringify({ success: true, data: result }))
        .setMimeType(ContentService.MimeType.JSON);
    } catch(err) {
      return ContentService.createTextOutput(JSON.stringify({ success: false, error: err.message || String(err) }))
        .setMimeType(ContentService.MimeType.JSON);
    }
  }

  // Main app
  var eventSlug = params.event || 'default';
  var mode      = params.mode  || '';
  var bootstrap = getBootstrapData_(eventSlug, mode);

  var content = HtmlService.createHtmlOutputFromFile('index').getContent();
  content = content.replace(
    'window.__GAS_BOOTSTRAP__=null;',
    'window.__GAS_BOOTSTRAP__=' + JSON.stringify(bootstrap) + ';'
  );
  return HtmlService.createHtmlOutput(content)
    .setTitle('ETB2B Events Platform')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

// ── Entry point: POST ─────────────────────────────────────────────────────────

function dispatchAction_(body) {
  var action = body.action;
  switch (action) {
    case 'saveTemplate':             return saveTemplateConfig(body.payload);
    case 'uploadImage':              return uploadImageToDrive(body.base64Data, body.profile);
    case 'logShare':                 return logShareEvent(body.data);
    case 'getEventsList':            return getEventsList();
    case 'createEvent':              return createEvent(body.slug, body.name);
    case 'deleteEvent':              return deleteEvent(body.slug);
    case 'getEventStats':            return getEventStats(body.slug);
    case 'getLinkedInAuthUrl':       return getLinkedInAuthUrl();
    case 'handleLinkedInCallback':   return handleLinkedInCallbackPost_(body.code, body.state);
    case 'postToLinkedIn':           return postToLinkedIn(body.state, body.imageUrl, body.caption);
    case 'checkLinkedInToken':       return checkLinkedInToken(body.state);
    case 'storeGoogleSession':       return storeGoogleSession(body);
    case 'checkGoogleToken':         return checkGoogleToken(body.state);
    case 'checkAdminAccess':         return checkAdminAccess(body.email);
    case 'requestAdminAccess':       return requestAdminAccess(body.email, body.name);
    case 'getPendingRequests':       return getPendingAccessRequests(body.adminEmail);
    case 'approveAccessRequest':     return approveAccessRequest(body.email, body.adminEmail);
    case 'denyAccessRequest':        return denyAccessRequest(body.email, body.adminEmail);
    case 'revokeAdminAccess':        return revokeAdminAccess(body.email, body.adminEmail);
    default: throw new Error('Unknown action: ' + action);
  }
}

function doPost(e) {
  try {
    var body = JSON.parse(e.postData.contents);
    return jsonOk_(dispatchAction_(body));
  } catch (err) {
    return jsonErr_(err.message || String(err));
  }
}

function jsonOk_(data) {
  return ContentService.createTextOutput(JSON.stringify({ success: true, data: data }))
    .setMimeType(ContentService.MimeType.JSON);
}

function jsonErr_(msg) {
  return ContentService.createTextOutput(JSON.stringify({ success: false, error: msg }))
    .setMimeType(ContentService.MimeType.JSON);
}

// ── Bootstrap ─────────────────────────────────────────────────────────────────

function getBootstrapData_(eventSlug, mode) {
  var slug = eventSlug || 'default';
  var props = PropertiesService.getScriptProperties();
  var result = {
    userEmail:           '',
    adminEmail:          ADMIN_EMAIL,
    isAuthorized:        true,
    eventSlug:           slug,
    mode:                mode || '',
    templateConfig:      loadTemplateConfig_(slug),
    linkedInRedirectUri: getLinkedInRedirectUri_(),
    googleClientId:      props.getProperty('GOOGLE_CLIENT_ID')    || '',
    googleRedirectUri:   props.getProperty('GOOGLE_REDIRECT_URI') || '',
  };
  if (mode === 'admin') {
    result.eventsList = getEventsList().events || [];
  }
  return result;
}

// ── Event Management ──────────────────────────────────────────────────────────

function getEventsList() {
  var props = PropertiesService.getScriptProperties();
  var raw   = props.getProperty(EVENTS_LIST_KEY);
  var list  = [];
  try { list = raw ? JSON.parse(raw) : []; } catch(e) {}
  return { events: list };
}

function createEvent(slug, name) {
  if (!slug || !name) throw new Error('slug and name are required');
  slug = String(slug).toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
  if (!slug) throw new Error('Invalid slug');
  var props = PropertiesService.getScriptProperties();
  var raw   = props.getProperty(EVENTS_LIST_KEY);
  var list  = [];
  try { list = raw ? JSON.parse(raw) : []; } catch(e) {}
  if (list.some(function(e) { return e.slug === slug; })) throw new Error('Event with this slug already exists');
  var now = new Date().toISOString();
  list.push({ slug: slug, name: String(name), createdAt: now, updatedAt: now });
  props.setProperty(EVENTS_LIST_KEY, JSON.stringify(list));
  var emptyConfig = {
    cloudinaryUrl: null, cloudinaryPublicId: null, templateName: '',
    imageSlot: { x: 880, y: 640, width: 520, height: 520, radius: 32 },
    textSlot: null, fontSettings: null, sharingSettings: null,
    updatedAt: now
  };
  props.setProperty(eventConfigKey_(slug), JSON.stringify(emptyConfig));
  return { success: true, slug: slug, name: String(name) };
}

function deleteEvent(slug) {
  if (!slug || slug === 'default') throw new Error('Cannot delete the default event');
  var props = PropertiesService.getScriptProperties();
  var raw   = props.getProperty(EVENTS_LIST_KEY);
  var list  = [];
  try { list = raw ? JSON.parse(raw) : []; } catch(e) {}
  list = list.filter(function(e) { return e.slug !== slug; });
  props.setProperty(EVENTS_LIST_KEY, JSON.stringify(list));
  props.deleteProperty(eventConfigKey_(slug));
  return { success: true };
}

function getEventStats(slug) {
  var targetSlug = slug || 'default';
  try {
    var ss    = SpreadsheetApp.openById(REPORT_SHEET_ID);
    var sheet = ss.getSheetByName(REPORT_SHEET_TAB);
    var last  = sheet.getLastRow();
    if (last <= 1) return { totalGenerates: 0, totalShares: 0, byPlatform: {}, recentUsers: [] };
    var data = sheet.getRange(2, 1, last - 1, 10).getValues();
    var totalGenerates = 0, totalShares = 0;
    var byPlatform = {};
    var recentUsers = [];
    // Col indices (0-based): 0=Timestamp, 1=EventType, 2=EventSlug, 3=Name, 4=Designation, 5=Company, 6=Email, 7=Platform, 8=ImageURL, 9=Caption
    for (var i = 0; i < data.length; i++) {
      var row = data[i];
      var rowSlug = String(row[2] || '');
      if (rowSlug !== targetSlug) continue;
      var eventType = String(row[1] || '');
      if (eventType === 'Generated') totalGenerates++;
      if (eventType === 'Shared')    totalShares++;
      var platform = String(row[7] || '');
      if (eventType === 'Shared' && platform) {
        byPlatform[platform] = (byPlatform[platform] || 0) + 1;
      }
      if (recentUsers.length < 20) {
        recentUsers.push({
          timestamp: String(row[0] || ''),
          eventType: eventType,
          name:      String(row[3] || ''),
          company:   String(row[5] || ''),
          email:     String(row[6] || ''),
          platform:  platform
        });
      }
    }
    return { totalGenerates: totalGenerates, totalShares: totalShares, byPlatform: byPlatform, recentUsers: recentUsers.reverse() };
  } catch(e) {
    Logger.log('getEventStats error: ' + e.message);
    return { totalGenerates: 0, totalShares: 0, byPlatform: {}, recentUsers: [] };
  }
}

// ── Template Config ───────────────────────────────────────────────────────────

function loadTemplateConfig_(eventSlug) {
  var slug = eventSlug || 'default';
  var props = PropertiesService.getScriptProperties();
  var raw = props.getProperty(eventConfigKey_(slug));

  // Migration fallback: if EVENT_CONFIG_default not found, try legacy key
  if (!raw && slug === 'default') {
    raw = props.getProperty('PROMO_TEMPLATE_CONFIG_V1');
  }

  var empty = {
    hasTemplate: false, templateName: '', templateDataUrl: '',
    imageSlot: { x: 880, y: 640, width: 520, height: 520, radius: 32 },
    updatedAt: '', fontSettings: null, sharingSettings: null
  };

  if (!raw) return empty;

  var stored;
  try { stored = JSON.parse(raw); } catch(e) { return empty; }

  var templateDataUrl = '';
  var templateName = stored.templateName || '';

  if (stored.cloudinaryUrl) {
    try {
      var resp = UrlFetchApp.fetch(stored.cloudinaryUrl, { muteHttpExceptions: true });
      if (resp.getResponseCode() === 200) {
        var ct = (resp.getHeaders()['Content-Type'] || 'image/png').split(';')[0];
        templateDataUrl = 'data:' + ct + ';base64,' + Utilities.base64Encode(resp.getContent());
      }
    } catch(e) { Logger.log('Cloudinary fetch error: ' + e); }
  }

  if (!templateDataUrl) return empty;

  var result = {
    hasTemplate: true, templateName: templateName, templateDataUrl: templateDataUrl,
    imageSlot: stored.imageSlot || { x: 880, y: 640, width: 520, height: 520, radius: 32 },
    updatedAt: stored.updatedAt || ''
  };
  if (stored.textSlot)        result.textSlot        = stored.textSlot;
  if (stored.fontSettings)    result.fontSettings    = stored.fontSettings;
  if (stored.sharingSettings) result.sharingSettings = stored.sharingSettings;
  return result;
}

function saveTemplateConfig(payload) {
  assertAuthorized_();
  if (!payload)                   throw new Error('No payload provided.');
  if (!payload.templateDataUrl)   throw new Error('Template image is required.');

  var eventSlug = payload.eventSlug || 'default';
  var fileName  = payload.fileName  || ('template_' + eventSlug + '.png');
  var imageSlot = sanitizeImageSlot_(payload.imageSlot);

  var match = String(payload.templateDataUrl).match(/^data:[^;]+;base64,(.+)$/);
  if (!match) throw new Error('Invalid template image format.');
  var base64Data = match[1];

  var props   = PropertiesService.getScriptProperties();
  var rawOld  = props.getProperty(eventConfigKey_(eventSlug));
  var stored  = null;
  try { stored = rawOld ? JSON.parse(rawOld) : null; } catch(e) {}

  var existingPublicId = stored && stored.cloudinaryPublicId ? stored.cloudinaryPublicId : null;
  var result = uploadToCloudinary_(base64Data, existingPublicId);

  props.setProperty(eventConfigKey_(eventSlug), JSON.stringify({
    cloudinaryUrl:      result.secure_url,
    cloudinaryPublicId: result.public_id,
    templateName:       fileName,
    imageSlot:          imageSlot,
    textSlot:           payload.textSlot           || null,
    fontSettings:       payload.fontSettings       || null,
    sharingSettings:    payload.sharingSettings    || null,
    updatedAt:          new Date().toISOString()
  }));

  // Update updatedAt in events list
  var eventsRaw = props.getProperty(EVENTS_LIST_KEY);
  var events = [];
  try { events = eventsRaw ? JSON.parse(eventsRaw) : []; } catch(e) {}
  var found = false;
  events = events.map(function(ev) {
    if (ev.slug === eventSlug) { found = true; return Object.assign({}, ev, { updatedAt: new Date().toISOString() }); }
    return ev;
  });
  if (!found && eventSlug === 'default') {
    events.unshift({ slug: 'default', name: 'Default Event', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
    props.setProperty(EVENTS_LIST_KEY, JSON.stringify(events));
  } else if (found) {
    props.setProperty(EVENTS_LIST_KEY, JSON.stringify(events));
  }

  return loadTemplateConfig_(eventSlug);
}

// ── Generated image upload ────────────────────────────────────────────────────

function uploadImageToDrive(base64Data, profile) {
  assertAuthorized_();
  if (!base64Data) throw new Error('Generated image is missing.');
  var eventSlug = (profile && profile.eventSlug) || 'default';
  var safeName  = ((profile && profile.name) ? profile.name : 'social_post')
    .replace(/[\W]/g, '').trim().replace(/\s+/g, '_') || 'social_post';
  var result   = uploadToCloudinary_(base64Data, null);
  var shareUrl = ScriptApp.getService().getUrl() + '?share=' + encodeURIComponent(result.secure_url);
  logToSheet_('Generated', eventSlug,
    String((profile && profile.name)    || ''),
    String((profile && profile.title)   || ''),
    String((profile && profile.company) || ''),
    String((profile && profile.email)   || ''),
    '', result.secure_url, '');
  return { fileId: result.public_id, fileName: safeName + '.png',
           driveUrl: result.url, publicUrl: shareUrl, imageUrl: result.secure_url };
}

// ── Share event logging ───────────────────────────────────────────────────────

function logShareEvent(data) {
  if (!data) return { success: true };
  logToSheet_('Shared', String(data.eventSlug || 'default'),
    String(data.name        || ''),
    String(data.designation || ''),
    String(data.company     || ''),
    String(data.email       || ''),
    String(data.platform    || ''),
    String(data.imageUrl    || ''),
    String(data.caption     || ''));
  return { success: true };
}

// ── Sheet logging ─────────────────────────────────────────────────────────────

// Run once from the GAS editor to authorize the Sheets scope.
function authorizeSheets() {
  logToSheet_('Test', 'default', 'Auth check', '', '', '', '', '', '');
  var ss = SpreadsheetApp.openById(REPORT_SHEET_ID);
  var sheet = ss.getSheetByName(REPORT_SHEET_TAB);
  var last = sheet.getLastRow();
  if (last > 1) sheet.deleteRow(last);
  Logger.log('Sheets authorization successful.');
}

var SHEET_HEADERS = ['Timestamp', 'Event', 'Event Slug', 'Name', 'Designation', 'Company', 'Email', 'Platform', 'Image URL', 'Caption'];

function logToSheet_(event, eventSlug, name, designation, company, email, platform, imageUrl, caption) {
  try {
    var ss    = SpreadsheetApp.openById(REPORT_SHEET_ID);
    var sheet = ss.getSheetByName(REPORT_SHEET_TAB);
    if (sheet.getLastRow() === 0) {
      sheet.appendRow(SHEET_HEADERS);
      sheet.getRange(1, 1, 1, SHEET_HEADERS.length).setFontWeight('bold').setBackground('#4f46e5').setFontColor('#ffffff');
      sheet.setFrozenRows(1);
    }
    var now = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'dd-MMM-yyyy HH:mm:ss');
    sheet.appendRow([now, event, eventSlug, name, designation, company, email, platform, imageUrl, caption]);
  } catch(e) { Logger.log('Sheet log failed: ' + e.message); }
}

// ── Google OAuth + Access Management ─────────────────────────────────────────

function isApprovedAdmin_(email) {
  if (!email) return false;
  if (email.toLowerCase() === ADMIN_EMAIL.toLowerCase()) return true;
  var props = PropertiesService.getScriptProperties();
  var raw = props.getProperty('APPROVED_ADMINS');
  var list = [];
  try { list = raw ? JSON.parse(raw) : []; } catch(e) {}
  return list.map(function(e) { return e.toLowerCase(); }).indexOf(email.toLowerCase()) !== -1;
}

function storeGoogleSession(body) {
  var state = body.state, email = body.email, name = body.name;
  if (!state || !email) throw new Error('Missing state or email.');
  PropertiesService.getScriptProperties()
    .setProperty('GOOGLE_SESSION_' + state, JSON.stringify({ email: email, name: name || email, storedAt: Date.now() }));
  return { success: true };
}

function checkGoogleToken(state) {
  if (!state) return { ready: false };
  var props = PropertiesService.getScriptProperties();
  var raw = props.getProperty('GOOGLE_SESSION_' + state);
  if (!raw) return { ready: false };
  var session = {};
  try { session = JSON.parse(raw); } catch(e) { return { ready: false }; }
  props.deleteProperty('GOOGLE_SESSION_' + state);
  return { ready: true, email: session.email || '', name: session.name || '', approved: isApprovedAdmin_(session.email) };
}

function checkAdminAccess(email) {
  return { approved: isApprovedAdmin_(email) };
}

function requestAdminAccess(email, name) {
  if (!email || !String(email).endsWith('@timesinternet.in')) throw new Error('Only @timesinternet.in accounts can request access.');
  var props = PropertiesService.getScriptProperties();
  var raw = props.getProperty('ACCESS_REQUESTS');
  var requests = [];
  try { requests = raw ? JSON.parse(raw) : []; } catch(e) {}
  var alreadyPending = requests.some(function(r) { return r.email.toLowerCase() === email.toLowerCase() && r.status === 'pending'; });
  if (alreadyPending) return { success: true, alreadyPending: true };
  requests = requests.filter(function(r) { return r.email.toLowerCase() !== email.toLowerCase(); });
  requests.push({ email: email, name: name || email, requestedAt: new Date().toISOString(), status: 'pending' });
  props.setProperty('ACCESS_REQUESTS', JSON.stringify(requests));
  return { success: true };
}

function getPendingAccessRequests(adminEmail) {
  if (!isApprovedAdmin_(adminEmail)) throw new Error('Not authorized.');
  var props = PropertiesService.getScriptProperties();
  var raw = props.getProperty('ACCESS_REQUESTS');
  var requests = [];
  try { requests = raw ? JSON.parse(raw) : []; } catch(e) {}
  var approvedRaw = props.getProperty('APPROVED_ADMINS');
  var approvedList = [];
  try { approvedList = approvedRaw ? JSON.parse(approvedRaw) : []; } catch(e) {}
  return { requests: requests, approvedAdmins: approvedList };
}

function approveAccessRequest(email, adminEmail) {
  if (!isApprovedAdmin_(adminEmail)) throw new Error('Not authorized.');
  var props = PropertiesService.getScriptProperties();
  var approvedRaw = props.getProperty('APPROVED_ADMINS');
  var approved = [];
  try { approved = approvedRaw ? JSON.parse(approvedRaw) : []; } catch(e) {}
  if (approved.map(function(e) { return e.toLowerCase(); }).indexOf(email.toLowerCase()) === -1) {
    approved.push(email.toLowerCase());
  }
  props.setProperty('APPROVED_ADMINS', JSON.stringify(approved));
  var raw = props.getProperty('ACCESS_REQUESTS');
  var requests = [];
  try { requests = raw ? JSON.parse(raw) : []; } catch(e) {}
  requests = requests.map(function(r) { if (r.email.toLowerCase() === email.toLowerCase()) r.status = 'approved'; return r; });
  props.setProperty('ACCESS_REQUESTS', JSON.stringify(requests));
  return { success: true };
}

function denyAccessRequest(email, adminEmail) {
  if (!isApprovedAdmin_(adminEmail)) throw new Error('Not authorized.');
  var props = PropertiesService.getScriptProperties();
  var raw = props.getProperty('ACCESS_REQUESTS');
  var requests = [];
  try { requests = raw ? JSON.parse(raw) : []; } catch(e) {}
  requests = requests.map(function(r) { if (r.email.toLowerCase() === email.toLowerCase()) r.status = 'denied'; return r; });
  props.setProperty('ACCESS_REQUESTS', JSON.stringify(requests));
  return { success: true };
}

function revokeAdminAccess(email, adminEmail) {
  if (!isApprovedAdmin_(adminEmail)) throw new Error('Not authorized.');
  if (email.toLowerCase() === ADMIN_EMAIL.toLowerCase()) throw new Error('Cannot revoke super-admin access.');
  var props = PropertiesService.getScriptProperties();
  var approvedRaw = props.getProperty('APPROVED_ADMINS');
  var approved = [];
  try { approved = approvedRaw ? JSON.parse(approvedRaw) : []; } catch(e) {}
  approved = approved.filter(function(e) { return e.toLowerCase() !== email.toLowerCase(); });
  props.setProperty('APPROVED_ADMINS', JSON.stringify(approved));
  return { success: true };
}

// ── Auth + Helpers ────────────────────────────────────────────────────────────

function assertAuthorized_() {
  if (!isAuthorizedUser_()) throw new Error('Not authorized.');
}

function isAuthorizedUser_() { return true; }

function getCurrentUserEmail_() {
  try { return Session.getActiveUser().getEmail() || ''; } catch(e) { return ''; }
}

function defaultImageSlot_() { return { x: 880, y: 640, width: 520, height: 520, radius: 32 }; }

function sanitizeImageSlot_(slot) {
  if (!slot) return defaultImageSlot_();
  return {
    x:      Math.max(0, parseInt(slot.x)      || 0),
    y:      Math.max(0, parseInt(slot.y)      || 0),
    width:  Math.max(10, parseInt(slot.width)  || 520),
    height: Math.max(10, parseInt(slot.height) || 520),
    radius: Math.max(0, parseInt(slot.radius)  || 0)
  };
}

// ── Social OG preview page ────────────────────────────────────────────────────

function serveSocialPreviewPage_(imageUrl) {
  var decoded = decodeURIComponent(imageUrl);
  var html = '<!DOCTYPE html><html><head><meta charset="UTF-8"><meta property="og:image" content="' + decoded + '"><meta property="og:type" content="website"><meta property="og:title" content="My Social Media Post"><meta name="twitter:card" content="summary_large_image"><meta name="twitter:image" content="' + decoded + '"><title>Social Post Preview</title></head><body style="margin:0;background:#0f172a;display:flex;align-items:center;justify-content:center;min-height:100vh"><img src="' + decoded + '" style="max-width:100%;max-height:100vh;border-radius:12px;box-shadow:0 25px 60px rgba(0,0,0,0.5)"></body></html>';
  return HtmlService.createHtmlOutput(html).setTitle('Social Post').setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

// ── Cloudinary upload ─────────────────────────────────────────────────────────

function uploadToCloudinary_(base64Data, existingPublicId) {
  var props     = PropertiesService.getScriptProperties();
  var cloudName = props.getProperty('CLOUDINARY_CLOUD_NAME');
  var apiKey    = props.getProperty('CLOUDINARY_API_KEY');
  var apiSecret = props.getProperty('CLOUDINARY_API_SECRET');
  if (!cloudName || !apiKey || !apiSecret) {
    throw new Error(
      'Cloudinary credentials not found. Add CLOUDINARY_CLOUD_NAME, ' +
      'CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET in GAS → Project Settings → Script properties.'
    );
  }

  var folder    = 'etb2b-events';
  var timestamp = Math.floor(Date.now() / 1000);

  var sigParts = 'folder=' + folder + '&timestamp=' + timestamp;
  if (existingPublicId) sigParts = 'overwrite=true&public_id=' + existingPublicId + '&' + sigParts;
  var signature = computeHexDigest_(sigParts + apiSecret);

  var boundary = 'GASBnd' + timestamp;
  var CRLF     = '\r\n';

  function strToBytes_(s) {
    var arr = new Array(s.length);
    for (var i = 0; i < s.length; i++) arr[i] = s.charCodeAt(i) & 0xff;
    return arr;
  }
  function textPart_(name, value) {
    return '--' + boundary + CRLF
      + 'Content-Disposition: form-data; name="' + name + '"' + CRLF + CRLF
      + value + CRLF;
  }

  var imageBytes = Utilities.base64Decode(base64Data);
  if (!imageBytes || !imageBytes.length) throw new Error('base64Decode returned empty data — check the image was exported correctly.');

  var textBlock =
    textPart_('api_key',   apiKey) +
    textPart_('timestamp', String(timestamp)) +
    textPart_('signature', signature) +
    textPart_('folder',    folder);

  if (existingPublicId) {
    textBlock += textPart_('public_id',  existingPublicId);
    textBlock += textPart_('overwrite',  'true');
  }

  textBlock +=
    '--' + boundary + CRLF
    + 'Content-Disposition: form-data; name="file"; filename="upload.png"' + CRLF
    + 'Content-Type: image/png' + CRLF + CRLF;

  var closing = CRLF + '--' + boundary + '--' + CRLF;
  var payload = strToBytes_(textBlock)
    .concat(Array.prototype.slice.call(imageBytes))
    .concat(strToBytes_(closing));

  var response = UrlFetchApp.fetch(
    'https://api.cloudinary.com/v1_1/' + cloudName + '/image/upload',
    {
      method:             'post',
      muteHttpExceptions: true,
      contentType:        'multipart/form-data; boundary=' + boundary,
      payload:            payload
    }
  );
  var result = JSON.parse(response.getContentText());
  if (!result.secure_url) throw new Error('Cloudinary: ' + response.getContentText());
  return result;
}

function computeHexDigest_(message) {
  return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, message, Utilities.Charset.UTF_8)
    .map(function(b) { return ('0' + (b & 0xff).toString(16)).slice(-2); }).join('');
}

// ── LinkedIn OAuth ────────────────────────────────────────────────────────────

function getLinkedInRedirectUri_() {
  var stored = PropertiesService.getScriptProperties().getProperty('LINKEDIN_REDIRECT_URI');
  if (stored && stored.trim()) return stored.trim();
  return VERCEL_URL + '/api/linkedin-callback';
}

function getLinkedInAuthUrl() {
  var props       = PropertiesService.getScriptProperties();
  var clientId    = props.getProperty('LINKEDIN_CLIENT_ID');
  var redirectUri = getLinkedInRedirectUri_();
  if (!clientId) throw new Error('LINKEDIN_CLIENT_ID not set in Script Properties.');

  var state = Utilities.base64Encode(
    Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, String(Date.now() + Math.random()), Utilities.Charset.UTF_8)
  ).replace(/[^a-zA-Z0-9]/g, '').slice(0, 20);

  props.setProperty('LI_STATE_' + state, String(Date.now() + 600000));

  var authUrl = 'https://www.linkedin.com/oauth/v2/authorization' +
    '?response_type=code' +
    '&client_id='    + encodeURIComponent(clientId) +
    '&redirect_uri=' + encodeURIComponent(redirectUri) +
    '&state='        + state +
    '&scope='        + encodeURIComponent('openid profile email');

  return { authUrl: authUrl, state: state, redirectUri: redirectUri };
}

function handleLinkedInCallback_(code, state) {
  var props     = PropertiesService.getScriptProperties();
  var expiry    = props.getProperty('LI_STATE_' + state);
  var isExpired = !expiry || Date.now() > Number(expiry);

  if (isExpired) {
    return HtmlService.createHtmlOutput(buildPopupHtml_('error', 'Authentication failed: session expired.', state));
  }
  props.deleteProperty('LI_STATE_' + state);

  try {
    var tokenData = exchangeLinkedInCode_(code);
    props.setProperty('LI_TOKEN_' + state, JSON.stringify({
      token:   tokenData.access_token,
      expires: Date.now() + (Number(tokenData.expires_in) * 1000)
    }));
    return HtmlService.createHtmlOutput(buildPopupHtml_('success', '', state));
  } catch (e) {
    return HtmlService.createHtmlOutput(buildPopupHtml_('error', String(e.message), state));
  }
}

function buildPopupHtml_(type, errorMsg, state) {
  var isSuccess = (type === 'success');

  var msgPayload = isSuccess
    ? '{type:"linkedin_auth_success",state:"' + state + '"}'
    : '{type:"linkedin_auth_error",error:"'    + errorMsg.replace(/\\/g,'\\\\').replace(/"/g,'\\"').replace(/\n/g,'\\n') + '"}';

  var broadcastJs =
    '(function(){' +
    '  var m=' + msgPayload + ';' +
    '  var ws=[window.opener,window.parent,window.top,' +
    '          window.opener&&window.opener.parent,window.opener&&window.opener.top];' +
    '  for(var i=0;i<ws.length;i++){' +
    '    try{if(ws[i]&&ws[i]!==window)ws[i].postMessage(m,"*");}catch(e){}' +
    '  }' +
    '})();';

  var autoCloseJs =
    'setTimeout(function(){try{window.close();}catch(e){}},800);' +
    'setTimeout(function(){try{window.close();}catch(e){}},2000);';

  var btnJs = isSuccess
    ? 'function doClose(){' + broadcastJs + 'try{window.close();}catch(e){document.getElementById("hint").style.display="block";}}' +
      'document.getElementById("cb").onclick=doClose;'
    : 'document.getElementById("cb").onclick=function(){try{window.close();}catch(e){}};';

  var btnLabel  = isSuccess ? 'Close &amp; Continue' : 'Close';
  var btnColor  = isSuccess ? '#0a66c2' : '#64748b';
  var headText  = isSuccess ? '&#10003; LinkedIn connected!' : '&#10007; ' + errorMsg.replace(/</g,'&lt;').replace(/>/g,'&gt;');
  var subText   = isSuccess ? 'Closing automatically&hellip;' : 'You can close this window.';
  var hintHtml  = isSuccess ? '<p id="hint" style="display:none;font-size:12px;color:#94a3b8;margin-top:8px">Auto-close blocked — click the button above.</p>' : '';

  return '<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<style>' +
    'body{font-family:Inter,Arial,sans-serif;display:flex;align-items:center;justify-content:center;' +
    'min-height:100vh;margin:0;background:#f8fafc;padding:24px;box-sizing:border-box}' +
    '.c{text-align:center;max-width:340px;width:100%}' +
    '.head{font-size:16px;font-weight:700;color:#0f172a;margin:0 0 4px}' +
    '.sub{font-size:13px;color:#94a3b8;margin:0 0 20px}' +
    'button{width:100%;padding:11px 24px;background:' + btnColor + ';color:#fff;border:none;' +
    'border-radius:10px;font-size:14px;font-weight:600;cursor:pointer}' +
    'button:hover{opacity:.9}' +
    '</style></head><body>' +
    '<div class="c">' +
    '<p class="head">' + headText + '</p>' +
    '<p class="sub">' + subText + '</p>' +
    '<button id="cb">' + btnLabel + '</button>' +
    hintHtml +
    '</div>' +
    '<script>' + broadcastJs + autoCloseJs + btnJs + '</script></body></html>';
}

function handleLinkedInCallbackPost_(code, state) {
  var props  = PropertiesService.getScriptProperties();
  var expiry = props.getProperty('LI_STATE_' + state);
  if (!expiry || Date.now() > Number(expiry)) throw new Error('Session expired or invalid state.');
  props.deleteProperty('LI_STATE_' + state);
  var tokenData = exchangeLinkedInCode_(code);
  props.setProperty('LI_TOKEN_' + state, JSON.stringify({
    token:   tokenData.access_token,
    expires: Date.now() + (Number(tokenData.expires_in) * 1000)
  }));
  return { ok: true };
}

function exchangeLinkedInCode_(code) {
  var props        = PropertiesService.getScriptProperties();
  var clientId     = props.getProperty('LINKEDIN_CLIENT_ID');
  var clientSecret = props.getProperty('LINKEDIN_CLIENT_SECRET');
  var redirectUri  = getLinkedInRedirectUri_();

  var response = UrlFetchApp.fetch('https://www.linkedin.com/oauth/v2/accessToken', {
    method: 'post', muteHttpExceptions: true,
    contentType: 'application/x-www-form-urlencoded',
    payload: 'grant_type=authorization_code' +
             '&code='          + encodeURIComponent(code) +
             '&redirect_uri='  + encodeURIComponent(redirectUri) +
             '&client_id='     + encodeURIComponent(clientId) +
             '&client_secret=' + encodeURIComponent(clientSecret)
  });
  var result = JSON.parse(response.getContentText());
  if (!result.access_token) throw new Error('Token exchange failed: ' + response.getContentText());
  return result;
}

// ── LinkedIn post creation ────────────────────────────────────────────────────

function postToLinkedIn(state, imageUrl, caption) {
  var props     = PropertiesService.getScriptProperties();
  var tokenJson = props.getProperty('LI_TOKEN_' + state);
  if (!tokenJson) throw new Error('LinkedIn session not found. Please authenticate again.');

  var tokenData = JSON.parse(tokenJson);
  if (Date.now() > tokenData.expires) throw new Error('LinkedIn session expired. Please authenticate again.');

  var accessToken = tokenData.token;
  props.deleteProperty('LI_TOKEN_' + state);

  var personUrn = getLinkedInPersonUrn_(accessToken);

  var imageBytes;
  if (imageUrl && imageUrl.startsWith('http')) {
    var imgResp = UrlFetchApp.fetch(imageUrl, { muteHttpExceptions: true });
    if (imgResp.getResponseCode() >= 400) throw new Error('Could not fetch image (' + imgResp.getResponseCode() + ').');
    imageBytes = imgResp.getContent();
  } else if (imageUrl) {
    imageBytes = Utilities.base64Decode(imageUrl);
  } else {
    throw new Error('No image data provided for LinkedIn upload.');
  }

  var uploadData = registerLinkedInImageUpload_(accessToken, personUrn);
  uploadLinkedInImage_(uploadData.uploadUrl, uploadData.uploadHeaders, imageBytes);
  var postId = createLinkedInPost_(accessToken, personUrn, uploadData.assetUrn, caption || '');

  return {
    success: true,
    postUrl: 'https://www.linkedin.com/feed/',
    postUrn: postId
  };
}

function getLinkedInPersonUrn_(accessToken) {
  var response = UrlFetchApp.fetch('https://api.linkedin.com/v2/userinfo', {
    headers: { 'Authorization': 'Bearer ' + accessToken }, muteHttpExceptions: true
  });
  var data = JSON.parse(response.getContentText());
  if (!data.sub) throw new Error('Could not retrieve LinkedIn user ID: ' + response.getContentText());
  return 'urn:li:person:' + data.sub;
}

function registerLinkedInImageUpload_(accessToken, personUrn) {
  var response = UrlFetchApp.fetch('https://api.linkedin.com/v2/assets?action=registerUpload', {
    method: 'post', muteHttpExceptions: true,
    headers: { 'Authorization': 'Bearer ' + accessToken, 'Content-Type': 'application/json' },
    payload: JSON.stringify({
      registerUploadRequest: {
        recipes: ['urn:li:digitalmediaRecipe:feedshare-image'],
        owner: personUrn,
        serviceRelationships: [{ relationshipType: 'OWNER', identifier: 'urn:li:userGeneratedContent' }]
      }
    })
  });

  var data;
  try { data = JSON.parse(response.getContentText()); } catch (_) { data = {}; }
  if (!data.value) throw new Error('LinkedIn upload registration failed: ' + response.getContentText());

  var mechanism = data.value.uploadMechanism['com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest'];
  return {
    assetUrn:      data.value.asset,
    uploadUrl:     mechanism.uploadUrl,
    uploadHeaders: mechanism.headers || {}
  };
}

function uploadLinkedInImage_(uploadUrl, extraHeaders, imageBytes) {
  var headers = { 'Content-Type': 'image/png' };
  Object.keys(extraHeaders || {}).forEach(function(k) { headers[k] = extraHeaders[k]; });

  var response = UrlFetchApp.fetch(uploadUrl, {
    method: 'put', muteHttpExceptions: true, headers: headers, payload: imageBytes
  });
  if (response.getResponseCode() >= 400) {
    throw new Error('LinkedIn image upload failed (' + response.getResponseCode() + '): ' + response.getContentText());
  }
}

function createLinkedInPost_(accessToken, personUrn, assetUrn, text) {
  var response = UrlFetchApp.fetch('https://api.linkedin.com/v2/ugcPosts', {
    method: 'post', muteHttpExceptions: true,
    headers: {
      'Authorization': 'Bearer ' + accessToken,
      'Content-Type': 'application/json',
      'X-Restli-Protocol-Version': '2.0.0'
    },
    payload: JSON.stringify({
      author: personUrn,
      lifecycleState: 'PUBLISHED',
      specificContent: {
        'com.linkedin.ugc.ShareContent': {
          shareCommentary: { text: text },
          shareMediaCategory: 'IMAGE',
          media: [{ status: 'READY', media: assetUrn,
            description: { text: '' }, title: { text: 'Social Media Post' } }]
        }
      },
      visibility: { 'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC' }
    })
  });

  if (response.getResponseCode() >= 400) {
    throw new Error('LinkedIn post failed (' + response.getResponseCode() + '): ' + response.getContentText());
  }
  var headers = response.getHeaders();
  return headers['X-RestLi-Id'] || headers['x-restli-id'] || '';
}

function checkLinkedInToken(state) {
  var tokenJson = PropertiesService.getScriptProperties().getProperty('LI_TOKEN_' + state);
  return { ready: !!tokenJson };
}
