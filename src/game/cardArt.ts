// Deterministic generative card background: contour-line field seeded by the
// card's art_seed, tinted with the category color. Same seed → same art,
// everywhere, forever — no image assets.

function mulberry32(seed: number) {
  let a = seed >>> 0
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function drawCardArt(
  canvas: HTMLCanvasElement,
  artSeed: number,
  color: string,
) {
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  const { width: w, height: h } = canvas
  // Split the (possibly > 2^32) seed for the PRNG.
  const rand = mulberry32((artSeed % 0xffffffff) ^ Math.floor(artSeed / 0xffffffff))

  ctx.clearRect(0, 0, w, h)
  ctx.fillStyle = '#03060d'
  ctx.fillRect(0, 0, w, h)

  // Flow-field contour lines
  const lines = 14 + Math.floor(rand() * 8)
  const phase = rand() * Math.PI * 2
  const freq = 0.8 + rand() * 1.6
  const amp = h * (0.05 + rand() * 0.09)
  ctx.lineWidth = 1
  for (let i = 0; i < lines; i++) {
    const yBase = (h * (i + 0.5)) / lines
    const jitter = rand() * Math.PI * 2
    ctx.beginPath()
    for (let x = 0; x <= w; x += 4) {
      const y =
        yBase +
        Math.sin((x / w) * Math.PI * 2 * freq + phase + jitter) * amp *
          Math.sin((i / lines) * Math.PI)
      if (x === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    }
    ctx.strokeStyle = color
    ctx.globalAlpha = 0.05 + 0.1 * rand()
    ctx.stroke()
  }

  // Sparse star points
  const stars = 20 + Math.floor(rand() * 30)
  ctx.globalAlpha = 1
  for (let i = 0; i < stars; i++) {
    const x = rand() * w
    const y = rand() * h
    const r = rand() * 1.4 + 0.3
    ctx.beginPath()
    ctx.arc(x, y, r, 0, Math.PI * 2)
    ctx.fillStyle = color
    ctx.globalAlpha = 0.12 + rand() * 0.35
    ctx.fill()
  }
  ctx.globalAlpha = 1
}
