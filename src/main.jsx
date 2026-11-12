import { StrictMode, useCallback, useEffect, useMemo, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { createClient } from '@supabase/supabase-js'
import './styles.css'

const sb = createClient('https://tmzlclbpscxrgzpnryma.supabase.co', 'sb_publishable_29BxUoeaIRaSbAGNV_DFgw_wXTPsJPl', { auth: { persistSession: true, autoRefreshToken: true } })
const pad = n => String(n).padStart(2, '0')
const ymd = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
const parse = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d) }
const addDays = (s, n) => { const d = parse(s); d.setDate(d.getDate() + n); return ymd(d) }
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const NEXT = { broll: { todo: ['filmed', 'Mark filmed'], filmed: ['edited', 'Mark edited'], edited: [null, ''] }, post: { todo: ['scheduled', 'Mark scheduled'], scheduled: ['posted', 'Mark posted'], posted: [null, ''] } }
const LABEL = { todo: 'To do', filmed: 'Filmed', edited: 'Edited', scheduled: 'Scheduled', posted: 'Posted' }
const DEFAULTS = { tz: Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/New_York', broll_time: '09:00', edit_time: '15:00', schedule_time: '17:00', remind_broll: true, remind_edit: true, remind_schedule: true,
  post_types: ['Reel', 'Carousel', 'Story', 'Photo', 'Video', 'Text post'], platforms: ['Instagram', 'TikTok', 'YouTube', 'Facebook', 'Pinterest'] }

function Auth() {
  const [email, setEmail] = useState(''), [pw, setPw] = useState(''), [err, setErr] = useState(''), [busy, setBusy] = useState(false)
  const go = async e => { e.preventDefault(); setBusy(true); const { error } = await sb.auth.signInWithPassword({ email, password: pw }); setBusy(false); if (error) setErr(error.message) }
  return <div className="center"><form className="card auth" onSubmit={go}><div className="brand">Content Calendar</div><h1>Sign in</h1>
    <p className="muted">Use the same email and password as Referral Desk.</p>
    <label className="field"><span>Email</span><input type="email" required autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} /></label>
    <label className="field"><span>Password</span><input type="password" required autoComplete="current-password" value={pw} onChange={e => setPw(e.target.value)} /></label>
    {err && <p className="error">{err}</p>}<button disabled={busy}>Sign in</button></form></div>
}

