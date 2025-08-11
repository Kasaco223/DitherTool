import React, { useRef, useEffect, useState, Suspense } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { useGLTF, OrbitControls, Environment } from '@react-three/drei'
import * as THREE from 'three'

// Habilitar soporte DRACO (requiere servir decoders en /public/draco/ si se usan modelos comprimidos)
try {
  if (typeof useGLTF?.setDecoderPath === 'function') {
    useGLTF.setDecoderPath('/draco/')
  }
} catch (_) {
  // noop si no está disponible
}

// Componente para el modelo GLB
function Model({ url, rotation, positionOffset, onRender, isRotating, onModelLoaded }) {
  const { scene } = useGLTF(url)
  const modelRef = useRef()
  const { gl, camera, scene: threeScene, size } = useThree()
  const frameCountRef = useRef(0)
  const isSetupRef = useRef(false)
  const basePositionRef = useRef(new THREE.Vector3(0, 0, 0))

  useFrame(() => {
    if (modelRef.current) {
      modelRef.current.rotation.x = rotation.x
      modelRef.current.rotation.y = rotation.y
      modelRef.current.rotation.z = rotation.z
      // Aplicar pan/traslación
      if (positionOffset) {
        modelRef.current.position.set(
          basePositionRef.current.x + (positionOffset.x || 0),
          basePositionRef.current.y + (positionOffset.y || 0),
          basePositionRef.current.z + (positionOffset.z || 0)
        )
      }
      
      frameCountRef.current++
      
      // Capturar ImageData para dithering
      if (onRender) {
        // Durante rotación, capturar cada 5 frames para optimizar
        // Cuando no está rotando, capturar cada frame
        const shouldCapture = isRotating ? frameCountRef.current % 5 === 0 : true
        
        if (shouldCapture) {
          try {
            // Obtener el canvas del renderer de Three.js
            const canvas = gl.domElement
            
            if (canvas && canvas.width > 0 && canvas.height > 0) {
              // Crear un canvas temporal para capturar la imagen
              const tempCanvas = document.createElement('canvas')
              const tempCtx = tempCanvas.getContext('2d')
              tempCanvas.width = canvas.width
              tempCanvas.height = canvas.height
              tempCtx.drawImage(canvas, 0, 0)

              // Obtener ImageData del canvas 2D
              const fullImageData = tempCtx.getImageData(0, 0, tempCanvas.width, tempCanvas.height)

              onRender(fullImageData, isRotating)
            }
          } catch (error) {
            console.error('Error capturing ImageData:', error)
          }
        }
      }
    }
  })

  // Configurar el modelo
  useEffect(() => {
    if (scene && !isSetupRef.current) {
      isSetupRef.current = true
      
      // Notificar que el modelo se cargó
      if (onModelLoaded) {
        onModelLoaded()
      }
      
      // Configurar el modelo en el siguiente frame
      setTimeout(() => {
        if (modelRef.current) {
          // Centrar el modelo
          const box = new THREE.Box3().setFromObject(modelRef.current)
          const center = box.getCenter(new THREE.Vector3())
          modelRef.current.position.sub(center)
          basePositionRef.current.copy(modelRef.current.position)
          
          // Escalar el modelo para que quepa en la vista
          const size = box.getSize(new THREE.Vector3())
          const maxDim = Math.max(size.x, size.y, size.z)
          const scale = 2 / maxDim
          modelRef.current.scale.setScalar(scale)
          
          // Forzar una captura inicial
          if (onRender) {
            setTimeout(() => {
              try {
                const canvas = gl.domElement
                
                if (canvas && canvas.width > 0 && canvas.height > 0) {
                  // Crear un canvas temporal para capturar la imagen
                  const tempCanvas = document.createElement('canvas')
                  const tempCtx = tempCanvas.getContext('2d')
                  
                  tempCanvas.width = canvas.width
                  tempCanvas.height = canvas.height
                  
                  // Copiar el contenido del canvas WebGL al canvas 2D
                  tempCtx.drawImage(canvas, 0, 0)
                  
                  // Obtener ImageData del canvas 2D
                  const imageData = tempCtx.getImageData(0, 0, tempCanvas.width, tempCanvas.height)
                  
                  onRender(imageData, false)
                }
              } catch (error) {
                console.error('Error in initial capture:', error)
              }
            }, 100)
          }
        }
      }, 50)
    }
  }, [scene, onModelLoaded, onRender, gl])

  return <primitive ref={modelRef} object={scene.clone()} />
}

