/** Downscale big gallery photos (phones produce 5-12 MB files) so the upload is small and reliable. */
export async function shrinkImage(file: File, maxSide = 1600, quality = 0.88): Promise<File> {
  try {
    if (file.size < 600 * 1024) return file
    const bmp = await createImageBitmap(file)
    const scale = Math.min(1, maxSide / Math.max(bmp.width, bmp.height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(bmp.width * scale)
    canvas.height = Math.round(bmp.height * scale)
    canvas.getContext('2d')?.drawImage(bmp, 0, 0, canvas.width, canvas.height)
    bmp.close?.()
    const blob: Blob | null = await new Promise(r => canvas.toBlob(r, 'image/jpeg', quality))
    if (!blob || blob.size >= file.size) return file
    return new File([blob], file.name.replace(/\.\w+$/, '') + '.jpg', { type: 'image/jpeg' })
  } catch {
    return file
  }
}
