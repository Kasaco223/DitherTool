import { useRef, useState, useEffect } from 'react'
import { hsvToRgb, rgbToHsv } from '../utils/dithering'
import { HsvaColorPicker } from 'react-colorful'

// Funciones auxiliares para conversión de color
function rgbToHex(r, g, b) {
  return (
    '#' +
    [r, g, b]
      .map((x) => {
        const hex = x.toString(16)
        return hex.length === 1 ? '0' + hex : hex
      })
      .join('')
  )
}
function hexToRgb(hex) {
  hex = hex.replace('#', '')
  if (hex.length === 3) {
    hex = hex.split('').map((x) => x + x).join('')
  }
  const num = parseInt(hex, 16)
  return [num >> 16, (num >> 8) & 255, num & 255]
}
function rgbToString(r, g, b) {
  return `rgb(${r}, ${g}, ${b})`
}
function stringToRgb(str) {
  const match = str.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/)
  if (!match) return null
  return [parseInt(match[1]), parseInt(match[2]), parseInt(match[3])]
}
function hsvToHsl(h, s, v) {
  s /= 100; v /= 100;
  let l = v * (1 - s / 2);
  let sl = l === 0 || l === 1 ? 0 : (v - l) / Math.min(l, 1 - l);
  return [h, sl * 100, l * 100]
}
function hslToHsv(h, s, l) {
  s /= 100; l /= 100;
  let v = l + s * Math.min(l, 1 - l);
  let sv = v === 0 ? 0 : 2 * (1 - l / v);
  return [h, sv * 100, v * 100]
}
function hslToString(h, s, l) {
  return `hsl(${Math.round(h)}, ${Math.round(s)}%, ${Math.round(l)}%)`
}
function stringToHsl(str) {
  const match = str.match(/hsl\((\d+),\s*(\d+)%?,\s*(\d+)%?\)/)
  if (!match) return null
  return [parseInt(match[1]), parseInt(match[2]), parseInt(match[3])]
}

