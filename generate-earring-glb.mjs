#!/usr/bin/env node
/**
 * generate-earring-glb.mjs
 *
 * Writes a minimal valid GLB (GL Transmission Format Binary) file
 * directly — no GLTFExporter, no browser API polyfills, no async issues.
 *
 * The GLB contains a dangling earring described as a glTF scene:
 *   - Hook torus (top)
 *   - Connecting rod
 *   - Bead connector
 *   - Teardrop pendant
 *
 * All geometry is pre-computed as Float32 vertex data and
 * written into the binary chunk manually.
 */

import { writeFileSync, mkdirSync } from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const OUT_DIR   = path.resolve(__dirname, 'packages/web/public/models')
const OUT_FILE  = path.join(OUT_DIR, 'earring-dangling.glb')

mkdirSync(OUT_DIR, { recursive: true })

// ── Geometry helpers ──────────────────────────────────────────

function makeCylinder(radiusTop, radiusBottom, height, segments) {
  const positions = []
  const indices   = []
  const halfH = height / 2

  for (let i = 0; i <= segments; i++) {
    const angle = (i / segments) * Math.PI * 2
    const cos = Math.cos(angle)
    const sin = Math.sin(angle)
    positions.push(cos * radiusTop, halfH, sin * radiusTop)
    positions.push(cos * radiusBottom, -halfH, sin * radiusBottom)
  }

  for (let i = 0; i < segments; i++) {
    const a = i * 2
    const b = a + 1
    const c = a + 2
    const d = a + 3
    indices.push(a, b, c, b, d, c)
  }

  return { positions, indices }
}

function makeSphere(radius, widthSegs, heightSegs, scaleX = 1, scaleY = 1, scaleZ = 1, offsetY = 0) {
  const positions = []
  const indices   = []

  for (let y = 0; y <= heightSegs; y++) {
    const v     = y / heightSegs
    const phi   = v * Math.PI
    for (let x = 0; x <= widthSegs; x++) {
      const u     = x / widthSegs
      const theta = u * Math.PI * 2
      positions.push(
        radius * Math.sin(phi) * Math.cos(theta) * scaleX,
        radius * Math.cos(phi) * scaleY + offsetY,
        radius * Math.sin(phi) * Math.sin(theta) * scaleZ
      )
    }
  }

  for (let y = 0; y < heightSegs; y++) {
    for (let x = 0; x < widthSegs; x++) {
      const a = y * (widthSegs + 1) + x
      const b = a + widthSegs + 1
      indices.push(a, b, a + 1, b, b + 1, a + 1)
    }
  }

  return { positions, indices }
}

function makeTorus(radius, tube, radialSegs, tubularSegs, arcFraction = 1) {
  const positions = []
  const indices   = []

  for (let j = 0; j <= radialSegs; j++) {
    for (let i = 0; i <= tubularSegs; i++) {
      const u = (i / tubularSegs) * Math.PI * 2 * arcFraction
      const v = (j / radialSegs) * Math.PI * 2
      positions.push(
        (radius + tube * Math.cos(v)) * Math.cos(u),
        (radius + tube * Math.cos(v)) * Math.sin(u),
        tube * Math.sin(v)
      )
    }
  }

  for (let j = 0; j < radialSegs; j++) {
    for (let i = 0; i < tubularSegs; i++) {
      const a = (tubularSegs + 1) * j + i
      const b = (tubularSegs + 1) * (j + 1) + i
      indices.push(a, b, a + 1, b, b + 1, a + 1)
    }
  }

  return { positions, indices }
}

// ── Build earring parts ───────────────────────────────────────
const parts = [
  // Hook torus at top (offset upward)
  (() => {
    const g = makeTorus(0.06, 0.012, 8, 16, 0.75)
    // offset Y
    for (let i = 1; i < g.positions.length; i += 3) g.positions[i] += 0.02
    return g
  })(),
  // Rod
  makeCylinder(0.008, 0.008, 0.12, 8),
  // Bead at -0.18
  makeSphere(0.022, 8, 8, 1, 1, 1, -0.18),
  // Teardrop pendant at -0.32
  makeSphere(0.075, 12, 12, 0.7, 1.2, 0.5, -0.32),
]

// ── Merge all geometry into one flat buffer ───────────────────
let allPositions = []
let allIndices   = []
let vertexOffset = 0

