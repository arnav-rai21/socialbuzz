(function () {
  'use strict';

  var script   = document.currentScript;
  var slug     = (script && script.getAttribute('data-event'))    || 'default';
  var position = (script && script.getAttribute('data-position')) || 'right';
  var baseUrl  = (script && script.src)
    ? (new URL(script.src)).origin
    : 'https://socialbuzz.vercel.app';

  var SIDE = position === 'left' ? 'left' : 'right';
  var Z    = 2147483647;

  /* CTA button colour — data-color (solid) and optional data-color2 (gradient). */
  var color1 = (script && script.getAttribute('data-color'))  || '';
  var color2 = (script && script.getAttribute('data-color2')) || '';
  function _validHex(c) { return /^#[0-9a-fA-F]{3,8}$/.test(c); }
  var CTA_BG = (_validHex(color1) && _validHex(color2))
    ? 'linear-gradient(135deg,' + color1 + ' 0%,' + color2 + ' 100%)'
    : (_validHex(color1) ? color1 : 'linear-gradient(135deg,#7c3aed 0%,#db2777 100%)');

  /* ── Icons ───────────────────────────────────────────────────── */
  var FAB_ICON_HTML =
    '<svg width="18" height="18" viewBox="0 0 24 24" fill="none"' +
    ' stroke="white" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">' +
    '<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>' +
    '<line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/>' +
    '<line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>' +
    '</svg>' +
    '<span style="font-family:system-ui,-apple-system,sans-serif;font-size:13px;font-weight:700;color:#fff;white-space:nowrap;letter-spacing:-.01em;">Start Social Buzz</span>';

  var SVG_CLOSE_FAB =
    '<svg width="22" height="22" viewBox="0 0 24 24" fill="none"' +
    ' stroke="white" stroke-width="2.5" stroke-linecap="round">' +
    '<line x1="18" y1="6" x2="6" y2="18"/>' +
    '<line x1="6" y1="6" x2="18" y2="18"/>' +
    '</svg>';

  var FAB_CLOSE_HTML =
    '<svg width="20" height="20" viewBox="0 0 24 24" fill="none"' +
    ' stroke="white" stroke-width="2.5" stroke-linecap="round">' +
    '<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>' +
    '</svg>';

  var SVG_CLOSE_HDR =
    '<svg width="16" height="16" viewBox="0 0 24 24" fill="none"' +
    ' stroke="rgba(255,255,255,.85)" stroke-width="2.5" stroke-linecap="round">' +
    '<line x1="18" y1="6" x2="6" y2="18"/>' +
    '<line x1="6" y1="6" x2="18" y2="18"/>' +
    '</svg>';

  var SVG_HELP =
    '<svg width="16" height="16" viewBox="0 0 24 24" fill="none"' +
    ' stroke="rgba(255,255,255,.85)" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">' +
    '<circle cx="12" cy="12" r="10"/>' +
    '<path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/>' +
    '<circle cx="12" cy="17" r=".5" fill="rgba(255,255,255,.85)"/>' +
    '</svg>';

  /* ── Styles ──────────────────────────────────────────────────── */
  var style = document.createElement('style');
  style.textContent =

    /* FAB */
    '#_etbw_btn{' +
      'position:fixed;bottom:24px;' + SIDE + ':24px;' +
      'height:48px;border-radius:50px;' +
      'background:' + CTA_BG + ';' +
      'border:none;outline:none;cursor:pointer;padding:0 20px 0 16px;margin:0;' +
      'box-shadow:0 4px 20px rgba(109,40,217,.45);-webkit-appearance:none;appearance:none;' +
      'z-index:' + Z + ';' +
      'display:flex;align-items:center;justify-content:center;gap:8px;' +
      'transition:transform .2s ease,box-shadow .2s ease;' +
      'flex-shrink:0;' +
    '}' +
    '#_etbw_btn:focus{outline:none;}' +
    '#_etbw_btn:hover{transform:scale(1.04);box-shadow:0 6px 28px rgba(109,40,217,.55);}' +
    '#_etbw_btn._etbw_btn_open{width:48px;padding:0;border-radius:50%;}' +

    /* Panel */
    '#_etbw_panel{' +
      'position:fixed;' + SIDE + ':24px;bottom:84px;' +
      'width:380px;' +
      'height:640px;' +
      'height:min(640px,calc(100vh - 130px));' +
      'border-radius:16px;overflow:hidden;' +
      'display:flex;flex-direction:column;' +
      'box-shadow:0 24px 72px rgba(0,0,0,.22),0 4px 16px rgba(0,0,0,.12);' +
      'z-index:' + (Z - 1) + ';' +
      'opacity:0;transform:scale(.92) translateY(16px);pointer-events:none;' +
      'transition:opacity .28s cubic-bezier(.4,0,.2,1),transform .28s cubic-bezier(.4,0,.2,1);' +
      'transform-origin:bottom ' + SIDE + ';' +
    '}' +
    '#_etbw_panel._etbw_open{opacity:1;transform:scale(1) translateY(0);pointer-events:auto;}' +

    /* Header */
    '#_etbw_hdr{' +
      'flex-shrink:0;height:56px;' +
      'display:flex;align-items:center;justify-content:space-between;' +
      'padding:0 14px;' +
      'background:linear-gradient(135deg,#1e0a4a 0%,#3b0d8a 35%,#6d28d9 70%,#9d174d 100%);' +
    '}' +
    '#_etbw_hdr_l{display:flex;align-items:center;gap:10px;flex:1;min-width:0;}' +
    '#_etbw_hdr_ico{' +
      'width:30px;height:30px;border-radius:8px;flex-shrink:0;' +
      'background:rgba(255,255,255,.15);border:1px solid rgba(255,255,255,.2);' +
      'display:flex;align-items:center;justify-content:center;' +
    '}' +
    '#_etbw_hdr_txt{display:flex;flex-direction:column;gap:1px;min-width:0;}' +
    '#_etbw_hdr_title{font-family:system-ui,-apple-system,sans-serif;font-size:13px;font-weight:800;color:#fff;line-height:1.2;letter-spacing:-.01em;}' +
    '#_etbw_hdr_sub{font-family:system-ui,-apple-system,sans-serif;font-size:10px;color:rgba(255,255,255,.55);line-height:1;}' +
    '#_etbw_hdr_actions{display:flex;align-items:center;gap:6px;flex-shrink:0;}' +
    '#_etbw_hdr_help,#_etbw_hdr_close{' +
      'width:28px;height:28px;border-radius:50%;border:none;cursor:pointer;padding:0;' +
      'background:rgba(255,255,255,.12);' +
      'display:flex;align-items:center;justify-content:center;' +
      'transition:background .15s;' +
    '}' +
    '#_etbw_hdr_help:hover,#_etbw_hdr_close:hover{background:rgba(255,255,255,.24);}' +
    '#_etbw_hdr_help._etbw_help_active{background:rgba(255,255,255,.3);}' +

    /* Iframe body */
    '#_etbw_body{flex:1;overflow:hidden;background:#fff;min-height:0;position:relative;}' +
    '#_etbw_iframe{width:100%;height:100%;border:none;display:block;}' +

    /* Help contact overlay – sits over the iframe body */
    '#_etbw_help_overlay{' +
      'position:absolute;inset:0;' +
      'background:rgba(15,5,40,.6);' +
      'display:none;align-items:center;justify-content:center;' +
      'padding:20px;z-index:10;' +
      'backdrop-filter:blur(2px);' +
    '}' +
    '#_etbw_help_overlay._etbw_open{display:flex;}' +
    '#_etbw_help_card{' +
      'background:#fff;border-radius:16px;width:100%;max-width:280px;overflow:hidden;' +
      'box-shadow:0 16px 48px rgba(0,0,0,.25);' +
    '}' +
    '#_etbw_help_card_top{' +
      'background:linear-gradient(135deg,#1e0a4a 0%,#6d28d9 60%,#9d174d 100%);' +
      'padding:16px 18px 14px;' +
    '}' +
    '#_etbw_help_card_label{' +
      'font-family:system-ui,-apple-system,sans-serif;' +
      'font-size:10px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;' +
      'color:rgba(255,255,255,.6);margin-bottom:4px;' +
    '}' +
    '#_etbw_help_card_name{' +
      'font-family:system-ui,-apple-system,sans-serif;' +
      'font-size:17px;font-weight:800;color:#fff;line-height:1.2;' +
    '}' +
    '#_etbw_help_card_body{padding:14px 18px 18px;display:flex;flex-direction:column;gap:12px;}' +
    '.etbw_contact_row{display:flex;align-items:center;gap:10px;}' +
    '.etbw_contact_dot{' +
      'width:32px;height:32px;border-radius:10px;flex-shrink:0;' +
      'display:flex;align-items:center;justify-content:center;' +
      'background:linear-gradient(135deg,rgba(109,40,217,.12),rgba(157,23,77,.12));' +
    '}' +
    '.etbw_contact_info{display:flex;flex-direction:column;gap:1px;min-width:0;}' +
    '.etbw_contact_lbl{font-family:system-ui,-apple-system,sans-serif;font-size:9px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:#94a3b8;}' +
    '.etbw_contact_val{font-family:system-ui,-apple-system,sans-serif;font-size:12px;font-weight:600;color:#1e293b;word-break:break-all;}' +
    '#_etbw_help_card_footer{' +
      'margin:0 18px 18px;padding-top:12px;border-top:1px solid #f1f5f9;' +
    '}' +
    '#_etbw_help_dismiss{' +
      'width:100%;padding:9px;border-radius:10px;border:none;cursor:pointer;' +
      'background:linear-gradient(135deg,#7c3aed,#db2777);' +
      'font-family:system-ui,-apple-system,sans-serif;' +
      'font-size:12px;font-weight:700;color:#fff;' +
      'transition:opacity .15s;' +
    '}' +
    '#_etbw_help_dismiss:hover{opacity:.88;}' +

    /* Mobile full-screen bottom sheet */
    '@media(max-width:500px){' +
      '#_etbw_panel{' +
        'left:0!important;right:0!important;bottom:0!important;' +
        'width:100%!important;' +
        'height:100vh!important;height:100dvh!important;' +
        'border-radius:16px 16px 0 0!important;' +
        'transform:translateY(40px);' +
      '}' +
      '#_etbw_panel._etbw_open{transform:translateY(0);}' +
      '#_etbw_btn{bottom:16px;' + SIDE + ':16px;}' +
    '}';

  document.head.appendChild(style);

  /* ── FAB button ──────────────────────────────────────────────── */
  var btn = document.createElement('button');
  btn.id  = '_etbw_btn';
  btn.setAttribute('aria-label', 'Open social panel');
  btn.setAttribute('aria-expanded', 'false');
  btn.innerHTML = FAB_ICON_HTML;
  /* Hidden until we confirm the event is within its start/end window (gate at end). */
  btn.style.display = 'none';
  document.body.appendChild(btn);

  /* ── Panel ───────────────────────────────────────────────────── */
  var panel = document.createElement('div');
  panel.id  = '_etbw_panel';
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-modal', 'true');

  /* Header */
  var hdr = document.createElement('div');
  hdr.id  = '_etbw_hdr';

  var hdrL = document.createElement('div');
  hdrL.id  = '_etbw_hdr_l';

  var hdrIco = document.createElement('div');
  hdrIco.id  = '_etbw_hdr_ico';
  hdrIco.innerHTML =
    '<svg width="14" height="14" viewBox="0 0 24 24" fill="none"' +
    ' stroke="white" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">' +
    '<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>' +
    '<line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/>' +
    '<line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>' +
    '</svg>';

  var hdrTxt = document.createElement('div');
  hdrTxt.id  = '_etbw_hdr_txt';
  hdrTxt.innerHTML =
    '<span id="_etbw_hdr_title">Social Buzz</span>' +
    '<span id="_etbw_hdr_sub">Powered by Economic Times</span>';

  hdrL.appendChild(hdrIco);
  hdrL.appendChild(hdrTxt);

  var hdrActions = document.createElement('div');
  hdrActions.id  = '_etbw_hdr_actions';

  /* Help button */
  var hdrHelp = document.createElement('button');
  hdrHelp.id  = '_etbw_hdr_help';
  hdrHelp.setAttribute('aria-label', 'Help and contact');
  hdrHelp.innerHTML = SVG_HELP;

  /* Close button */
  var hdrClose = document.createElement('button');
  hdrClose.id  = '_etbw_hdr_close';
  hdrClose.setAttribute('aria-label', 'Close panel');
  hdrClose.innerHTML = SVG_CLOSE_HDR;

  hdrActions.appendChild(hdrHelp);
  hdrActions.appendChild(hdrClose);

  hdr.appendChild(hdrL);
  hdr.appendChild(hdrActions);

  /* Body + iframe */
  var body  = document.createElement('div');
  body.id   = '_etbw_body';

  var iframe = document.createElement('iframe');
  iframe.id  = '_etbw_iframe';
  iframe.setAttribute('allow', 'web-share; clipboard-write; clipboard-read; camera');
  iframe.setAttribute('title', 'Social panel');

  /* Help overlay (inside body, absolute over iframe) */
  var helpOverlay = document.createElement('div');
  helpOverlay.id  = '_etbw_help_overlay';
  helpOverlay.innerHTML =
    '<div id="_etbw_help_card">' +
      '<div id="_etbw_help_card_top">' +
        '<div id="_etbw_help_card_label">Support Contact</div>' +
        '<div id="_etbw_help_card_name">Sachitanand Rai</div>' +
      '</div>' +
      '<div id="_etbw_help_card_body">' +

        '<div class="etbw_contact_row">' +
          '<div class="etbw_contact_dot">' +
            '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#7c3aed" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">' +
            '<path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>' +
            '<polyline points="22,6 12,13 2,6"/>' +
            '</svg>' +
          '</div>' +
          '<div class="etbw_contact_info">' +
            '<span class="etbw_contact_lbl">Email</span>' +
            '<span class="etbw_contact_val">admin@socialbuzz.app</span>' +
          '</div>' +
        '</div>' +

        '<div class="etbw_contact_row">' +
          '<div class="etbw_contact_dot">' +
            '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#7c3aed" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">' +
            '<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.61 3.41 2 2 0 0 1 3.6 1.22h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.96a16 16 0 0 0 6.13 6.13l.97-.96a2 2 0 0 1 2.11-.45c.9.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z"/>' +
            '</svg>' +
          '</div>' +
          '<div class="etbw_contact_info">' +
            '<span class="etbw_contact_lbl">Phone</span>' +
            '<span class="etbw_contact_val">+91 8299373687</span>' +
          '</div>' +
        '</div>' +

      '</div>' +
      '<div id="_etbw_help_card_footer">' +
        '<button id="_etbw_help_dismiss">Got it</button>' +
      '</div>' +
    '</div>';

  body.appendChild(iframe);
  body.appendChild(helpOverlay);
  panel.appendChild(hdr);
  panel.appendChild(body);
  document.body.appendChild(panel);

  /* ── Toggle logic ────────────────────────────────────────────── */
  var isOpen     = false;
  var loaded     = false;
  var isHelpOpen = false;

  function openPanel() {
    // Visit tracking is handled inside the loaded app (it carries the stable
    // visitor id and reports source='widget' when running in this iframe).
    if (!loaded) {
      iframe.src = baseUrl + '/?event=' + encodeURIComponent(slug);
      loaded = true;
    }
    panel.classList.add('_etbw_open');
    btn.classList.add('_etbw_btn_open');
    btn.innerHTML = FAB_CLOSE_HTML;
    btn.setAttribute('aria-expanded', 'true');
    isOpen = true;
  }

  function closePanel() {
    panel.classList.remove('_etbw_open');
    btn.classList.remove('_etbw_btn_open');
    btn.innerHTML = FAB_ICON_HTML;
    btn.setAttribute('aria-expanded', 'false');
    isOpen = false;
    closeHelp();
  }

  function openHelp() {
    helpOverlay.classList.add('_etbw_open');
    hdrHelp.classList.add('_etbw_help_active');
    isHelpOpen = true;
  }

  function closeHelp() {
    helpOverlay.classList.remove('_etbw_open');
    hdrHelp.classList.remove('_etbw_help_active');
    isHelpOpen = false;
  }

  btn.addEventListener('click', function () { isOpen ? closePanel() : openPanel(); });
  hdrClose.addEventListener('click', closePanel);

  hdrHelp.addEventListener('click', function (e) {
    e.stopPropagation();
    isHelpOpen ? closeHelp() : openHelp();
  });

  /* Clicking the backdrop (but not the card) closes the overlay */
  helpOverlay.addEventListener('click', function (e) {
    if (e.target === helpOverlay) closeHelp();
  });

  /* "Got it" dismiss button */
  document.addEventListener('click', function (e) {
    if (e.target && e.target.id === '_etbw_help_dismiss') closeHelp();
  });

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') { if (isHelpOpen) closeHelp(); else if (isOpen) closePanel(); }
  });

  /* ── Event window gate ───────────────────────────────────────── */
  /* The widget only appears inside the event's [start, end] window and
     disappears once the end date/time has passed (and stays hidden before it
     starts). Fails open on any error so a network hiccup never hides a live one. */
  function _ts(v) { if (!v) return NaN; var t = new Date(v).getTime(); return isNaN(t) ? NaN : t; }
  function _isActive(meta) {
    var now = Date.now();
    var s = _ts(meta && meta.startAt), e = _ts(meta && meta.endAt);
    if (!isNaN(s) && now < s) return false;   // not started yet
    if (!isNaN(e) && now > e) return false;   // ended
    return true;
  }
  function _revealWidget() { btn.style.display = 'flex'; }
  function _removeWidget() {
    try { if (btn.parentNode)   btn.parentNode.removeChild(btn); }     catch (_) {}
    try { if (panel.parentNode) panel.parentNode.removeChild(panel); } catch (_) {}
  }
  try {
    fetch(baseUrl + '/api/bootstrap?event=' + encodeURIComponent(slug) + '&meta=1', { credentials: 'omit' })
      .then(function (r) { return r.json(); })
      .then(function (j) { _isActive((j && j.data) || {}) ? _revealWidget() : _removeWidget(); })
      .catch(function () { _revealWidget(); });
  } catch (_) { _revealWidget(); }
})();
