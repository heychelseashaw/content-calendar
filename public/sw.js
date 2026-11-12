// Pushes carry no content. On a push, ask the database what kind of reminder it was (kind + a count only) and show matching text.
const API = 'https://tmzlclbpscxrgzpnryma.supabase.co/rest/v1/rpc/cal_last_event'
const KEY = 'sb_publishable_29BxUoeaIRaSbAGNV_DFgw_wXTPsJPl'
self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()))
async function lastEvent() {
  try {
    const sub = await self.registration.pushManager.getSubscription(); if (!sub) return null
    const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 5000)
    const r = await fetch(API, { method: 'POST', headers: { apikey: KEY, Authorization: 'Bearer ' + KEY, 'Content-Type': 'application/json' }, body: JSON.stringify({ p_endpoint: sub.endpoint }), signal: ctl.signal })
    clearTimeout(t); return r.ok ? await r.json() : null
  } catch { return null }
}
const s = n => (n === 1 ? '' : 's')
self.addEventListener('push', e => {
  e.waitUntil((async () => {
    const ev = await lastEvent(); let body = 'You have a content reminder. Tap to open.', tag = 'cal'
    if (ev && ev.kind === 'broll') { body = `Time to record b-roll: ${ev.n} shot${s(ev.n)} to film today.`; tag = 'cal-broll' }
    else if (ev && ev.kind === 'edit') { body = `Time to edit: ${ev.n} filmed clip${s(ev.n)} waiting to be edited.`; tag = 'cal-edit' }
    else if (ev && ev.kind === 'schedule') { body = `Time to schedule posts: ${ev.n} post${s(ev.n)} due today or tomorrow.`; tag = 'cal-schedule' }
    else if (ev && ev.kind === 'test') { body = 'Test notification: Content Calendar reminders are working on this device.'; tag = 'cal-test' }
    await self.registration.showNotification('Content Calendar', { body, icon: 'icon-192.png', badge: 'icon-192.png', tag, renotify: true })
  })())
})
self.addEventListener('notificationclick', e => {
  e.notification.close()
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => { const open = list.find(c => 'focus' in c); return open ? open.focus() : self.clients.openWindow('./') }))
})
