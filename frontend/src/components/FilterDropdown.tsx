import { useEffect, useRef, useState } from 'react'

export type FilterDropdownItem = {
  value: string
  /** Label on the closed trigger */
  labelShort: string
  /** Label shown in the open menu */
  labelFull: string
}

export function FilterDropdown(props: {
  ariaLabel: string
  /** Native tooltip when hovering the closed control */
  buttonTitle?: string
  value: string
  onChange: (value: string) => void
  items: readonly FilterDropdownItem[]
  /** Extra class on the root (e.g. layout in a flex row) */
  className?: string
}) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const close = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [open])

  useEffect(() => {
    if (!open) return
    const esc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', esc)
    return () => window.removeEventListener('keydown', esc)
  }, [open])

  const selected = props.items.find(i => i.value === props.value)
  const buttonLabel = selected?.labelShort ?? props.items[0]?.labelShort ?? ''

  const rootClass = ['filter-dropdown', open ? 'filter-dropdown--open' : '', props.className ?? '']
    .filter(Boolean)
    .join(' ')

  return (
    <div ref={rootRef} className={rootClass}>
      <button
        type="button"
        className="filter-dropdown__trigger"
        aria-label={props.ariaLabel}
        title={props.buttonTitle}
        aria-expanded={open}
        aria-haspopup="listbox"
        onClick={() => setOpen(o => !o)}
      >
        <span className="filter-dropdown__trigger-text">{buttonLabel}</span>
        <span className="filter-dropdown__chevron" aria-hidden />
      </button>
      {open ? (
        <ul className="filter-dropdown__menu" role="listbox">
          {props.items.map(it => (
            <li key={it.value} role="presentation">
              <button
                type="button"
                role="option"
                aria-selected={props.value === it.value}
                className={`filter-dropdown__option ${props.value === it.value ? 'is-selected' : ''}`}
                onClick={() => {
                  props.onChange(it.value)
                  setOpen(false)
                }}
              >
                {it.labelFull}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}