function App({ user }) {
  const [tab, setTab] = useState('calendar'), [month, setMonth] = useState(() => { const t = new Date(); return new Date(t.getFullYear(), t.getMonth(), 1) }), [sel, setSel] = useState(ymd(new Date()))
  const [items, setItems] = useState([]), [settings, setSettings] = useState(DEFAULTS), [msg, setMsg] = useState(null), [paused, setPaused] = useState(false)
  const notify = (t, bad) => { setMsg({ t, bad }); setTimeout(() => setMsg(null), 3500) }
  const start = useMemo(() => { const d = new Date(month); d.setDate(1 - d.getDay()); return ymd(d) }, [month]), end = addDays(start, 41)
  const load = useCallback(async () => {
    const { data, error } = await sb.from('cal_items').select('*').gte('day', start).lte('day', end).order('created_at')
    if (error) return notify(error.message, true); setItems(data)
  }, [start, end])
  useEffect(() => { load() }, [load])
  useEffect(() => {
    sb.from('profiles').select('access_status').eq('user_id', user.id).maybeSingle().then(({ data }) => setPaused(!data || !['active', 'trial'].includes(data.access_status)))
    sb.from('cal_settings').select('*').maybeSingle().then(({ data }) => data && setSettings({ ...DEFAULTS, ...data, broll_time: data.broll_time.slice(0, 5), edit_time: data.edit_time.slice(0, 5), schedule_time: data.schedule_time.slice(0, 5) }))
  }, [user.id])
  const byDay = useMemo(() => { const m = {}; items.forEach(i => (m[i.day] ||= []).push(i)); return m }, [items])
  const api = {
    notify, settings, user,
    async add(row) { const { data, error } = await sb.from('cal_items').insert(row).select().single(); if (error) return notify(error.message, true); setItems(x => [...x, data]) },
    async patch(id, p) { const { data, error } = await sb.from('cal_items').update(p).eq('id', id).select().single(); if (error) return notify(error.message, true); setItems(x => x.map(i => i.id === id ? data : i)) },
    async remove(id) { if (!confirm('Delete this item?')) return; const { error } = await sb.from('cal_items').delete().eq('id', id); if (error) return notify(error.message, true); setItems(x => x.filter(i => i.id !== id)) },
    async saveSettings(p) { const next = { ...settings, ...p }; const { error } = await sb.from('cal_settings').upsert({ owner_id: user.id, tz: next.tz, broll_time: next.broll_time, edit_time: next.edit_time, schedule_time: next.schedule_time, remind_broll: next.remind_broll, remind_edit: next.remind_edit, remind_schedule: next.remind_schedule, post_types: next.post_types, platforms: next.platforms }); if (error) return notify(error.message, true); setSettings(next); notify('Saved') },
  }
  if (paused) return <div className="center"><div className="card auth"><div className="brand">Content Calendar</div><h1>Access is paused</h1><p className="muted">This account does not currently have access.</p><button onClick={() => sb.auth.signOut()}>Sign out</button></div></div>
  const goToday = () => { const t = new Date(); setMonth(new Date(t.getFullYear(), t.getMonth(), 1)); setSel(ymd(t)) }
  return <div className="shell">
    <header><div className="brand">Content Calendar</div>
      <nav>{[['calendar', 'Calendar'], ['agenda', 'Agenda'], ['settings', 'Settings']].map(([k, l]) => <button key={k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{l}</button>)}</nav></header>
    <main>
      {tab === 'calendar' && <div className="cols">
        <section className="card"><div className="row"><button className="ghost" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))} aria-label="Previous month">‹</button>
          <h2 className="grow center-t">{MONTHS[month.getMonth()]} {month.getFullYear()}</h2>
          <button className="ghost" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))} aria-label="Next month">›</button><button className="ghost" onClick={goToday}>Today</button></div>
          <div className="grid head">{DOW.map(d => <div key={d}>{d}</div>)}</div>
          <div className="grid">{Array.from({ length: 42 }, (_, i) => addDays(start, i)).map(d => { const list = byDay[d] || [], b = list.filter(x => x.kind === 'broll'), p = list.filter(x => x.kind === 'post')
            return <button key={d} className={'day' + (d === sel ? ' sel' : '') + (d === ymd(new Date()) ? ' today' : '') + (parse(d).getMonth() !== month.getMonth() ? ' out' : '')} onClick={() => setSel(d)}>
              <span className="n">{parse(d).getDate()}</span>
              {b.length > 0 && <span className="chip b">{b.length} b-roll</span>}
              {p.map(x => <span key={x.id} className={'chip p' + (x.stage !== 'todo' ? ' done' : '')}>{x.post_type || 'Post'}</span>)}</button> })}</div></section>
        <DayPanel day={sel} list={byDay[sel] || []} api={api} /></div>}
      {tab === 'agenda' && <Agenda items={items} api={api} setSel={d => { setSel(d); setTab('calendar') }} start={ymd(new Date())} />}
      {tab === 'settings' && <Settings api={api} />}
    </main>
    {msg && <div className={'toast' + (msg.bad ? ' bad' : '')} role="status">{msg.t}</div>}
  </div>
}

const nice = d => parse(d).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })

function Item({ i, api }) {
  const [next, label] = NEXT[i.kind][i.stage]
  return <li className={'item' + (i.stage === 'edited' || i.stage === 'posted' ? ' fin' : '')}>
    <div className="grow"><b>{i.title}</b>
      <div className="muted small">{i.kind === 'post' ? [i.post_type, i.platform].filter(Boolean).join(' · ') || 'Post' : 'B-roll to film'} · {LABEL[i.stage]}{i.notes ? ' · ' + i.notes : ''}</div></div>
    <div className="row wrap end">{next && <button className="ghost small" onClick={() => api.patch(i.id, { stage: next })}>{label}</button>}
      {i.stage !== 'todo' && <button className="link" onClick={() => api.patch(i.id, { stage: 'todo' })}>Undo</button>}
      <button className="link" onClick={() => api.patch(i.id, { day: addDays(i.day, 1) })}>Move to tomorrow</button>
      <button className="link" onClick={() => api.remove(i.id)}>Delete</button></div></li>
}

