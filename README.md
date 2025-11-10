# Interactive Shadower

An interactive silhouette experience using AI-powered person segmentation. This app uses your webcam to detect your body and creates a real-time dot-based visualization that responds to your movements.

## Features

- **AI-Powered Silhouette Detection**: Uses MediaPipe Selfie Segmentation for accurate, real-time person detection
- **Multiple Visual Modes**:
  - Green Dots: Classic silhouette with green dots
  - Image Reveal: Your silhouette reveals a background image
  - Video Reveal: Your silhouette reveals a playing video
- **Customizable Dot Patterns**: Three dot density modes (Dense Small, Standard, Bold Dense)
- **Ghostly Trail Effect**: Optional motion trail effect
- **Mirror/Unmirror View**: Toggle between mirrored and original camera view
- **Fullscreen Support**: Immersive fullscreen experience
- **Keyboard Shortcuts**: Quick access to all features

## Technology Stack

### Core Technologies
- **Next.js 15.5.4** - React framework with App Router
- **React 19** - UI library
- **TypeScript** - Type-safe development
- **Tailwind CSS 4** - Modern styling

### AI/ML
- **MediaPipe Selfie Segmentation** - State-of-the-art person segmentation model
  - Model Selection: Landscape mode (256x144) for optimal performance
  - Better accuracy and performance than older BodyPix models
  - Lower latency and memory footprint
  - Designed specifically for real-time segmentation

### Why MediaPipe?
MediaPipe Selfie Segmentation was chosen over TensorFlow BodyPix because:
1. **More Modern** (2021+ vs 2019)
2. **Better Accuracy** - Improved edge detection and person segmentation
3. **Faster** - Lower latency, 30-60 FPS on most devices
4. **Efficient** - Smaller model size and lower memory usage
5. **Purpose-Built** - Specifically designed for selfie/person segmentation

## Getting Started

### Prerequisites
- Node.js 20+ 
- npm, yarn, pnpm, or bun
- A webcam

### Installation

1. Clone the repository:
```bash
git clone https://github.com/fanxxai/interactive-shadower.git
cd interactive-shadower
```

2. Install dependencies:
```bash
npm install
```

3. Run the development server:
```bash
npm run dev
```

4. Open [http://localhost:3000](http://localhost:3000) in your browser

### Adding Media Files

To use Image Reveal or Video Reveal modes:

1. Add your images (`.jpg`, `.jpeg`, `.png`, `.gif`) or videos (`.mp4`, `.webm`, `.mov`) to the `public/media/` directory
2. Restart the app if already running
3. Press `Space` or click "Toggle Effect" (key `1`) to cycle through modes

## Usage

### Controls

**Keyboard Shortcuts:**
- `Space` - Cycle through visual modes (Green Dots → Media Files → back to Green Dots)
- `1` - Toggle Effect (same as Space)
- `2` - Toggle Dot Density (Dense Small → Standard → Bold Dense)
- `3` - Toggle Ghostly Trail Effect
- `4` - Toggle Mirror View
- `5` - Toggle Fullscreen

**On-Screen Controls:**
Available when the experience is active (bottom of screen)

## Development

### Build for Production

```bash
npm run build
```

### Start Production Server

```bash
npm run start
```

### Lint Code

```bash
npm run lint
```

## Project Structure

```
interactive-shadower/
├── public/
│   ├── media/          # Add your images and videos here
│   └── app-cover.jpg   # Landing page background
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   └── scan-media/  # API route to scan media files
│   │   ├── layout.tsx       # Root layout
│   │   ├── page.tsx         # Home page
│   │   └── globals.css      # Global styles
│   └── components/
│       └── FaceReactiveDots.tsx  # Main interactive component
├── package.json
└── README.md
```

## Performance Optimization

The app is optimized for performance:
- MediaPipe model runs at 30-60 FPS on most devices
- Segmentation runs every other frame (adjustable)
- Efficient canvas rendering
- Dynamic import for MediaPipe to reduce bundle size
- Minimal dependencies

## Browser Compatibility

- Chrome/Edge: ✅ Full support
- Firefox: ✅ Full support  
- Safari: ✅ Full support (may require camera permissions)
- Mobile browsers: ⚠️ Limited (camera access varies by browser/OS)

## Credits

**Creator**: Faizan Khan - Creative Consultant & Innovator
- Instagram: [@fanxology](https://instagram.com/fanxology)
- WhatsApp: +92 324 4036072

**Landing Page Photo**: Janmesh Shah on Unsplash

## License

This project is private and proprietary.

## Learn More

To learn more about the technologies used:
- [Next.js Documentation](https://nextjs.org/docs)
- [MediaPipe Selfie Segmentation](https://google.github.io/mediapipe/solutions/selfie_segmentation.html)
- [React Documentation](https://react.dev)
- [Tailwind CSS](https://tailwindcss.com)

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme).

Check out the [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
