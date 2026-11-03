import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, ArrowRight, CheckCircle2, Flag, GitBranch, Inbox, KeyRound, MessageSquare, Paperclip, Play, Search, Workflow } from 'lucide-react'
import client from '../api/client.js'
import { useAuth } from '../context/AuthContext.jsx'
import { useLanguage } from '../context/LanguageContext.jsx'
import WorkflowDiagram from '../components/WorkflowDiagram.jsx'
import { inputCls, labelCls } from '../ui.js'
import { fmtDate } from '../utils/dates.js'


// A state is shown as a neutral chip with its configured colour as a small dot -- colour carries
// identity only; fills, borders and text stay slate so a row of states is calm, not a rainbow.
function StateChip({ state, lang }) {
  if (!state) return <span className="text-slate-300">—</span>
  const color = state.colorHex || '#94A3B8'
  const label = (lang === 'ar' ? state.nameAr : state.nameEn) || state.code
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-800">
      <span className="h-2 w-2 rounded-full ring-2 ring-offset-0" style={{ backgroundColor: color, '--tw-ring-color': `${color}33` }} />
      {label}
    </span>
  )
}

// Small neutral label with an icon (Start / End / requires comment ...).
function MetaTag({ icon: Icon, children, title }) {
  return (
    <span title={title} className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-1.5 py-0.5 text-[10.5px] font-bold uppercase tracking-wide text-slate-600">
      <Icon size={11} aria-hidden="true" />{children}
    </span>
  )
}

