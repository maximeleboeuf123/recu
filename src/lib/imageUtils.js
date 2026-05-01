// Resize + compress an image dataUrl to stay under Vercel's 4.5MB body limit.
// Max dimension 1920px, JPEG quality 0.82. PDFs pass through unchanged.
// Uses toDataURL (synchronous) instead of toBlob — more reliable on iOS Safari.
export function compressImage(dataUrl, mimeType, maxDim = 1920, quality = 0.82) {
  if (mimeType === 'application/pdf') return Promise.resolve({ dataUrl, base64: dataUrl.split(',')[1], mimeType })

  return new Promise((resolve) => {
    const img = new Image()
    img.onerror = () => {
      // Image couldn't be decoded — pass original through unchanged
      const base64 = dataUrl.split(',')[1] ?? ''
      resolve({ dataUrl, base64, mimeType: mimeType || 'image/jpeg' })
    }
    img.onload = () => {
      let { width, height } = img
      if (width > maxDim || height > maxDim) {
        if (width >= height) {
          height = Math.round((height * maxDim) / width)
          width = maxDim
        } else {
          width = Math.round((width * maxDim) / height)
          height = maxDim
        }
      }
      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      canvas.getContext('2d').drawImage(img, 0, 0, width, height)
      const result = canvas.toDataURL('image/jpeg', quality)
      const base64 = result.split(',')[1] ?? ''
      resolve({ dataUrl: result, base64, mimeType: 'image/jpeg' })
    }
    img.src = dataUrl
  })
}
