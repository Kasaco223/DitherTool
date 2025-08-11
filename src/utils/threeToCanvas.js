/**
 * Utilidad para capturar el renderizado de Three.js y convertirlo a ImageData
 * para aplicar efectos de dithering
 */

export function captureThreeJSCanvas(renderer, scene, camera, width = 512, height = 512) {
  // Crear un canvas temporal para capturar el renderizado
  const tempCanvas = document.createElement('canvas')
  tempCanvas.width = width
  tempCanvas.height = height
  
  const tempRenderer = renderer.clone ? renderer.clone() : renderer
  tempRenderer.setSize(width, height)
  
  // Renderizar la escena
  tempRenderer.render(scene, camera)
  
  // Obtener el canvas del renderer
  const canvas = tempRenderer.domElement
  const ctx = canvas.getContext('2d')
  
  // Obtener ImageData
  const imageData = ctx.getImageData(0, 0, width, height)
  
  return imageData
}

export function createImageDataFromCanvas(canvas) {
  const ctx = canvas.getContext('2d')
  return ctx.getImageData(0, 0, canvas.width, canvas.height)
}

export function canvasToImage(canvas) {
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.src = canvas.toDataURL()
  })
}

/**
 * Optimización: reducir la calidad durante la rotación
 */
export function getOptimizedSize(originalWidth, originalHeight, isRotating) {
  if (!isRotating) {
    return { width: originalWidth, height: originalHeight }
  }
  
  // Durante la rotación, usar una resolución más baja para optimizar
  const scale = 0.5 // 50% de la resolución original
  return {
    width: Math.max(128, Math.floor(originalWidth * scale)),
    height: Math.max(128, Math.floor(originalHeight * scale))
  }
}

/**
 * Debounce para optimizar las actualizaciones durante la rotación
 */
export function createRotationDebounce(callback, delay = 100) {
  let timeoutId
  let isRotating = false
  
  return {
    start: () => {
      isRotating = true
      if (timeoutId) {
        clearTimeout(timeoutId)
      }
    },
    
    update: (data) => {
      if (timeoutId) {
        clearTimeout(timeoutId)
      }
      
      // Durante la rotación, usar menor calidad
      if (isRotating) {
        callback(data, true) // true = isRotating
      }
      
      // Programar actualización de alta calidad
      timeoutId = setTimeout(() => {
        isRotating = false
        callback(data, false) // false = not rotating
      }, delay)
    },
    
    stop: () => {
      isRotating = false
      if (timeoutId) {
        clearTimeout(timeoutId)
      }
    }
  }
}