// The six statuses a correspondence request can actually hold. The catalog may contain
// other states (for other engine subjects), but a request can never reach them.
const REQUEST_STATUS_CODES = new Set(['DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'ARCHIVED'])

// The admin-configurable workflow engine (ERD domain 3): a catalog of
// WorkflowState/WorkflowTransition an admin edits, plus a WorkflowInstance
// runtime that walks a (entityType, entityId) subject through it,
// permission-gated per transition. Deliberately NOT wired to
// CorrespondenceRequest itself yet -- see WorkflowInstance's own Javadoc --
// so this page's instance operator works against whatever entityType/
// entityId the user types in (there's no domain object to pick from yet,
// and no GET /instances list endpoint either, so an instance is reached
// by id, the same "type in the id" pattern DocumentCreatePage already
// uses for a divorce certificate's marriageCertificateId).
//
// Catalog edits (add state / add transition) require USER_MANAGE, matching
// SecurityConfig -- the same system-configuration tier as user/role
// management. Operating an instance (create / execute a transition) is
// NOT permission-gated at the route or button level: the backend itself
// leaves those endpoints open and instead checks each transition's own
// requiredPermissionCodes inside executeTransition(), so this page mirrors
// that by only ever offering the transitions availableTransitions already
// filtered for the signed-in user -- never a client-side permission check
// standing in for that server-side one.
export default function WorkflowEnginePage() {
  const { t, lang } = useLanguage()
  const { hasPermission } = useAuth()
  const canManage = hasPermission('USER_MANAGE')

  const [states, setStates] = useState([])
  const [transitions, setTransitions] = useState([])
  const [permissions, setPermissions] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(null)
  const [view, setView] = useState('diagram') // diagram | list
  const [tab, setTab] = useState('design') // design | instances
  const [filter, setFilter] = useState('')

  function load() {
    setLoading(true)
    Promise.all([client.get('/workflow/states'), client.get('/workflow/transitions')])
      .then(([s, tr]) => { setStates(s.data); setTransitions(tr.data) })
      .catch(() => setLoadError(t('workflowEngine.couldNotLoad')))
      .finally(() => setLoading(false))
  }
  useEffect(load, [])

  function stateByCode(code) { return states.find((s) => s.code === code) }
  // How many transitions enter / leave each state, for the state cards.
  const counts = useMemo(() => {
    const m = new Map()
    const bump = (code, k) => m.set(code, { in: 0, out: 0, ...m.get(code), [k]: (m.get(code)?.[k] ?? 0) + 1 })
    transitions.forEach((tr) => { bump(tr.fromStateCode, 'out'); bump(tr.toStateCode, 'in') })
    return m
  }, [transitions])

  function stateById(id) { return states.find((s) => String(s.id) === String(id)) }

  // Structural checks on the catalog, computed from the loaded states/transitions only:
  // a usable workflow has one start, at least one end, every state reachable from the
  // start, and no non-final state that traps a request with no way out.
  const health = useMemo(() => {
    if (states.length === 0) return []
    const issues = []
    const initial = states.filter((x) => x.isInitial)
    const finals = states.filter((x) => x.isFinal)
    if (initial.length === 0) issues.push({ key: 'noInitial', level: 'error', codes: [] })
    if (initial.length > 1) issues.push({ key: 'multiInitial', level: 'warn', codes: initial.map((x) => x.code) })
    if (finals.length === 0) issues.push({ key: 'noFinal', level: 'error', codes: [] })
    if (initial.length > 0) {
      const seen = new Set(initial.map((x) => x.code))
      const queue = [...seen]
      while (queue.length) {
        const cur = queue.shift()
        transitions.filter((tr) => tr.fromStateCode === cur).forEach((tr) => {
          if (!seen.has(tr.toStateCode)) { seen.add(tr.toStateCode); queue.push(tr.toStateCode) }
        })
      }
      const unreachable = states.filter((x) => !seen.has(x.code)).map((x) => x.code)
      if (unreachable.length) issues.push({ key: 'unreachable', level: 'warn', codes: unreachable })
    }
    const deadEnds = states.filter((x) => !x.isFinal && !transitions.some((tr) => tr.fromStateCode === x.code)).map((x) => x.code)
    if (deadEnds.length) issues.push({ key: 'deadEnd', level: 'warn', codes: deadEnds })
    const leaky = states.filter((x) => x.isFinal && transitions.some((tr) => tr.fromStateCode === x.code)).map((x) => x.code)
    if (leaky.length) issues.push({ key: 'finalOut', level: 'warn', codes: leaky })
    return issues
  }, [states, transitions])

  const gatedCount = transitions.filter((tr) => (tr.requiredPermissionCodes ?? []).length > 0).length
  const shownTransitions = useMemo(() => {
    const q = filter.trim().toLowerCase()
    if (!q) return transitions
    return transitions.filter((tr) => [tr.actionCode, tr.labelEn, tr.labelAr, tr.fromStateCode, tr.toStateCode]
      .some((v) => String(v ?? '').toLowerCase().includes(q)))
  }, [transitions, filter])

  // Live feedback while filling in the forms (the server stays the authority).
  const normCode = (v) => v.toUpperCase().replace(/[^A-Z0-9_]+/g, '_')

  // ---- add state -----------------------------------------------------
  const emptyStateForm = { code: '', nameEn: '', nameAr: '', isInitial: false, isFinal: false, displayOrder: '', colorHex: '#6366F1' }
  const [addingState, setAddingState] = useState(false)
  const [stateForm, setStateForm] = useState(emptyStateForm)
  const [stateError, setStateError] = useState(null)
  const [stateBusy, setStateBusy] = useState(false)

  async function handleCreateState(e) {
    e.preventDefault()
    setStateError(null)
    if (!stateForm.code.trim()) { setStateError(t('workflowEngine.errorCodeRequired')); return }
    setStateBusy(true)
    try {
      await client.post('/workflow/states', {
        code: stateForm.code.trim(),
        nameEn: stateForm.nameEn || null,
        nameAr: stateForm.nameAr || null,
        isInitial: stateForm.isInitial,
        isFinal: stateForm.isFinal,
        displayOrder: stateForm.displayOrder ? Number(stateForm.displayOrder) : null,
        colorHex: stateForm.colorHex || null,
      })
      setAddingState(false)
      setStateForm(emptyStateForm)
      load()
    } catch (err) {
      setStateError(err.response?.data?.message ?? t('workflowEngine.errorGeneric'))
    } finally {
      setStateBusy(false)
    }
  }

  // ---- add transition --------------------------------------------------
  const [addingTransition, setAddingTransition] = useState(false)
  const [transitionForm, setTransitionForm] = useState({
    fromStateId: '', toStateId: '', actionCode: '', labelEn: '', labelAr: '',
    requiresComment: false, requiresDocument: false, requiredPermissionIds: [],
  })
  const [transitionError, setTransitionError] = useState(null)
  const [transitionBusy, setTransitionBusy] = useState(false)

  function startAddingTransition() {
    setTransitionForm({
      fromStateId: states[0]?.id ?? '', toStateId: states[0]?.id ?? '', actionCode: '', labelEn: '', labelAr: '',
      requiresComment: false, requiresDocument: false, requiredPermissionIds: [],
    })
    setTransitionError(null)
    setAddingTransition(true)
    if (permissions.length === 0) client.get('/permissions').then((r) => setPermissions(r.data)).catch(() => {})
  }

  function togglePermission(id) {
    setTransitionForm((f) => ({
      ...f,
      requiredPermissionIds: f.requiredPermissionIds.includes(id)
        ? f.requiredPermissionIds.filter((x) => x !== id)
        : [...f.requiredPermissionIds, id],
    }))
  }

  async function handleCreateTransition(e) {
    e.preventDefault()
    setTransitionError(null)
    if (!transitionForm.fromStateId || !transitionForm.toStateId || !transitionForm.actionCode.trim()) {
      setTransitionError(t('workflowEngine.errorTransitionRequired'))
      return
    }
    setTransitionBusy(true)
    try {
      await client.post('/workflow/transitions', {
        fromStateId: Number(transitionForm.fromStateId),
        toStateId: Number(transitionForm.toStateId),
        actionCode: transitionForm.actionCode.trim(),
        labelEn: transitionForm.labelEn || null,
        labelAr: transitionForm.labelAr || null,
        requiresComment: transitionForm.requiresComment,
        requiresDocument: transitionForm.requiresDocument,
        requiredPermissionIds: transitionForm.requiredPermissionIds,
      })
      setAddingTransition(false)
      load()
    } catch (err) {
      setTransitionError(err.response?.data?.message ?? t('workflowEngine.errorGeneric'))
    } finally {
      setTransitionBusy(false)
    }
  }

  // ---- instance operator ------------------------------------------------
  const [lookupId, setLookupId] = useState('')
  const [newEntityType, setNewEntityType] = useState('')
  const [newEntityId, setNewEntityId] = useState('')
  const [instance, setInstance] = useState(null)
  const [availableTransitions, setAvailableTransitions] = useState([])
  const [history, setHistory] = useState([])
  const [instanceError, setInstanceError] = useState(null)
  const [instanceBusy, setInstanceBusy] = useState(false)
  const [pendingAction, setPendingAction] = useState(null)
  const [comment, setComment] = useState('')

  async function loadInstance(id) {
    setInstanceError(null)
    setInstanceBusy(true)
    try {
      const [inst, avail, hist] = await Promise.all([
        client.get(`/workflow/instances/${id}`),
        client.get(`/workflow/instances/${id}/available-transitions`),
        client.get(`/workflow/instances/${id}/history`),
      ])
      setInstance(inst.data)
      setAvailableTransitions(avail.data)
      setHistory(hist.data)
    } catch (err) {
      setInstance(null)
      setAvailableTransitions([])
      setHistory([])
      setInstanceError(err.response?.data?.message ?? t('workflowEngine.instanceNotFound'))
    } finally {
      setInstanceBusy(false)
    }
  }

  function handleLookup(e) {
    e.preventDefault()
    if (!lookupId) return
    loadInstance(Number(lookupId))
  }

  async function handleCreateInstance(e) {
    e.preventDefault()
    setInstanceError(null)
    if (!newEntityType.trim() || !newEntityId) {
      setInstanceError(t('workflowEngine.errorInstanceRequired'))
      return
    }
    setInstanceBusy(true)
    try {
      const res = await client.post('/workflow/instances', {
        entityType: newEntityType.trim(),
        entityId: Number(newEntityId),
      })
      setNewEntityType('')
      setNewEntityId('')
      await loadInstance(res.data.id)
    } catch (err) {
      setInstanceError(err.response?.data?.message ?? t('workflowEngine.errorGeneric'))
      setInstanceBusy(false)
    }
  }

  function clickAvailableTransition(avail) {
    if (avail.requiresComment) {
      setPendingAction(avail.actionCode)
      setComment('')
    } else {
      executeTransition(avail.actionCode, null)
    }
  }

  async function executeTransition(actionCode, commentValue) {
    setInstanceError(null)
    setInstanceBusy(true)
    try {
      await client.post(`/workflow/instances/${instance.id}/transition`, {
        actionCode,
        comment: commentValue || null,
      })
      setPendingAction(null)
      await loadInstance(instance.id)
    } catch (err) {
      setInstanceError(err.response?.data?.message ?? t('workflowEngine.errorGeneric'))
    } finally {
      setInstanceBusy(false)
    }
  }

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-navy">{t('workflowEngine.title')}</h1>
          <p className="mt-1 text-sm text-slate-600">{t('workflowEngine.subtitle')}</p>
        </div>
      </div>

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label={t('workflowEngine.summary')} role="group">
        {[
          { k: 'states', v: states.length, hint: `${states.filter((x) => x.isInitial).length} ${t('workflowEngine.initialTag')} · ${states.filter((x) => x.isFinal).length} ${t('workflowEngine.finalTag')}` },
          { k: 'transitions', v: transitions.length, hint: `${transitions.filter((tr) => tr.requiresComment).length} ${t('workflowEngine.requiresComment').toLowerCase()}` },
          { k: 'gated', v: gatedCount, hint: t('workflowEngine.gatedHint') },
          { k: 'checks', v: health.length === 0 ? '✓' : health.length, hint: health.length === 0 ? t('workflowEngine.checksOk') : t('workflowEngine.checksIssues') },
        ].map((x) => (
          <div key={x.k} className="dash-card p-4">
            <div className="text-[11px] font-bold uppercase tracking-wide text-slate-500">{t(`workflowEngine.tile_${x.k}`)}</div>
            <div className={`mt-1 text-3xl font-extrabold tabular-nums ${x.k === 'checks' && health.length > 0 ? 'text-warn-ink' : 'text-navy'}`}>{x.v}</div>
            <div className="mt-0.5 truncate text-xs text-slate-600">{x.hint}</div>
          </div>
        ))}
      </div>

      {loadError && (
        <div className="rounded-lg border border-badge-danger-bd bg-badge-danger-bg px-4 py-3 text-sm text-badge-danger-fg mb-5" role="alert">{loadError}</div>
      )}

      {/* ---- structure check ---- */}
      {states.length > 0 && (
        <div className={`mb-5 rounded-2xl border p-4 sm:px-5 ${health.length === 0 ? 'border-ok/30 bg-ok-tint' : 'border-warn/30 bg-warn-tint'}`} role="status">
          <div className="flex items-center gap-2.5">
            {health.length === 0
              ? <CheckCircle2 size={18} className="text-ok-ink" aria-hidden="true" />
              : <AlertTriangle size={18} className="text-warn-ink" aria-hidden="true" />}
            <h2 className={`text-sm font-bold ${health.length === 0 ? 'text-ok-ink' : 'text-warn-ink'}`}>
              {health.length === 0 ? t('workflowEngine.checksOkTitle') : t('workflowEngine.checksIssuesTitle')}
            </h2>
          </div>
          {health.length > 0 && (
            <ul className="mt-2 space-y-1 ps-7 text-sm text-slate-700">
              {health.map((h) => (
                <li key={h.key} className="list-disc">
                  <span className={h.level === 'error' ? 'font-semibold text-crit-ink' : ''}>{t(`workflowEngine.check_${h.key}`)}</span>
                  {h.codes.length > 0 && <> {h.codes.map((c) => <code key={c} className="me-1 rounded bg-white/70 px-1 font-mono text-xs">{c}</code>)}</>}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* ---- tabs ---- */}
      <div role="tablist" aria-label={t('workflowEngine.title')} className="mb-4 inline-flex rounded-xl border border-hairline bg-white p-1 shadow-sm">
        {[['design', Workflow], ['instances', Play]].map(([k, Icon]) => (
          <button key={k} type="button" role="tab" aria-selected={tab === k} onClick={() => setTab(k)}
            className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${tab === k ? 'bg-navy text-white shadow-sm' : 'text-slate-600 hover:text-navy'}`}>
            <Icon size={15} aria-hidden="true" />{t(`workflowEngine.tab_${k}`)}
          </button>
        ))}
      </div>

      {tab === 'design' && (
      <>
      {/* ---- catalog: states ---- */}
      <div className="dash-card p-5 sm:p-6 mb-4">
        <div className="flex items-start justify-between gap-3 mb-4">
          <div>
            <h2 className="text-base font-bold text-navy">{t('workflowEngine.states')}</h2>
            <p className="mt-0.5 text-xs text-slate-600">{t('workflowEngine.statesHint')}</p>
          </div>
          {!addingState && canManage && (
            <button type="button" onClick={() => setAddingState(true)} className="whitespace-nowrap rounded-lg border border-brand/30 bg-brand-tint px-3 py-1.5 text-sm font-semibold text-brand hover:bg-brand/10">
              + {t('workflowEngine.addState').replace(/^\+\s*/, '')}
            </button>
          )}
        </div>

        {addingState && (
          <form onSubmit={handleCreateState} className="mb-5 rounded-xl border border-brand/20 bg-slate-50/70 p-4 sm:p-5">
            {stateError && <div className="rounded-lg border border-badge-danger-bd bg-badge-danger-bg px-4 py-3 text-sm text-badge-danger-fg mb-4" role="alert">{stateError}</div>}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
              <div>
                <label className={labelCls} htmlFor="ws-code">
                  {t('workflowEngine.code')} <span className="text-required">*</span>
                </label>
                <input id="ws-code" className={inputCls} required value={stateForm.code} onChange={(e) => setStateForm({ ...stateForm, code: normCode(e.target.value) })} />
                {states.some((x) => x.code === stateForm.code.trim()) && <p className="mt-1 text-xs font-semibold text-crit-ink">{t('workflowEngine.codeTaken')}</p>}
                {stateForm.code.trim() && !states.some((x) => x.code === stateForm.code.trim()) && !REQUEST_STATUS_CODES.has(stateForm.code.trim()) && (
                  <p className="mt-1 text-xs font-semibold text-warn-ink">{t('workflowEngine.newCodeWarning')}</p>
                )}
              </div>
              <div>
                <label className={labelCls} htmlFor="ws-order">{t('workflowEngine.displayOrder')}</label>
                <input id="ws-order" type="number" className={inputCls} value={stateForm.displayOrder} onChange={(e) => setStateForm({ ...stateForm, displayOrder: e.target.value })} />
              </div>
              <div>
                <label className={labelCls} htmlFor="ws-name-en">{t('workflowEngine.nameEn')}</label>
                <input id="ws-name-en" className={inputCls} value={stateForm.nameEn} onChange={(e) => setStateForm({ ...stateForm, nameEn: e.target.value })} />
              </div>
              <div>
                <label className={labelCls} htmlFor="ws-name-ar">{t('workflowEngine.nameAr')}</label>
                <input id="ws-name-ar" dir="rtl" className={inputCls} value={stateForm.nameAr} onChange={(e) => setStateForm({ ...stateForm, nameAr: e.target.value })} />
              </div>
              <div>
                <label className={labelCls} htmlFor="ws-color">{t('workflowEngine.color')}</label>
                <input id="ws-color" type="color" className="h-10 w-full rounded-lg border border-border-subtle" value={stateForm.colorHex} onChange={(e) => setStateForm({ ...stateForm, colorHex: e.target.value })} />
              </div>
              <div className="flex items-end gap-5 pb-2.5">
                <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
                  <input type="checkbox" checked={stateForm.isInitial} onChange={(e) => setStateForm({ ...stateForm, isInitial: e.target.checked })} />
                  {t('workflowEngine.isInitial')}
                </label>
                <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
                  <input type="checkbox" checked={stateForm.isFinal} onChange={(e) => setStateForm({ ...stateForm, isFinal: e.target.checked })} />
                  {t('workflowEngine.isFinal')}
                </label>
              </div>
            </div>
            <p className="text-xs text-text-secondary mb-3">{t('workflowEngine.initialHint')}</p>
            <div className="mb-4 flex items-center gap-2 text-xs font-semibold text-slate-500">{t('workflowEngine.preview')}: <StateChip state={{ code: stateForm.code || '—', nameEn: stateForm.nameEn, nameAr: stateForm.nameAr, colorHex: stateForm.colorHex }} lang={lang} /></div>
            <div className="flex justify-end gap-2.5">
              <button type="button" onClick={() => setAddingState(false)} className="btn-secondary">
                {t('common.cancel')}
              </button>
              <button type="submit" disabled={stateBusy} className="btn-primary ">
                {stateBusy ? t('workflowEngine.submitting') : t('workflowEngine.submit')}
              </button>
            </div>
          </form>
        )}

        {!loading && states.length === 0 ? (
          <p className="text-sm text-text-secondary">{t('workflowEngine.noStates')}</p>
        ) : (
          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6" aria-label={t('workflowEngine.states')}>
            {states.map((s) => {
              const color = s.colorHex || '#94A3B8'
              const inN = counts.get(s.code)?.in ?? 0
              const outN = counts.get(s.code)?.out ?? 0
              return (
                <li key={s.id} className="flex flex-col gap-2.5 rounded-xl border border-slate-200 bg-white p-3.5 transition-shadow hover:shadow-md">
                  <div className="flex items-center gap-2.5">
                    <span className="h-3 w-3 shrink-0 rounded-full ring-4" style={{ backgroundColor: color, '--tw-ring-color': `${color}26` }} aria-hidden="true" />
                    <span className="min-w-0 truncate text-sm font-bold text-navy">{(lang === 'ar' ? s.nameAr : s.nameEn) || s.code}</span>
                  </div>
                  <code className="truncate font-mono text-[11px] text-slate-500">{s.code}</code>
                  <div className="mt-auto flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-2.5">
                    <span className="text-[11px] font-semibold text-slate-500">
                      <b className="text-slate-800">{inN}</b> {t('workflowEngine.inCount')} · <b className="text-slate-800">{outN}</b> {t('workflowEngine.outCount')}
                    </span>
                    {s.isInitial && <MetaTag icon={Play}>{t('workflowEngine.initialTag')}</MetaTag>}
                    {s.isFinal && <MetaTag icon={Flag}>{t('workflowEngine.finalTag')}</MetaTag>}
                    {REQUEST_STATUS_CODES.has(s.code)
                      ? <MetaTag icon={Inbox} title={t('workflowEngine.usedByRequestsHint')}>{t('workflowEngine.usedByRequests')}</MetaTag>
                      : <MetaTag icon={AlertTriangle} title={t('workflowEngine.engineOnlyHint')}>{t('workflowEngine.engineOnly')}</MetaTag>}
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      {/* ---- catalog: transitions ---- */}
      <div className="dash-card p-5 sm:p-6 mb-4">
        <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
          <div>
            <h2 className="text-base font-bold text-navy">{t('workflowEngine.transitions')}</h2>
            <p className="mt-0.5 text-xs text-slate-600">{t('workflowEngine.transitionsHint')}</p>
          </div>
          <div className="flex items-center gap-3">
          <div className="inline-flex rounded-lg border border-hairline bg-slate-50 p-0.5 text-xs font-semibold" role="group" aria-label={t('workflowEngine.viewLabel')}>
            {['diagram', 'list'].map((v) => (
              <button
                key={v}
                type="button"
                aria-pressed={view === v}
                onClick={() => setView(v)}
                className={`rounded-md px-2.5 py-1 ${view === v ? 'bg-navy text-white shadow-sm' : 'text-slate-600 hover:text-navy'}`}
              >
                {t(`workflowEngine.view_${v}`)}
              </button>
            ))}
          </div>
          {!addingTransition && canManage && (
            <button type="button" onClick={startAddingTransition} className="whitespace-nowrap rounded-lg border border-brand/30 bg-brand-tint px-3 py-1.5 text-sm font-semibold text-brand hover:bg-brand/10">
              + {t('workflowEngine.addTransition').replace(/^\+\s*/, '')}
            </button>
          )}
          </div>
        </div>

        {addingTransition && (
          <form onSubmit={handleCreateTransition} className="mb-5 rounded-xl border border-brand/20 bg-slate-50/70 p-4 sm:p-5">
            {transitionError && <div className="rounded-lg border border-badge-danger-bd bg-badge-danger-bg px-4 py-3 text-sm text-badge-danger-fg mb-4" role="alert">{transitionError}</div>}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
              <div>
                <label className={labelCls} htmlFor="wt-from">
                  {t('workflowEngine.fromState')} <span className="text-required">*</span>
                </label>
                <select id="wt-from" className={inputCls} value={transitionForm.fromStateId} onChange={(e) => setTransitionForm({ ...transitionForm, fromStateId: e.target.value })}>
                  {states.map((s) => <option key={s.id} value={s.id}>{s.code}{(lang === 'ar' ? s.nameAr : s.nameEn) ? ` — ${lang === 'ar' ? s.nameAr : s.nameEn}` : ''}</option>)}
                </select>
              </div>
              <div>
                <label className={labelCls} htmlFor="wt-to">
                  {t('workflowEngine.toState')} <span className="text-required">*</span>
                </label>
                <select id="wt-to" className={inputCls} value={transitionForm.toStateId} onChange={(e) => setTransitionForm({ ...transitionForm, toStateId: e.target.value })}>
                  {states.map((s) => <option key={s.id} value={s.id}>{s.code}{(lang === 'ar' ? s.nameAr : s.nameEn) ? ` — ${lang === 'ar' ? s.nameAr : s.nameEn}` : ''}</option>)}
                </select>
              </div>
              <div>
                <label className={labelCls} htmlFor="wt-action">
                  {t('workflowEngine.actionCode')} <span className="text-required">*</span>
                </label>
                <input id="wt-action" className={inputCls} required value={transitionForm.actionCode} onChange={(e) => setTransitionForm({ ...transitionForm, actionCode: normCode(e.target.value) })} />
                <p className="text-xs text-text-secondary mt-1">{t('workflowEngine.actionCodeHint')}</p>
              </div>
              <div>
                <label className={labelCls} htmlFor="wt-label-en">{t('workflowEngine.labelEn')}</label>
                <input id="wt-label-en" className={inputCls} value={transitionForm.labelEn} onChange={(e) => setTransitionForm({ ...transitionForm, labelEn: e.target.value })} />
              </div>
              <div>
                <label className={labelCls} htmlFor="wt-label-ar">{t('workflowEngine.labelAr')}</label>
                <input id="wt-label-ar" dir="rtl" className={inputCls} value={transitionForm.labelAr} onChange={(e) => setTransitionForm({ ...transitionForm, labelAr: e.target.value })} />
              </div>
              <div className="flex items-end gap-5 pb-2.5">
                <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
                  <input type="checkbox" checked={transitionForm.requiresComment} onChange={(e) => setTransitionForm({ ...transitionForm, requiresComment: e.target.checked })} />
                  {t('workflowEngine.requiresComment')}
                </label>
                <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
                  <input type="checkbox" checked={transitionForm.requiresDocument} onChange={(e) => setTransitionForm({ ...transitionForm, requiresDocument: e.target.checked })} />
                  {t('workflowEngine.requiresDocument')}
                </label>
              </div>
            </div>
            <p className="text-xs text-text-secondary mb-3">{t('workflowEngine.requiresDocumentHint')}</p>
            {(() => {
              const from = stateById(transitionForm.fromStateId)
              const to = stateById(transitionForm.toStateId)
              const loop = from && to && from.id === to.id
              const dup = from && to && transitions.some((tr) => tr.fromStateCode === from.code && tr.toStateCode === to.code && tr.actionCode === transitionForm.actionCode.trim())
              return (
                <div className="mb-4 rounded-lg border border-slate-200 bg-white p-3">
                  <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-slate-500">
                    {t('workflowEngine.preview')}: <StateChip state={from} lang={lang} />
                    <ArrowRight size={14} className="rtl:rotate-180" aria-hidden="true" />
                    <StateChip state={to} lang={lang} />
                    {transitionForm.actionCode && <code className="font-mono text-[11px]">({transitionForm.actionCode})</code>}
                  </div>
                  {loop && <p className="mt-2 text-xs font-semibold text-warn-ink">{t('workflowEngine.selfLoop')}</p>}
                  {dup && <p className="mt-2 text-xs font-semibold text-crit-ink">{t('workflowEngine.duplicateTransition')}</p>}
                </div>
              )
            })()}

            <label className={labelCls}>{t('workflowEngine.requiredPermissions')}</label>
            <p className="text-xs text-text-secondary mb-2">{t('workflowEngine.requiredPermissionsHint')}</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-4 max-h-48 overflow-y-auto rounded-lg border border-border-subtle p-3">
              {permissions.map((p) => (
                <label key={p.id} className="flex items-center gap-2 text-sm text-slate-700">
                  <input type="checkbox" checked={transitionForm.requiredPermissionIds.includes(p.id)} onChange={() => togglePermission(p.id)} />
                  <span className="font-mono text-xs">{p.code}</span>
                </label>
              ))}
            </div>

            <div className="flex justify-end gap-2.5">
              <button type="button" onClick={() => setAddingTransition(false)} className="btn-secondary">
                {t('common.cancel')}
              </button>
              <button type="submit" disabled={transitionBusy} className="btn-primary ">
                {transitionBusy ? t('workflowEngine.submitting') : t('workflowEngine.submit')}
              </button>
            </div>
          </form>
        )}

        {!loading && transitions.length === 0 ? (
          <p className="text-sm text-text-secondary">{t('workflowEngine.noTransitions')}</p>
        ) : view === 'diagram' ? (
          <WorkflowDiagram
            states={states}
            transitions={transitions}
            lang={lang}
            label={t('workflowEngine.diagramLabel')}
            currentCode={instance?.currentStateCode}
            currentLabel={t('workflowEngine.currentTag')}
          />
        ) : (
          <>
          <div className="relative mb-3 max-w-sm">
            <Search size={15} className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden="true" />
            <input type="search" value={filter} onChange={(e) => setFilter(e.target.value)} placeholder={t('workflowEngine.filterPlaceholder')}
              aria-label={t('workflowEngine.filterPlaceholder')} className={`${inputCls} ps-9`} />
          </div>
          {shownTransitions.length === 0 && <p className="py-6 text-center text-sm text-slate-600">{t('workflowEngine.noMatch')}</p>}
          <ul className="divide-y divide-slate-100" aria-label={t('workflowEngine.transitions')}>
            {shownTransitions.map((tr) => (
              <li key={tr.id} className="grid grid-cols-1 items-center gap-x-6 gap-y-2 py-3.5 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)_minmax(0,1fr)]">
                <div className="flex flex-wrap items-center gap-2">
                  <StateChip state={stateByCode(tr.fromStateCode)} lang={lang} />
                  <ArrowRight size={15} className="text-slate-400 rtl:rotate-180" aria-hidden="true" />
                  <StateChip state={stateByCode(tr.toStateCode)} lang={lang} />
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-bold text-navy">{(lang === 'ar' ? tr.labelAr : tr.labelEn) || tr.actionCode}</div>
                  <code className="font-mono text-[11px] text-slate-500">({tr.actionCode})</code>
                </div>
                <div className="flex flex-wrap items-center gap-1.5 lg:justify-end">
                  {tr.requiresComment && <MetaTag icon={MessageSquare}>{t('workflowEngine.requiresComment')}</MetaTag>}
                  {tr.requiresDocument && <MetaTag icon={Paperclip} title={t('workflowEngine.requiresDocumentHint')}>{t('workflowEngine.requiresDocument')}</MetaTag>}
                  {tr.requiredPermissionCodes.map((code) => (
                    <span key={code} className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-1.5 py-0.5 font-mono text-[10.5px] text-slate-600">
                      <KeyRound size={10} aria-hidden="true" />{code}
                    </span>
                  ))}
                </div>
              </li>
            ))}
          </ul>
          </>
        )}
        {!(transitions.length === 0) && view === 'diagram' && (
          <p className="mt-3 flex items-center gap-2 text-xs text-slate-500"><GitBranch size={13} aria-hidden="true" />{t('workflowEngine.diagramHint')}</p>
        )}
      </div>

      </>
      )}

      {/* ---- instance operator ---- */}
      {tab === 'instances' && (
      <div className="dash-card p-5 sm:p-6">
        <h2 className="text-base font-bold text-navy mb-0.5">{t('workflowEngine.instances')}</h2>
        <p className="text-xs text-slate-600 mb-4">{t('workflowEngine.instancesHint')}</p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5">
          <form onSubmit={handleLookup} className="rounded-lg border border-border-subtle p-4">
            <label className={labelCls} htmlFor="wi-lookup">{t('workflowEngine.lookupById')}</label>
            <div className="flex gap-2">
              <input id="wi-lookup" type="number" className={inputCls} value={lookupId} onChange={(e) => setLookupId(e.target.value)} />
              <button type="submit" disabled={instanceBusy} className="rounded-lg bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-border-subtle whitespace-nowrap">
                {t('workflowEngine.lookup')}
              </button>
            </div>
          </form>
          <form onSubmit={handleCreateInstance} className="rounded-lg border border-border-subtle p-4">
            <label className={labelCls}>{t('workflowEngine.startNew')}</label>
            <div className="flex gap-2">
              <input placeholder={t('workflowEngine.entityType')} className={inputCls} value={newEntityType} onChange={(e) => setNewEntityType(e.target.value)} />
              <input type="number" placeholder={t('workflowEngine.entityId')} className={inputCls} value={newEntityId} onChange={(e) => setNewEntityId(e.target.value)} />
              <button type="submit" disabled={instanceBusy} className="btn-primary whitespace-nowrap ">
                {t('workflowEngine.start')}
              </button>
            </div>
          </form>
        </div>

        {instanceError && (
          <div className="rounded-lg border border-badge-danger-bd bg-badge-danger-bg px-4 py-3 text-sm text-badge-danger-fg mb-4" role="alert">{instanceError}</div>
        )}

        {instance && (
          <div className="rounded-lg border border-border-subtle p-4">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
              <div>
                <div className="text-sm font-bold text-text-primary">{instance.entityType} #{instance.entityId}</div>
                <div className="text-xs text-text-secondary">{t('workflowEngine.instanceId')} {instance.id}</div>
              </div>
              <StateChip state={stateByCode(instance.currentStateCode)} lang={lang} />
            </div>

            <div className="mb-4">
              <div className="text-[11px] font-bold uppercase tracking-wide text-text-secondary mb-2">{t('workflowEngine.availableTransitions')}</div>
              {availableTransitions.length === 0 ? (
                <p className="text-sm text-text-secondary">{t('workflowEngine.noAvailableTransitions')}</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {availableTransitions.map((av) => (
                    <button
                      key={av.id}
                      type="button"
                      disabled={instanceBusy}
                      onClick={() => clickAvailableTransition(av)}
                      className="btn-primary "
                      title={av.requiresDocument ? t('workflowEngine.requiresDocumentHint') : undefined}
                    >
                      {(lang === 'ar' ? av.labelAr : av.labelEn) || av.actionCode}
                      {av.requiresDocument && ' *'}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {pendingAction && (
              <div className="rounded-lg border border-badge-warning-bd bg-badge-warning-bg p-3 mb-4">
                <label className={labelCls} htmlFor="wi-comment">{t('workflowEngine.commentRequired')}</label>
                <textarea id="wi-comment" rows={2} className={inputCls} value={comment} onChange={(e) => setComment(e.target.value)} />
                <div className="flex justify-end gap-2 mt-2">
                  <button type="button" onClick={() => setPendingAction(null)} className="btn-secondary btn-sm">
                    {t('common.cancel')}
                  </button>
                  <button
                    type="button"
                    disabled={!comment.trim() || instanceBusy}
                    onClick={() => executeTransition(pendingAction, comment.trim())}
                    className="btn-primary btn-sm "
                  >
                    {t('workflowEngine.confirmTransition')}
                  </button>
                </div>
              </div>
            )}

            <div>
              <div className="text-[11px] font-bold uppercase tracking-wide text-text-secondary mb-2">{t('workflowEngine.history')}</div>
              {history.length === 0 ? (
                <p className="text-sm text-text-secondary">{t('workflowEngine.noHistory')}</p>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {history.map((h) => (
                    <li key={h.id} className="py-2 text-sm">
                      <div className="flex flex-wrap items-center gap-2">
                        <StateChip state={stateByCode(h.fromStateCode)} lang={lang} />
                        <span className="text-slate-300">→</span>
                        <StateChip state={stateByCode(h.toStateCode)} lang={lang} />
                        <span className="text-xs text-text-secondary">
                          {h.actorName ?? t('workflowEngine.unknownActor')} · {fmtDate(h.occurredAt, 'MMM d, yyyy HH:mm')}
                        </span>
                      </div>
                      {h.comment && <div className="text-xs text-text-secondary mt-1">{h.comment}</div>}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
      </div>
      )}
    </div>
  )
}
