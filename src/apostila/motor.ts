export function motorWebKit(): boolean {
  const ua = navigator.userAgent;
  return /AppleWebKit/.test(ua) && !/(Chrome|Chromium|Edg|OPR|Firefox)\//.test(ua);
}