for (const part of parts) {
  // Offset rod so it sits between hook and bead
  if (part === parts[1]) {
    for (let i = 1; i < part.positions.length; i += 3) {
      part.positions[i] -= 0.11
    }
  }
  allPositions = allPositions.concat(part.positions)
  allIndices   = allIndices.concat(part.indices.map(i => i + vertexOffset))
  vertexOffset += part.positions.length / 3
}

// ── Compute bounding box for accessor ────────────────────────
let minX = Infinity, minY = Infinity, minZ = Infinity
let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity
for (let i = 0; i < allPositions.length; i += 3) {
  minX = Math.min(minX, allPositions[i])
  minY = Math.min(minY, allPositions[i+1])
  minZ = Math.min(minZ, allPositions[i+2])
  maxX = Math.max(maxX, allPositions[i])
  maxY = Math.max(maxY, allPositions[i+1])
  maxZ = Math.max(maxZ, allPositions[i+2])
}

// ── Encode binary buffers ─────────────────────────────────────
const posF32 = new Float32Array(allPositions)
const idxU16 = new Uint16Array(allIndices)

// Align to 4 bytes
const posBytes = posF32.buffer
const idxBytes = idxU16.buffer
const pad = (n) => Math.ceil(n / 4) * 4
const posByteLen = pad(posBytes.byteLength)
const idxByteLen = pad(idxBytes.byteLength)

const binBuffer = Buffer.alloc(posByteLen + idxByteLen, 0)
Buffer.from(posBytes).copy(binBuffer, 0)
Buffer.from(idxBytes).copy(binBuffer, posByteLen)

const totalBinLen = binBuffer.byteLength

// ── Build glTF JSON ───────────────────────────────────────────
const gltf = {
  asset: { version: '2.0', generator: 'TryonKit generate-earring-glb' },
  scene: 0,
  scenes: [{ nodes: [0] }],
  nodes: [{ mesh: 0, name: 'earring' }],
  meshes: [{
    name: 'earring-mesh',
    primitives: [{
      attributes: { POSITION: 0 },
      indices: 1,
      material: 0,
    }]
  }],
  materials: [{
    name: 'gold',
    pbrMetallicRoughness: {
      baseColorFactor: [0.788, 0.659, 0.298, 1.0],
      metallicFactor:  0.95,
      roughnessFactor: 0.15,
    }
  }],
  accessors: [
    {
      bufferView: 0,
      componentType: 5126,   // FLOAT
      count: allPositions.length / 3,
      type: 'VEC3',
      min: [minX, minY, minZ],
      max: [maxX, maxY, maxZ],
    },
    {
      bufferView: 1,
      componentType: 5123,   // UNSIGNED_SHORT
      count: allIndices.length,
      type: 'SCALAR',
    }
  ],
  bufferViews: [
    { buffer: 0, byteOffset: 0,          byteLength: posBytes.byteLength, target: 34962 },
    { buffer: 0, byteOffset: posByteLen, byteLength: idxBytes.byteLength, target: 34963 },
  ],
  buffers: [{ byteLength: totalBinLen }],
}

// ── Encode GLB ────────────────────────────────────────────────
const jsonStr     = JSON.stringify(gltf)
const jsonBytes   = Buffer.from(jsonStr, 'utf8')
const jsonPadLen  = pad(jsonBytes.length)
const jsonPadded  = Buffer.alloc(jsonPadLen, 0x20)  // pad with spaces
jsonBytes.copy(jsonPadded)

const totalLen = 12 + 8 + jsonPadLen + 8 + totalBinLen
const out      = Buffer.alloc(totalLen)
let off        = 0

// GLB header
out.writeUInt32LE(0x46546C67, off); off += 4   // magic: 'glTF'
out.writeUInt32LE(2,           off); off += 4   // version: 2
out.writeUInt32LE(totalLen,    off); off += 4   // total length

// JSON chunk
out.writeUInt32LE(jsonPadLen,  off); off += 4
out.writeUInt32LE(0x4E4F534A, off); off += 4   // 'JSON'
jsonPadded.copy(out, off); off += jsonPadLen

// BIN chunk
out.writeUInt32LE(totalBinLen, off); off += 4
out.writeUInt32LE(0x004E4942,  off); off += 4   // 'BIN\0'
binBuffer.copy(out, off)

writeFileSync(OUT_FILE, out)
console.log(`✅ GLB written → ${OUT_FILE}`)
console.log(`   Vertices : ${allPositions.length / 3}`)
console.log(`   Triangles: ${allIndices.length / 3}`)
console.log(`   Size     : ${(out.byteLength / 1024).toFixed(1)} KB`)
