/**
 * GET /api/widget?api_key=ccrm_xxx   (served to customers as /widget.js?api_key=ccrm_xxx)
 *
 * Returns a self-contained vanilla-JS tracking snippet with the api_key baked in.
 * The customer embeds:
 *   <script src="https://app.conversioncrm.io/widget.js?api_key=ccrm_xxx"></script>
 */
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const apiKey = request.nextUrl.searchParams.get("api_key") ?? "";

  if (!apiKey) {
    return new NextResponse("// ConversionCRM: missing api_key", {
      status: 400,
      headers: { "Content-Type": "application/javascript; charset=utf-8" },
    });
  }

  // Derive the endpoint from where this script is being served, so events
  // always POST back to the same origin (works on any domain automatically).
  const origin =
    request.nextUrl.origin ||
    process.env.NEXT_PUBLIC_APP_URL ||
    "http://localhost:3000";
  const script = buildWidgetScript({ apiKey, endpoint: `${origin}/api/events` });

  return new NextResponse(script, {
    status: 200,
    headers: {
      "Content-Type": "application/javascript; charset=utf-8",
      "Cache-Control": "no-store, must-revalidate",
      "Access-Control-Allow-Origin": "*",
    },
  });
}

function buildWidgetScript({
  apiKey,
  endpoint,
}: {
  apiKey: string;
  endpoint: string;
}): string {
  return `
(function () {
  if (window.ConversionCRM && window.ConversionCRM.__loaded) return;

  var API_KEY = ${JSON.stringify(apiKey)};
  var ENDPOINT = ${JSON.stringify(endpoint)};

  // ── Storage / identity ───────────────────────────────
  function readCookie(name) {
    var match = document.cookie.match(new RegExp('(^|; )' + name + '=([^;]*)'));
    return match ? decodeURIComponent(match[2]) : null;
  }
  function lsGet(key) {
    try { return window.localStorage.getItem(key); } catch (e) { return null; }
  }
  function lsSet(key, val) {
    try { window.localStorage.setItem(key, String(val)); } catch (e) {}
  }
  function getUserId() {
    var id = lsGet('ccrm_user_id') || lsGet('user_id') ||
             readCookie('ccrm_user_id') || readCookie('user_id');
    if (id) return id;
    var anon = lsGet('ccrm_anon_id');
    if (!anon) {
      anon = 'anon_' + Math.random().toString(36).slice(2, 10) +
             Date.now().toString(36).slice(-4);
      lsSet('ccrm_anon_id', anon);
    }
    return anon;
  }
  function getEmail() {
    return lsGet('ccrm_email') || null;
  }

  // ── Page helpers ─────────────────────────────────────
  function getPagePath() {
    return window.location.pathname + window.location.search +
      (window.location.hash || '');
  }
  function getPageMeta() {
    return {
      title: (document.title || '').slice(0, 200),
      url: window.location.href,
      path: getPagePath()
    };
  }

  // ── Event sender ─────────────────────────────────────
  function send(eventType, properties, pageOverride) {
    var payload = {
      api_key: API_KEY,
      event_type: eventType,
      page: pageOverride || getPagePath(),
      user_id: getUserId(),
      email: getEmail(),
      properties: properties || {},
      timestamp: new Date().toISOString()
    };
    var json = JSON.stringify(payload);
    var sent = false;
    if (navigator.sendBeacon) {
      try {
        sent = navigator.sendBeacon(
          ENDPOINT,
          new Blob([json], { type: 'text/plain;charset=UTF-8' })
        );
      } catch (e) { sent = false; }
    }
    if (!sent) {
      fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
        body: json,
        keepalive: true,
        mode: 'cors'
      }).catch(function () {});
    }
  }

  // ── Time-on-page tracking ────────────────────────────
  var pageEnterAt = Date.now();
  var currentPage = getPagePath();
  var timeSentForPage = false;

  function sendTimeOnPage() {
    if (timeSentForPage) return;
    var duration = Math.round((Date.now() - pageEnterAt) / 1000);
    if (duration < 1) return;
    timeSentForPage = true;
    send('page_time', {
      duration_seconds: duration,
      page_title: (document.title || '').slice(0, 200)
    }, currentPage);
  }

  function onPageEnter() {
    timeSentForPage = false;
    currentPage = getPagePath();
    pageEnterAt = Date.now();
    send('page_view', getPageMeta());
  }

  function onPageLeave() {
    sendTimeOnPage();
  }

  function onRouteChange() {
    var next = getPagePath();
    if (next === currentPage) return;
    onPageLeave();
    onPageEnter();
  }

  // ── SPA navigation (Next.js, React Router, etc.) ─────
  function hookHistory() {
    var origPush = history.pushState;
    var origReplace = history.replaceState;
    history.pushState = function () {
      origPush.apply(history, arguments);
      onRouteChange();
    };
    history.replaceState = function () {
      origReplace.apply(history, arguments);
      onRouteChange();
    };
    window.addEventListener('popstate', onRouteChange);
  }

  // ── Auto click tracking ────────────────────────────
  function clickLabel(el) {
    var text = (el.innerText || el.value || el.getAttribute('aria-label') ||
                el.getAttribute('title') || el.getAttribute('placeholder') || '').trim();
    if (text) return text.slice(0, 120);
    if (el.id) return '#' + el.id;
    if (el.className && typeof el.className === 'string') {
      var cls = el.className.trim().split(/\\s+/)[0];
      if (cls) return el.tagName.toLowerCase() + '.' + cls;
    }
    return el.tagName.toLowerCase();
  }

  function trackClick(e) {
    var target = e.target;
    if (!target || !target.closest) return;
    var el = target.closest(
      'a, button, input[type="submit"], input[type="button"], ' +
      '[role="button"], [role="link"], [data-ccrm-track], label, select, textarea'
    );
    if (!el) el = target;
    var tag = (el.tagName || '').toLowerCase();
    if (!tag || tag === 'html' || tag === 'body') return;

    send('click', {
      tag: tag,
      text: clickLabel(el),
      id: el.id || undefined,
      href: el.href || undefined,
      name: el.name || undefined,
      type: el.type || undefined,
      page_title: (document.title || '').slice(0, 200)
    });
  }

  // ── Public API ───────────────────────────────────────
  window.ConversionCRM = {
    __loaded: true,
    track: function (eventType, properties) {
      if (!eventType) return;
      send(eventType, properties);
    },
    identify: function (userId, traits) {
      if (!userId) return;
      lsSet('ccrm_user_id', userId);
      if (traits && traits.email) lsSet('ccrm_email', traits.email);
      send('identify', {});
    },
    page: function () { onPageEnter(); }
  };

  // ── Lifecycle hooks ────────────────────────────────
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'hidden') sendTimeOnPage();
    else {
      timeSentForPage = false;
      pageEnterAt = Date.now();
    }
  });
  window.addEventListener('pagehide', sendTimeOnPage);
  window.addEventListener('beforeunload', sendTimeOnPage);
  document.addEventListener('click', trackClick, true);

  hookHistory();
  onPageEnter();
})();
`.trim();
}
