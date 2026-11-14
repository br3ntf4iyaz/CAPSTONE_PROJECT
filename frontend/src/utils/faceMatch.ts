/**
 * Free, in-browser face comparison (no images leave the device for this step).
 * Uses @vladmandic/face-api with models served from /models.
 */
let loading: Promise<typeof import('@vladmandic/face-api')> | null = null

async function getApi() {
  if (!loading) {
    loading = (async () => {
      const faceapi = await import('@vladmandic/face-api')
      await Promise.all([
        faceapi.nets.ssdMobilenetv1.loadFromUri('/models'),
        faceapi.nets.faceLandmark68Net.loadFromUri('/models'),
        faceapi.nets.faceRecognitionNet.loadFromUri('/models'),
      ])
      return faceapi
    })()
    loading.catch(() => { loading = null })
  }
  return loading
}

function fileToImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => { URL.revokeObjectURL(url); resolve(img) }
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Could not read image')) }
    img.src = url
  })
}

async function descriptorFor(file: File) {
  const faceapi = await getApi()
  const img = await fileToImage(file)
  const det = await faceapi
    .detectSingleFace(img, new faceapi.SsdMobilenetv1Options({ minConfidence: 0.4 }))
    .withFaceLandmarks()
    .withFaceDescriptor()
  return det?.descriptor ?? null
}

export interface FaceMatchResult {
  ok: boolean
  /** 'no-id-face' | 'no-selfie-face' | 'error' when ok is false */
  reason?: 'no-id-face' | 'no-selfie-face' | 'error'
  distance?: number
  /** 0..1, higher = more similar */
  similarity?: number
  matched?: boolean
}

// 0.6 is the library's usual same-person limit; ID photos are low quality, so we stay at 0.6.
export const MATCH_THRESHOLD = 0.6

export async function compareFaces(idFront: File, selfie: File): Promise<FaceMatchResult> {
  try {
    const [a, b] = await Promise.all([descriptorFor(idFront), descriptorFor(selfie)])
    if (!a) return { ok: false, reason: 'no-id-face' }
    if (!b) return { ok: false, reason: 'no-selfie-face' }
    const faceapi = await getApi()
    const distance = faceapi.euclideanDistance(a, b)
    return {
      ok: true,
      distance,
      similarity: Math.max(0, Math.min(1, 1 - distance)),
      matched: distance <= MATCH_THRESHOLD,
    }
  } catch {
    return { ok: false, reason: 'error' }
  }
}
