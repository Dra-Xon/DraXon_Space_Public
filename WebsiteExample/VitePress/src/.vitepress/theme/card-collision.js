// Only outward normal motion that actually reverses produces an impact.
export function reflectAxis(position, velocity, min, max) {
  const clamped = Math.max(min, Math.min(max, position))
  if (max <= min) return { position: clamped, velocity: 0, side: null }
  const side = position <= min && velocity < 0 ? 'min'
    : position >= max && velocity > 0 ? 'max' : null
  return { position: clamped, velocity: side ? -velocity : velocity, side }
}
