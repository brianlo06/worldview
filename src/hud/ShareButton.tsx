// Reusable one-tap Share control. Creates a share (POST /share) from a payload
// built lazily at click time, then shows the resulting /s/<id> link and copies
// it to the clipboard. Used by both the ask answer card and the selection card,
// so anything — an ask answer or any clicked event — is shareable.

import { useState } from 'react'
import { createShare } from '../api/client'
import { audio } from '../audio/audio'

export interface SharePayload {
  kind: 'ask' | 'city' | 'cluster' | 'view' | 'pull'
  params?: Record<string, string>
  title?: string | null
  place?: string | null
  question?: string | null
  answer?: string | null
  flyLat?: number | null
  flyLon?: number | null
  stats?: Record<string, unknown>
}

export function ShareButton({ build }: { build: () => SharePayload }) {
  const [status, setStatus] = useState<'idle' | 'pending' | 'copied' | 'error'>('idle')
  const [url, setUrl] = useState<string | null>(null)

  async function onShare() {
    audio.click()
    setStatus('pending')
    setUrl(null)
    try {
      const created = await createShare(build())
      setUrl(created.url)
      try {
        await navigator.clipboard.writeText(created.url)
        setStatus('copied')
      } catch {
        setStatus('idle') // clipboard blocked — link still shown for manual copy
      }
    } catch {
      setStatus('error')
    }
  }

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <button
        type="button"
        onClick={onShare}
        disabled={status === 'pending'}
        className="border border-[#7be0ff]/50 bg-[#4cc9ff]/8 px-2.5 py-1 text-hud-2xs tracking-[0.2em] text-[#7be0ff] hover:bg-[#4cc9ff]/15 transition disabled:opacity-50"
      >
        {status === 'pending' ? 'CREATING…' : '⇪ SHARE'}
      </button>
      {status === 'copied' && (
        <span className="text-hud-2xs tracking-[0.2em] text-[#9affb2]">✓ LINK COPIED</span>
      )}
      {status === 'error' && (
        <span className="text-hud-2xs tracking-[0.2em] text-[#ff8888]">SHARE FAILED</span>
      )}
      {url && (
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-hud-2xs tracking-wide normal-case text-[#4cc9ff]/80 hover:text-[#7be0ff] truncate max-w-[14rem]"
        >
          {url.replace(/^https?:\/\//, '')}
        </a>
      )}
    </div>
  )
}