const ControlPanel = ({
  settings,
  onSettingsChange,
  onImageLoad,
  onExport,
  hasImage,
  useCustomColors,
  onUseCustomColorsToggle,
  customNeonColors,
  setCustomNeonColor,
  setShowExportPopup
}) => {
  const fileInputRef = useRef(null)

  // Estado para formato y valor del input de color
  const [colorFormat, setColorFormat] = useState('HEX')
  const [colorInput, setColorInput] = useState('')
  const [pendingColor, setPendingColor] = useState('')

  // Sincroniza el input cuando cambia el color del picker o el formato
  useEffect(() => {
    const [r, g, b] = hsvToRgb(customNeonColors.h, customNeonColors.s, customNeonColors.v)
    if (colorFormat === 'HEX') {
      setColorInput(rgbToHex(r, g, b))
      setPendingColor(rgbToHex(r, g, b))
    } else if (colorFormat === 'RGB') {
      setColorInput(rgbToString(r, g, b))
      setPendingColor(rgbToString(r, g, b))
    } else if (colorFormat === 'HSL') {
      const [h, s, l] = hsvToHsl(customNeonColors.h, customNeonColors.s, customNeonColors.v)
      setColorInput(hslToString(h, s, l))
      setPendingColor(hslToString(h, s, l))
    }
    // eslint-disable-next-line
  }, [customNeonColors, colorFormat])

  // Cuando el usuario escribe en el input (solo actualiza el valor local)
  const handleColorInputChange = (e) => {
    setPendingColor(e.target.value)
  }

  // Aplica el color cuando se presiona Enter o el botón
  const applyPendingColor = () => {
    let rgb
    if (colorFormat === 'HEX') {
      try {
        rgb = hexToRgb(pendingColor)
      } catch { rgb = null }
    } else if (colorFormat === 'RGB') {
      rgb = stringToRgb(pendingColor)
    } else if (colorFormat === 'HSL') {
      const hsl = stringToHsl(pendingColor)
      if (hsl) {
        const [h, s, l] = hsl
        rgb = hsvToRgb(...hslToHsv(h, s, l))
      }
    }
    if (rgb && rgb.every((x) => !isNaN(x))) {
      const [h, s, v] = rgbToHsv(rgb[0], rgb[1], rgb[2])
      setCustomNeonColor({ h, s, v })
    }
  }

  // Permite aplicar con Enter
  const handleColorInputKeyDown = (e) => {
    if (e.key === 'Enter') {
      applyPendingColor()
    }
  }

  const handleFileSelect = (e) => {
    const file = e.target.files[0]
    if (file && file.type.startsWith('image/')) {
      onImageLoad(file)
    }
  }

  const handleImportClick = () => {
    fileInputRef.current?.click()
  }

  const handleSliderChange = (key, value) => {
    onSettingsChange({ [key]: parseFloat(value) })
  }

  const handleToggleChange = (key, checked) => {
    onSettingsChange({ [key]: checked })
  }

  const handleSelectChange = (key, value) => {
    onSettingsChange({ [key]: value })
  }

  return (
    <div className="flex flex-col h-full">
      {/* Import/Export Buttons */}
      <div className="mb-6 space-y-3 md:mb-8 md:space-y-4">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileSelect}
          className="hidden"
        />
        <button
          onClick={handleImportClick}
          className="w-full px-3 py-1.5 md:px-4 md:py-2 text-xs md:text-sm uppercase tracking-wider border border-black hover:bg-black hover:text-white transition-all duration-300"
        >
          Import Image
        </button>
        <button
          onClick={() => setShowExportPopup(true)}
          disabled={!hasImage}
          className={`w-full px-4 py-2 text-sm font-medium text-white rounded ${
            hasImage
              ? 'bg-black hover:bg-gray-800'
              : 'bg-gray-300 cursor-not-allowed'
          } transition-colors`}
        >
          Export
        </button>
      </div>

      {/* Settings Panel */}
      <div className="flex-1 overflow-y-auto control-panel">
        <div className="space-y-6 md:space-y-8">
          {/* Custom Colors Toggle */}
          <div className="flex items-center space-x-3">
            <input
              type="checkbox"
              id="useCustomColors"
              checked={useCustomColors}
              onChange={onUseCustomColorsToggle}
              className="w-4 h-4 border-gray-200 rounded-none focus:ring-black focus:ring-offset-0"
            />
            <label htmlFor="useCustomColors" className="text-xs font-medium tracking-wide uppercase md:text-sm">
              Use Custom Colors
            </label>
          </div>

          {/* Custom Color Selector (conditionally rendered) */}
          {useCustomColors && (
            <div className="pt-4">
              <HsvaColorPicker
                color={{ ...customNeonColors, a: 1 }} // Add alpha for the picker
                onChange={(newColor) => setCustomNeonColor({ h: newColor.h, s: newColor.s, v: newColor.v })}
              />
              <div className="mt-4 flex flex-col space-y-2">
                <select
                  value={colorFormat}
                  onChange={e => setColorFormat(e.target.value)}
                  className="border border-black px-2 py-1 text-xs w-24"
                >
                  <option value="HEX">HEX</option>
                  <option value="RGB">RGB</option>
                  <option value="HSL">HSL</option>
                </select>
                <div className="flex flex-row space-x-2">
                  <input
                    type="text"
                    value={pendingColor}
                    onChange={handleColorInputChange}
                    onKeyDown={handleColorInputKeyDown}
                    className="border border-black px-2 py-1 text-xs w-full"
                    spellCheck={false}
                  />
                  <button
                    onClick={applyPendingColor}
                    className="px-3 py-1 border border-black bg-white text-xs font-medium hover:bg-gray-100"
                  >
                    Apply
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Style Dropdown */}
          <div>
            <label className="block mb-2 text-xs font-medium tracking-wide uppercase md:mb-3 md:text-sm">Style</label>
            <select
              value={settings.style}
              onChange={(e) => handleSelectChange('style', e.target.value)}
              className="w-full px-3 py-1.5 md:py-2 text-xs md:text-sm bg-white border border-gray-200 focus:border-black focus:outline-none transition-all duration-300"
            >
              <option value="Floyd-Steinberg">Floyd-Steinberg</option>
              <option value="Atkinson">Atkinson</option>
              <option value="Smooth Diffuse">Smooth Diffuse</option>
            </select>
          </div>

          {/* Presets Dropdown */}
          <div>
            <label className="block mb-2 text-xs font-medium tracking-wide uppercase md:mb-3 md:text-sm">Presets</label>
            <select
              className="w-full px-3 py-1.5 md:py-2 text-xs md:text-sm bg-white border border-gray-200 focus:border-black focus:outline-none transition-all duration-300"
              disabled
            >
              <option>None</option>
            </select>
          </div>

          {/* Scale Slider */}
          <div className="slider-container">
            <label className="block mb-2 text-xs font-medium tracking-wide uppercase md:mb-3 md:text-sm">
              Scale: {settings.scale}
            </label>
            <input
              type="range"
              min="0.1"
              max="1"
              step="0.1"
              value={settings.scale}
              onChange={(e) => handleSliderChange('scale', e.target.value)}
              className="slider"
            />
          </div>

          {/* Smoothness Slider */}
          <div className="slider-container">
            <label className="block mb-2 text-xs font-medium tracking-wide uppercase md:mb-3 md:text-sm">
              Smoothness: {settings.smoothness}
            </label>
            <input
              type="range"
              min="0"
              max="10"
              step="1"
              value={settings.smoothness}
              onChange={(e) => handleSliderChange('smoothness', e.target.value)}
              className="slider"
            />
          </div>

          {/* Contrast Slider */}
          <div className="slider-container">
            <label className="block mb-2 text-xs font-medium tracking-wide uppercase md:mb-3 md:text-sm">
              Contrast: {settings.contrast}
            </label>
            <input
              type="range"
              min="-100"
              max="100"
              step="1"
              value={settings.contrast}
              onChange={(e) => handleSliderChange('contrast', e.target.value)}
              className="slider"
            />
          </div>

          {/* Midtones Slider */}
          <div className="slider-container">
            <label className="block mb-2 text-xs font-medium tracking-wide uppercase md:mb-3 md:text-sm">
              Midtones: {settings.midtones}
            </label>
            <input
              type="range"
              min="0"
              max="100"
              step="1"
              value={settings.midtones}
              onChange={(e) => handleSliderChange('midtones', e.target.value)}
              className="slider"
            />
          </div>

          {/* Highlights Slider */}
          <div className="slider-container">
            <label className="block mb-2 text-xs font-medium tracking-wide uppercase md:mb-3 md:text-sm">
              Highlights: {settings.highlights}
            </label>
            <input
              type="range"
              min="0"
              max="100"
              step="1"
              value={settings.highlights}
              onChange={(e) => handleSliderChange('highlights', e.target.value)}
              className="slider"
            />
          </div>

          {/* Luminance Threshold Slider */}
          <div className="slider-container">
            <label className="block mb-2 text-xs font-medium tracking-wide uppercase md:mb-3 md:text-sm">
              Luminance Threshold: {settings.luminanceThreshold}
            </label>
            <input
              type="range"
              min="0"
              max="100"
              step="1"
              value={settings.luminanceThreshold}
              onChange={(e) => handleSliderChange('luminanceThreshold', e.target.value)}
              className="slider"
            />
          </div>

          {/* Blur Slider */}
          <div className="slider-container">
            <label className="block mb-2 text-xs font-medium tracking-wide uppercase md:mb-3 md:text-sm">
              Blur: {settings.blur}
            </label>
            <input
              type="range"
              min="0"
              max="10"
              step="0.1"
              value={settings.blur}
              onChange={(e) => handleSliderChange('blur', e.target.value)}
              className="slider"
            />
          </div>

          {/* Invert Toggle */}
          <div className="flex items-center space-x-3">
            <input
              type="checkbox"
              id="invert"
              checked={settings.invert}
              onChange={(e) => handleToggleChange('invert', e.target.checked)}
              className="w-4 h-4 border-gray-200 rounded-none focus:ring-black focus:ring-offset-0"
            />
            <label htmlFor="invert" className="text-xs font-medium tracking-wide uppercase md:text-sm">
              Invert
            </label>
          </div>
        </div>

        {/* Save Preset Button */}
        <div className="pt-6 mt-6 border-t border-gray-200 md:pt-8 md:mt-8">
          <button
            disabled
            className="w-full px-3 py-1.5 md:px-4 md:py-2 text-xs md:text-sm uppercase tracking-wider border border-gray-200 text-gray-400 cursor-not-allowed"
          >
            Save Preset (Coming Soon)
          </button>
        </div>
      </div>
    </div>
  )
}

export default ControlPanel