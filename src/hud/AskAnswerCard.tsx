import type { AskAnswer, AskResultItem } from '../api/client'

export type ShareStatus = 'idle' | 'pending' | 'error' | 'copied'

// The answer card under the ask input: answer text, related-result list, and
// the share button. Display-only — all actions come in as props.
export function AskAnswerCard({
  answer,
  shareUrl,
  shareStatus,
  onShare,
  onSelectResult,
}: {
  answer: AskAnswer
  shareUrl: string | null
  shareStatus: ShareStatus
  onShare: () => void
  onSelectResult: (r: AskResultItem) => void
}) {
  return (
    <div className="mt-2 border border-[#4cc9ff]/40 bg-[#02040a]/85 backdrop-blur-sm px-3 py-2.5">
      <div className="flex items-center gap-2 text-hud-2xs tracking-[0.22em] text-[#4cc9ff]/70 uppercase">
        <span className="w-1.5 h-1.5 rounded-full bg-[#7be0ff] shadow-[0_0_6px_#7be0ff]" />
        <span>WORLDVIEW</span>
        {answer.place && <span className="opacity-60">· {answer.place}</span>}
        <span className="ml-auto opacity-45">{answer.source}</span>
      </div>
      <div className="mt-1.5 text-hud-sm normal-case tracking-normal leading-relaxed text-[#dfeeff] max-h-[22vh] overflow-y-auto">
        {answer.answer}
      </div>

      {/* Nearby / related stories — click any to fly there and open it.
          This is what makes "view from your city" surface several results. */}
      {answer.results.length > 1 && (
        <ul className="mt-2 border-t border-[#4cc9ff]/15 pt-2 space-y-0.5 max-h-[30vh] overflow-y-auto pr-1">
          {answer.results.map((r, i) => (
            <li
              key={r.id ?? i}
              onClick={() => onSelectResult(r)}
              className="group flex items-start gap-2 px-1.5 py-1 cursor-pointer hover:bg-[#4cc9ff]/8 transition"
            >
              <span
                className="inline-block w-1.5 h-1.5 rounded-full mt-[6px] flex-shrink-0 bg-[#4cc9ff]"
                style={{ boxShadow: '0 0 5px #4cc9ff90' }}
              />
              <div className="min-w-0 flex-1">
                <div className="text-hud-sm normal-case tracking-normal leading-snug text-[#dfeeff] line-clamp-2 group-hover:text-[#eaf4ff]">
                  {r.title}
                </div>
                <div className="text-hud-2xs opacity-50 normal-case tracking-wide mt-0.5 flex items-center gap-1.5">
                  {r.place && <span>{r.place}</span>}
                  {r.place && r.sourceOutlet && <span className="opacity-60">·</span>}
                  {r.sourceOutlet && <span className="truncate">{r.sourceOutlet}</span>}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-2.5 flex items-center gap-2">
        <button
          type="button"
          onClick={onShare}
          disabled={shareStatus === 'pending'}
          className="border border-[#7be0ff]/50 bg-[#4cc9ff]/8 px-2.5 py-1 text-hud-2xs tracking-[0.2em] text-[#7be0ff] hover:bg-[#4cc9ff]/15 transition disabled:opacity-50"
        >
          {shareStatus === 'pending' ? 'CREATING…' : '⇪ SHARE'}
        </button>
        {shareStatus === 'copied' && (
          <span className="text-hud-2xs tracking-[0.2em] text-[#9affb2]">
            ✓ LINK COPIED
          </span>
        )}
        {shareStatus === 'error' && (
          <span className="text-hud-2xs tracking-[0.2em] text-[#ff8888]">
            SHARE FAILED
          </span>
        )}
        {shareUrl && (
          <a
            href={shareUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-hud-2xs tracking-wide normal-case text-[#4cc9ff]/80 hover:text-[#7be0ff] truncate"
          >
            {shareUrl.replace(/^https?:\/\//, '')}
          </a>
        )}
      </div>
    </div>
  )
}
