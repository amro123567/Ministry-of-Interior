import { useEffect, useMemo, useState } from 'react'
import { useLanguage } from '../context/LanguageContext.jsx'

// A generic office/court/mukhtar picker with an optional governorate ->
// district narrowing pair above it, reused across every form in the app
// that picks one of those three (all three carry their own `districtId` --
// see Office/Court/Mukhtar entities -- and District itself carries a
// `governorateId`). The governorate/district selects are a pure
// client-side filter over `items`: only `value` (the office/court/mukhtar
// id) is ever submitted to the backend, since no endpoint in this app
// accepts a governorateId or districtId directly. Matches the
// documentKinds.js precedent from the Documents step -- one shared,
// data-driven component instead of a near-identical filter hand-copied
// into 6 different forms.
//
// An item with no districtId (only ever true for legacy offices -- see
// Office.district's own Javadoc; Court and Mukhtar both require a
// district) is always shown when no district/governorate filter is
// active, since it can't be excluded by a filter it has no data for, but
// disappears once a specific governorate or district is chosen, since it
// can't be confirmed to belong there either.
export default function DistrictScopedSelect({
  id,
  label,
  required,
  className,
  labelClassName,
  items,
  districts,
  governorates,
  value,
  onChange,
  noneLabel,
  itemLabel,
}) {
  const { t } = useLanguage()
  const [govFilter, setGovFilter] = useState('all')
  const [distFilter, setDistFilter] = useState('all')

  const districtsInGov = useMemo(
    () => (govFilter === 'all' ? districts : districts.filter((d) => String(d.governorateId) === govFilter)),
    [districts, govFilter],
  )

  const filteredItems = useMemo(() => {
    if (distFilter !== 'all') return items.filter((i) => String(i.districtId) === distFilter)
    if (govFilter !== 'all') {
      const idsInGov = new Set(districtsInGov.map((d) => String(d.id)))
      return items.filter((i) => i.districtId != null && idsInGov.has(String(i.districtId)))
    }
    return items
  }, [items, distFilter, govFilter, districtsInGov])

  // If the current selection no longer matches the active filter (the
  // user narrowed the governorate/district after already picking an
  // item), clear it rather than silently keeping a hidden, filtered-out
  // value selected.
  useEffect(() => {
    if (value && !filteredItems.some((i) => String(i.id) === String(value))) {
      onChange('')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filteredItems])

  function handleGovChange(v) {
    setGovFilter(v)
    setDistFilter('all')
  }

  function handleDistChange(v) {
    setDistFilter(v)
    if (v !== 'all') {
      const d = districts.find((x) => String(x.id) === v)
      if (d) setGovFilter(String(d.governorateId))
    }
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
      <div>
        <label className={labelClassName}>{t('locationFilter.governorate')}</label>
        <select className={className} value={govFilter} onChange={(e) => handleGovChange(e.target.value)}>
          <option value="all">{t('locationFilter.allGovernorates')}</option>
          {governorates.map((g) => <option key={g.id} value={g.id}>{g.nameEn}</option>)}
        </select>
      </div>
      <div>
        <label className={labelClassName}>{t('locationFilter.district')}</label>
        <select className={className} value={distFilter} onChange={(e) => handleDistChange(e.target.value)}>
          <option value="all">{t('locationFilter.allDistricts')}</option>
          {districtsInGov.map((d) => <option key={d.id} value={d.id}>{d.nameEn}</option>)}
        </select>
      </div>
      <div>
        <label className={labelClassName} htmlFor={id}>{label}</label>
        <select
          id={id}
          className={className}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          required={required}
          aria-required={required || undefined}
        >
          {noneLabel !== undefined && <option value="">{noneLabel}</option>}
          {filteredItems.map((i) => <option key={i.id} value={i.id}>{itemLabel ? itemLabel(i) : i.nameEn}</option>)}
        </select>
      </div>
    </div>
  )
}
