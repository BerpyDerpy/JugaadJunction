import React, { useState, useEffect, useRef, useCallback } from 'react'

// ─── NameTag ────────────────────────────────────────────────────
// shows username with real name on hover (desktop) or tap (mobile).
// click-outside and scroll dismiss the tooltip.
export default function NameTag({ username, realName, className, children, style }) {
    const [open, setOpen] = useState(false)
    const ref = useRef(null)

    // dismiss on outside click or scroll
    useEffect(() => {
        if (!open) return
        const dismiss = () => setOpen(false)
        document.addEventListener('click', dismiss, true)
        document.addEventListener('scroll', dismiss, true)
        return () => {
            document.removeEventListener('click', dismiss, true)
            document.removeEventListener('scroll', dismiss, true)
        }
    }, [open])

    const handleTap = useCallback((e) => {
        e.stopPropagation()
        setOpen(prev => !prev)
    }, [])

    return (
        <span
            ref={ref}
            style={style}
            className={`mp-nametag ${className || ''} ${open ? 'mp-nametag-active' : ''}`}
            onClick={handleTap}
        >
            {children || `@${username}`}
            <span className="mp-nametag-tip">{realName || 'Unknown'}</span>
        </span>
    )
}
