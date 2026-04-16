import { Pixel } from "@workspace/db";

function escapeHtml(str: string): string {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function metaPixelScript(pixelId: string): string {
  return `<script>
!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?
n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;
n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;
t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,
document,'script','https://connect.facebook.net/en_US/fbevents.js');
fbq('init','${escapeHtml(pixelId)}');fbq('track','PageView');
</script>
<noscript><img height="1" width="1" style="display:none" src="https://www.facebook.com/tr?id=${escapeHtml(pixelId)}&ev=PageView&noscript=1"/></noscript>`;
}

function googleAdsScript(conversionId: string): string {
  return `<script async src="https://www.googletagmanager.com/gtag/js?id=${escapeHtml(conversionId)}"></script>
<script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${escapeHtml(conversionId)}');</script>`;
}

function linkedInScript(partnerId: string): string {
  return `<script type="text/javascript">
_linkedin_partner_id="${escapeHtml(partnerId)}";window._linkedin_data_partner_ids=window._linkedin_data_partner_ids||[];window._linkedin_data_partner_ids.push(_linkedin_partner_id);
(function(l){if(!l){window.lintrk=function(a,b){window.lintrk.q.push([a,b])};window.lintrk.q=[]}
var s=document.getElementsByTagName("script")[0];var b=document.createElement("script");b.type="text/javascript";b.async=!0;b.src="https://snap.licdn.com/li.lms-analytics/insight.min.js";s.parentNode.insertBefore(b,s)})(window.lintrk);
</script>
<noscript><img height="1" width="1" style="display:none;" alt="" src="https://px.ads.linkedin.com/collect/?pid=${escapeHtml(partnerId)}&fmt=gif"/></noscript>`;
}

function tiktokScript(pixelId: string): string {
  return `<script>
!function(w,d,t){w.TiktokAnalyticsObject=t;var ttq=w[t]=w[t]||[];ttq.methods=["page","track","identify","instances","debug","on","off","once","ready","alias","group","enableCookie","disableCookie"];ttq.setAndDefer=function(t,e){t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}};for(var i=0;i<ttq.methods.length;i++)ttq.setAndDefer(ttq,ttq.methods[i]);ttq.instance=function(t){for(var e=ttq._i[t]||[],n=0;n<ttq.methods.length;n++)ttq.setAndDefer(e,ttq.methods[n]);return e};ttq.load=function(e,n){var i="https://analytics.tiktok.com/i18n/pixel/events.js";ttq._i=ttq._i||{};ttq._i[e]=[];ttq._i[e]._u=i;ttq._t=ttq._t||{};ttq._t[e]=+new Date;ttq._o=ttq._o||{};ttq._o[e]=n||{};var o=document.createElement("script");o.type="text/javascript";o.async=!0;o.src=i+"?sdkid="+e+"&lib="+t;var a=document.getElementsByTagName("script")[0];a.parentNode.insertBefore(o,a)};ttq.load('${escapeHtml(pixelId)}');ttq.page();}(window,document,'ttq');
</script>`;
}

export function buildPixelPage(pixels: Pixel[], destinationUrl: string): string {
  const scripts = pixels
    .map((p) => {
      switch (p.type) {
        case "meta":
          return p.pixelId ? metaPixelScript(p.pixelId) : "";
        case "google_ads":
          return p.pixelId ? googleAdsScript(p.pixelId) : "";
        case "linkedin":
          return p.pixelId ? linkedInScript(p.pixelId) : "";
        case "tiktok":
          return p.pixelId ? tiktokScript(p.pixelId) : "";
        case "custom":
          return p.customScript ?? "";
        default:
          return "";
      }
    })
    .filter(Boolean)
    .join("\n");

  const dest = escapeHtml(destinationUrl);

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta http-equiv="refresh" content="0;url=${dest}">
${scripts}
<script>window.location.href=${JSON.stringify(destinationUrl).replace(/</g, "\\u003c")};</script>
</head>
<body></body>
</html>`;
}