function DayPanel({ day, list, api }) {
  const [kind, setKind] = useState('broll'), [title, setTitle] = useState(''), [type, setType] = useState(''), [plat, setPlat] = useState(''), [notes, setNotes] = useState('')
  const submit = async e => { e.preventDefault(); if (!title.trim()) return
    await api.add({ day, kind, title: title.trim(), post_type: kind === 'post' ? type || null : null, platform: kind === 'post' ? plat || null : null, notes: notes.trim() || null }); setTitle(''); setNotes('') }
  const b = list.filter(i => i.kind === 'broll'), p = list.filter(i => i.kind === 'post')
  return <section className="card"><h2>{nice(day)}</h2>
    <h3>B-roll to film</h3>{b.length ? <ul className="items">{b.map(i => <Item key={i.id} i={i} api={api} />)}</ul> : <p className="muted small">Nothing planned.</p>}
    <h3>Posts going out</h3>{p.length ? <ul className="items">{p.map(i => <Item key={i.id} i={i} api={api} />)}</ul> : <p className="muted small">Nothing scheduled.</p>}
    <form className="stack" onSubmit={submit}><h3>Add to this day</h3>
      <div className="row wrap"><select value={kind} onChange={e => setKind(e.target.value)} aria-label="Type"><option value="broll">B-roll shot</option><option value="post">Post</option></select>
        <input className="grow" required maxLength="300" placeholder={kind === 'broll' ? 'Shot to film, e.g. coffee pour at the window' : 'Post idea or caption topic'} value={title} onChange={e => setTitle(e.target.value)} aria-label="Title" /></div>
      {kind === 'post' && <div className="row wrap"><select value={type} onChange={e => setType(e.target.value)} aria-label="Post type"><option value="">Post type</option>{api.settings.post_types.map(t => <option key={t}>{t}</option>)}</select>
        <select value={plat} onChange={e => setPlat(e.target.value)} aria-label="Platform"><option value="">Platform</option>{api.settings.platforms.map(t => <option key={t}>{t}</option>)}</select></div>}
      <input placeholder="Notes (optional)" value={notes} onChange={e => setNotes(e.target.value)} aria-label="Notes" /><button>Add</button></form></section>
}

function Agenda({ items, api, setSel, start }) {
  const days = Array.from({ length: 14 }, (_, i) => addDays(start, i)), by = d => items.filter(i => i.day === d)
  const behind = items.filter(i => i.day < start && ((i.kind === 'broll' && i.stage !== 'edited') || (i.kind === 'post' && i.stage !== 'posted')))
  return <div className="stack">
    {behind.length > 0 && <section className="card"><h2>Still open from earlier days</h2><ul className="items">{behind.map(i => <Item key={i.id} i={i} api={api} />)}</ul></section>}
    {days.map(d => <section className="card" key={d}><div className="row"><h2 className="grow">{nice(d)}</h2><button className="link" onClick={() => setSel(d)}>Open day</button></div>
      {by(d).length ? <ul className="items">{by(d).map(i => <Item key={i.id} i={i} api={api} />)}</ul> : <p className="muted small">Nothing planned.</p>}</section>)}
    <p className="muted small">Showing the next 14 days that fall within the month shown on the Calendar tab. Change months there to see further ahead.</p></div>
}

const toKey = s => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0))
const supported = () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
const ready = () => Promise.race([navigator.serviceWorker.ready, new Promise((_, no) => setTimeout(() => no(new Error('Notifications are not available yet. Reload and try again.')), 5000))])

