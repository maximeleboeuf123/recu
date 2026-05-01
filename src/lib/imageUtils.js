// Resize + compress an image dataUrl to stay under Vercel's 4.5MB body limit.
// Max dimension 1920px, JPEG quality 0.82. PDFs pass through unchanged.
export function compressImage(dataUrl, mimeType, maxDim = 1920, quality = 0.82) {
  if (mimeType === 'application/pdf') return Promise.resolve({ dataUrl, base64: dataUrl.split(',')[1], mimeType })

  return new Promise((resolve) => {
    const img = new Image()
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
      canvas.toBlob(
        (blob) => {
          const reader = new FileReader()
          reader.onload = (e) =>
            resolve({
              dataUrl: e.target.result,
              base64: e.target.result.split(',')[1],
              mimeType: 'image/jpeg',
            })
          reader.readAsDataURL(blob)
        },
        'image/jpeg',
        quality,
      )
    }
    img.src = dataUrl
  })
}
