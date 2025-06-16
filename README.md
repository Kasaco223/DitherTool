# Dither Tool

A fully client-side web application for applying dithering effects to images, built with React and modern web technologies.

## 🛠 Tech Stack

- **React** (with Vite) - Modern React development
- **TailwindCSS** - Utility-first CSS framework
- **HTML5 Canvas** - Image rendering and pixel manipulation
- **Floyd-Steinberg Algorithm** - Core dithering implementation

## ✨ Features

### Current (Step 1)
- ✅ **Split Layout**: Canvas preview (left) + Control panel (right)
- ✅ **Image Import**: Drag & drop or file picker
- ✅ **Real-time Processing**: Live preview with Floyd-Steinberg dithering
- ✅ **Zoom Controls**: Zoom In/Out/Reset for detailed viewing
- ✅ **Interactive Settings**:
  - Scale adjustment (0.1x - 3x)
  - Smoothness control (0-10)  
  - Contrast adjustment (-100 to +100)
  - Midtones control (0-100)
  - Highlights control (0-100)
  - Luminance Threshold (0-100)
  - Blur effect (0-10)
  - Invert toggle
- ✅ **Export Functionality**: Save processed images as PNG

### Planned (Future Steps)
- 🔄 Additional dithering algorithms (Atkinson, Smooth Diffuse)
- 🔄 Video processing with ffmpeg.js
- 🔄 GPU acceleration with gpu.js
- 🔄 Preset save/load system
- 🔄 Advanced state management

## 🚀 Getting Started

### Installation
```bash
npm install
```

### Development
```bash
npm run dev
```

### Build for Production
```bash
npm run build
```

## 📁 Project Structure

```
src/
├── components/
│   ├── CanvasPreview.jsx    # Canvas rendering and zoom controls
│   └── ControlPanel.jsx     # Settings panel and file I/O
├── utils/
│   └── dithering.js         # Dithering algorithms
├── App.jsx                  # Main application layout
└── index.css               # TailwindCSS configuration
```

## 🎨 Usage

1. **Import Image**: Click "Import" button or drag & drop an image file
2. **Adjust Settings**: Use sliders to modify the dithering effect in real-time
3. **Zoom Controls**: Use zoom buttons to inspect details
4. **Export Result**: Click "Export" to save the processed image

## 🔧 Algorithm Details

### Floyd-Steinberg Dithering
The current implementation uses the Floyd-Steinberg error diffusion algorithm:
- Converts color images to grayscale
- Applies user-controlled adjustments (contrast, tones, etc.)
- Distributes quantization error to neighboring pixels
- Produces high-quality black & white dithered output

## 🏗 Architecture

The application follows a modular architecture:
- **Component-based**: Reusable React components
- **Utility separation**: Algorithms isolated in utility modules
- **Real-time processing**: Canvas-based image manipulation
- **Client-side only**: No server dependencies

## 📝 Development Notes

- All processing happens in the browser
- Canvas API used for pixel-level manipulation
- TailwindCSS for consistent, modern styling
- Vite for fast development and optimized builds
- Prepared for easy addition of new dithering algorithms