function Settings({ api }) {
  const s = api.settings, [f, setF] = useState({ ...s, post_types: s.post_types.join(', '), platforms: s.platforms.join(', ') }), [push, setPush] = useState('checking'), [busy, setBusy] = useState(false)
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent), list = t => t.split(',').map(x => x.trim()).filter(Boolean)
  const refresh = async () => { if (!supported()) return setPush('unsupported'); const sub = await (await ready()).pushManager.getSubscription(); setPush(sub ? 'on' : Notification.permission === 'denied' ? 'blocked' : 'off') }
  useEffect(() => { refresh().catch(() => setPush('unsupported')) }, [])
  const run = fn => async () => { setBusy(true); try { await fn() } catch (e) { api.notify(e.message || String(e), true) } finally { setBusy(false) } }
  const enable = run(async () => {
    if ((await Notification.requestPermission()) !== 'granted') return setPush(Notification.permission === 'denied' ? 'blocked' : 'off')
    const { data: key, error } = await sb.rpc('push_public_key'); if (error || !key) throw new Error(error?.message || 'Notifications are not set up on the server.')
    const sub = await (await ready()).pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: toKey(key) })
    const r = await sb.from('cal_push_subscriptions').upsert({ endpoint: sub.endpoint, device: navigator.userAgent.slice(0, 200) }, { onConflict: 'endpoint' }); if (r.error) throw r.error
    setPush('on'); api.notify('Notifications are on for this device')
  })
  const disable = run(async () => { const sub = await (await ready()).pushManager.getSubscription(); if (sub) { await sb.from('cal_push_subscriptions').delete().eq('endpoint', sub.endpoint); await sub.unsubscribe() } setPush('off') })
  const test = run(async () => { const { error } = await sb.rpc('cal_test'); if (error) throw error; api.notify('Test sent. It should arrive in a few seconds.') })
  const save = e => { e.preventDefault(); api.saveSettings({ ...f, post_types: list(f.post_types), platforms: list(f.platforms) }) }
  const set = (k, v) => setF({ ...f, [k]: v })
  const row = (k, label, tk) => <div className="row wrap" key={k}><label className="check grow"><input type="checkbox" checked={f[k]} onChange={e => set(k, e.target.checked)} /> {label}</label><input type="time" value={f[tk]} onChange={e => set(tk, e.target.value)} aria-label={label + ' time'} /></div>
  return <div className="stack">
    <form className="card stack" onSubmit={save}><h2>Reminders</h2>
      <p className="muted">Each reminder is sent once a day at the time you choose, only when there is something to do.</p>
      {row('remind_broll', 'Record b-roll (shots planned for today)', 'broll_time')}
      {row('remind_edit', 'Edit content (filmed clips not yet edited)', 'edit_time')}
      {row('remind_schedule', 'Schedule posts (posts due today or tomorrow)', 'schedule_time')}
      <label className="field"><span>Time zone</span><input value={f.tz} onChange={e => set('tz', e.target.value)} /></label>
      <label className="field"><span>Post types (comma separated)</span><input value={f.post_types} onChange={e => set('post_types', e.target.value)} /></label>
      <label className="field"><span>Platforms (comma separated)</span><input value={f.platforms} onChange={e => set('platforms', e.target.value)} /></label>
      <button>Save settings</button></form>
    <section className="card"><div className="row"><h2 className="grow">Notifications on this device</h2><span className={'badge ' + (push === 'on' ? 'good' : '')}>{{ on: 'On', off: 'Off', blocked: 'Blocked', unsupported: 'Not available', checking: 'Checking…' }[push]}</span></div>
      <p className="muted">Notifications are per device. They say only what to do next; nothing else is sent.</p>
      {push === 'unsupported' && <p className="note">{ios ? 'On iPhone, add this page to your Home Screen first (Safari, Share, Add to Home Screen), open it from the new icon, then come back here.' : 'This browser does not support notifications.'}</p>}
      {push === 'blocked' && <p className="note">Notifications are blocked in this device's settings. Allow them there, then reload.</p>}
      <div className="row wrap">{push === 'off' && <button disabled={busy} onClick={enable}>Turn on notifications</button>}
        {push === 'on' && <><button disabled={busy} onClick={test}>Send a test notification</button><button className="ghost" disabled={busy} onClick={disable}>Turn off on this device</button></>}</div></section>
    <section className="card"><h2>Account</h2><p className="muted">{api.user.email}</p><button className="ghost" onClick={() => sb.auth.signOut()}>Sign out</button></section></div>
}

function Root() {
  const [session, setSession] = useState(undefined)
  useEffect(() => { sb.auth.getSession().then(({ data }) => setSession(data.session)); const { data } = sb.auth.onAuthStateChange((_e, s) => setSession(s)); return () => data.subscription.unsubscribe() }, [])
  useEffect(() => { if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(() => {}) }, [])
  if (session === undefined) return <div className="center muted">Loading…</div>
  return session ? <App key={session.user.id} user={session.user} /> : <Auth />
}
createRoot(document.getElementById('root')).render(<StrictMode><Root /></StrictMode>)