// Componente principal del visor 3D
function Model3DViewer({ 
  modelUrl, 
  rotation, 
  onRotationChange, 
  onImageDataUpdate, 
  isRotating,
  size = { width: 400, height: 400 },
  registerControlsApi
}) {
  const [isLoading, setIsLoading] = useState(true)
  const canvasRef = useRef()
  const lastImageDataRef = useRef(null)
  const controlsRef = useRef()

  // Exponer API para rotar/panear la cámara desde fuera (CanvasPreview)
  useEffect(() => {
    if (!registerControlsApi) return
    const api = {
      orbitRotate: (dx, dy) => {
        const controls = controlsRef.current
        if (!controls) return
        const angleSpeed = 0.02
        try {
          // Invertimos signos para que siga intuitivamente el arrastre:
          // arrastrar a la derecha => objeto gira a la derecha
          controls.rotateLeft(-dx * angleSpeed)
          controls.rotateUp(-dy * angleSpeed)
          controls.update()
        } catch (_) {
          // Algunos métodos pueden cambiar entre versiones; fallback: ajustar target/camera manualmente si falla
        }
      },
      orbitPan: (dx, dy) => {
        const controls = controlsRef.current
        if (!controls) return
        try {
          if (typeof controls.pan === 'function') {
            controls.pan(-dx, dy)
            controls.update()
            return
          }
          // Fallback: pan manual usando la base de la cámara
          const camera = controls.object
          const element = controls.domElement
          const clientH = element?.clientHeight || 600
          const target = controls.target
          const panSpeed = (controls.panSpeed || 1.0)
          // Distancia al target (perspectiva)
          let targetDistance = 1
          if (camera.isPerspectiveCamera) {
            targetDistance = camera.position.distanceTo(target)
            targetDistance *= Math.tan((camera.fov / 2) * Math.PI / 180)
          }
          const moveLeft = (2 * dx * panSpeed * targetDistance) / clientH
          const moveUp = (2 * dy * panSpeed * targetDistance) / clientH

          const pan = new THREE.Vector3()
          const te = camera.matrix.elements
          // Column-major: xBasis = (te[0], te[1], te[2]), yBasis = (te[4], te[5], te[6])
          const xBasis = new THREE.Vector3(te[0], te[1], te[2])
          const yBasis = new THREE.Vector3(te[4], te[5], te[6])
          pan.copy(xBasis).multiplyScalar(-moveLeft)
          pan.add(yBasis.multiplyScalar(moveUp))
          camera.position.add(pan)
          target.add(pan)
          controls.update()
        } catch (_) {
          // noop si pan no está disponible
        }
      }
    }
    registerControlsApi(api)
  }, [registerControlsApi])

  const handleModelLoaded = () => {
    setIsLoading(false)
  }

  const handleRender = (imageData, isCurrentlyRotating) => {
    if (onImageDataUpdate) {
      // Durante la rotación, usar menor calidad/frecuencia
      if (isCurrentlyRotating) {
        // Reducir resolución durante rotación para optimizar usando drawImage
        const srcCanvas = document.createElement('canvas')
        const srcCtx = srcCanvas.getContext('2d')
        srcCanvas.width = imageData.width
        srcCanvas.height = imageData.height
        srcCtx.putImageData(imageData, 0, 0)

        const scale = 0.5
        const dstCanvas = document.createElement('canvas')
        const dstCtx = dstCanvas.getContext('2d')
        dstCanvas.width = Math.max(1, Math.floor(imageData.width * scale))
        dstCanvas.height = Math.max(1, Math.floor(imageData.height * scale))
        dstCtx.imageSmoothingEnabled = true
        dstCtx.imageSmoothingQuality = 'medium'
        dstCtx.drawImage(srcCanvas, 0, 0, srcCanvas.width, srcCanvas.height, 0, 0, dstCanvas.width, dstCanvas.height)

        const scaledImageData = dstCtx.getImageData(0, 0, dstCanvas.width, dstCanvas.height)
        onImageDataUpdate(scaledImageData)
      } else {
        // Calidad completa cuando no está rotando
        onImageDataUpdate(imageData)
        lastImageDataRef.current = imageData
      }
    }
  }

  const handleRotationStart = () => {
    if (onRotationChange) {
      onRotationChange(true) // Indicar que empezó la rotación
    }
  }

  const handleRotationEnd = () => {
    if (onRotationChange) {
      onRotationChange(false) // Indicar que terminó la rotación
    }
    // Forzar actualización con calidad completa al terminar rotación
    if (lastImageDataRef.current && onImageDataUpdate) {
      setTimeout(() => {
        onImageDataUpdate(lastImageDataRef.current)
      }, 100)
    }
  }

  if (!modelUrl) {
    return (
      <div 
        className="flex items-center justify-center bg-gray-100 border-2 border-dashed border-gray-300"
        style={{ width: size.width, height: size.height }}
      >
        <p className="text-gray-500">No 3D model loaded</p>
      </div>
    )
  }

  return (
    <div style={{ width: size.width, height: size.height }}>
      <Canvas
        ref={canvasRef}
        camera={{ position: [0, 0, 5], fov: 50 }}
        style={{ width: '100%', height: '100%', backgroundColor: '#000000' }}
        gl={{ 
          preserveDrawingBuffer: true, 
          antialias: true,
          alpha: false,
          premultipliedAlpha: false
        }}
        onCreated={({ gl, scene }) => {
          gl.setClearColor('#000000', 1.0)
          scene.background = new THREE.Color('#000000')
        }}
        frameloop="always"
      >
        <Suspense fallback={null}>
          <ambientLight intensity={0.4} />
          <directionalLight position={[10, 10, 5]} intensity={0.8} />
          <directionalLight position={[-10, -10, -5]} intensity={0.3} />
          <Environment preset="studio" />
          
          <Model 
            url={modelUrl} 
            rotation={rotation}
            onRender={handleRender}
            isRotating={isRotating}
            onModelLoaded={handleModelLoaded}
          />
          
          <OrbitControls
            ref={controlsRef}
            enablePan={true}
            enableZoom={true}
            enableRotate={false}
            // Mejora de sensibilidad y límites
            enableDamping={true}
            dampingFactor={0.05}
            rotateSpeed={1.2}
            panSpeed={1.2}
            makeDefault={false}
            onStart={handleRotationStart}
            onEnd={handleRotationEnd}
            minDistance={1}
            maxDistance={10}
          />
        </Suspense>
      </Canvas>
      
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50">
          <p className="text-white">Loading 3D model...</p>
        </div>
      )}
    </div>
  )
}

export default Model3DViewer
