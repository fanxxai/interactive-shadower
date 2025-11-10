"use client";

import { useCallback, useEffect, useRef, useState, useMemo } from "react";
import { CameraOff, Play, RefreshCw, Grid3X3, Ghost, Maximize2, Minimize2, Instagram, MessageCircle, FlipHorizontal2 } from "lucide-react";

// Type definitions for MediaPipe
interface SelfieSegmentationResults {
  image: HTMLCanvasElement | HTMLImageElement | ImageBitmap;
  segmentationMask: HTMLCanvasElement | HTMLImageElement | ImageBitmap;
}

interface SelfieSegmentationInstance {
  close(): Promise<void>;
  onResults(listener: (results: SelfieSegmentationResults) => void): void;
  initialize(): Promise<void>;
  reset(): void;
  send(inputs: { image: HTMLVideoElement | HTMLImageElement | HTMLCanvasElement }): Promise<void>;
  setOptions(options: { selfieMode?: boolean; modelSelection?: number }): void;
}

type SelfieSegmentationConstructor = new (config?: {
  locateFile?: (path: string, prefix?: string) => string;
}) => SelfieSegmentationInstance;

// Define the available modes
const MODES = {
  GREEN_DOTS: "GREEN_DOTS",
  IMAGE_REVEAL: "IMAGE_REVEAL",
  VIDEO_REVEAL: "VIDEO_REVEAL",
} as const;

type Mode = typeof MODES[keyof typeof MODES];

const DOT_MODES = [
  { id: "SMALL", label: "Dense Small Dots", spacing: 8, baseSize: 1 },
  { id: "MEDIUM", label: "Standard Dots", spacing: 12, baseSize: 2 },
  { id: "LARGE", label: "Bold Dense Dots", spacing: 16, baseSize: 2.7 },
] as const;

interface Dot {
  x: number;
  y: number;
  baseX: number;
  baseY: number;
  size: number;
  baseSize: number;
  active: number;
}

interface MediaFile {
  url: string;
  name: string;
  type: "image" | "video";
}

export default function FaceReactiveDots() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const bgVideoRef = useRef<HTMLVideoElement | null>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const imageCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const segmentationCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const animationRef = useRef<number | null>(null);
  const dotsRef = useRef<Dot[]>([]);
  const lastSegmentationRef = useRef<ImageData | null>(null);
  const frameCountRef = useRef(0);
  const lastFrameTimeRef = useRef<number>(performance.now());
  const selfieSegmentationRef = useRef<SelfieSegmentationInstance | null>(null);

  const [isActive, setIsActive] = useState(false);
  const [error, setError] = useState("");
  const [modelLoaded, setModelLoaded] = useState(false);
  const [bgVideoReady, setBgVideoReady] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);

  // Media state
  const [mode, setMode] = useState<Mode>(MODES.GREEN_DOTS);
  const currentMediaIndexRef = useRef<number>(-1);
  const [dotModeIndex, setDotModeIndex] = useState(1);
  const [ghostlyEnabled, setGhostlyEnabled] = useState(true);
  const [isMirrored, setIsMirrored] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const currentDotMode = useMemo(() => DOT_MODES[dotModeIndex], [dotModeIndex]);

  // Scan media directory for files
  const scanMediaDirectory = async (): Promise<MediaFile[]> => {
    try {
      const response = await fetch('/api/scan-media');
      if (!response.ok) throw new Error('Failed to scan media directory');
      
      const files: string[] = await response.json();
      return files.map((file: string) => ({
        url: `/media/${file}`,
        name: file,
        type: file.toLowerCase().match(/\.(mp4|webm|mov)$/i) ? "video" as const : "image" as const
      }));
    } catch (error) {
      console.error('Error scanning media directory:', error);
      return [];
    }
  };

  // Initialize dot grid
  const initializeDots = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    dotsRef.current = [];
    const spacing = currentDotMode.spacing;
    const cols = Math.ceil(canvas.width / spacing);
    const rows = Math.ceil(canvas.height / spacing);
    for (let i = 0; i < cols; i++) {
      for (let j = 0; j < rows; j++) {
        const x = i * spacing;
        const y = j * spacing;
        dotsRef.current.push({
          x,
          y,
          baseX: x,
          baseY: y,
          size: currentDotMode.baseSize,
          baseSize: currentDotMode.baseSize,
          active: 0,
        });
      }
    }
  }, [currentDotMode]);

  const resizeCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    initializeDots();
  }, [initializeDots]);

  const cycleDotMode = useCallback(() => {
    setDotModeIndex((prev) => (prev + 1) % DOT_MODES.length);
  }, []);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480, facingMode: "user" },
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
        setIsActive(true);
        setError("");
      }
    } catch (err) {
      const error = err as Error;
      if (error.name === "NotAllowedError" || error.name === "NotReadableError") {
        setError("Camera access denied or device busy. Check permissions.");
      } else {
        setError("Error starting camera.");
        console.error(err);
      }
      stopCamera();
    }
  };

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const tracks = (videoRef.current.srcObject as MediaStream).getTracks();
      tracks.forEach((t: MediaStreamTrack) => t.stop());
      videoRef.current.srcObject = null;
    }
    setIsActive(false);
  };

  // Toggle between different media files
  const cycleMode = useCallback(async () => {
    // Scan for media files
    const files = await scanMediaDirectory();

    if (files.length === 0) {
      console.log('No media files found, switching to: Green Dots');
      setMode(MODES.GREEN_DOTS);
      currentMediaIndexRef.current = -1;
      return;
    }

    // Move to next media file or back to green dots
    const totalOptions = files.length + 1;
    const nextIndex = (currentMediaIndexRef.current + 1 + totalOptions) % totalOptions;

    // If we've cycled through all media, go back to green dots
    if (nextIndex === files.length) {
      console.log('Switching to: Green Dots');
      currentMediaIndexRef.current = -1;
      setMode(MODES.GREEN_DOTS);
      return;
    }

    // Switch to the next media
    const currentMedia = files[nextIndex];
    currentMediaIndexRef.current = nextIndex;
    console.log(`Switching to: ${currentMedia.name}`);
    
    if (currentMedia.type === "image") {
      setMode(MODES.IMAGE_REVEAL);
      setImageLoaded(false);
      const img = new Image();
      img.crossOrigin = "Anonymous";
      img.src = currentMedia.url;
      img.onload = () => {
        imageRef.current = img;
        setImageLoaded(true);
      };
      // stop bg video if playing
      if (bgVideoRef.current) {
        try {
          bgVideoRef.current.pause();
          bgVideoRef.current.src = "";
        } catch (e) {
          console.error("Error stopping video:", e);
        }
        setBgVideoReady(false);
      }
    } else {
      setMode(MODES.VIDEO_REVEAL);
      imageRef.current = null;
      setImageLoaded(false);
      if (bgVideoRef.current) {
        setBgVideoReady(false);
        bgVideoRef.current.src = currentMedia.url;
        bgVideoRef.current.load();
        const onCan = () => {
          setBgVideoReady(true);
          bgVideoRef.current?.play().catch(() => {});
        };
        bgVideoRef.current.addEventListener("canplaythrough", onCan, { once: true });
        if (bgVideoRef.current.readyState >= 3) onCan();
      }
    }
  }, []);

  // Initialize MediaPipe Selfie Segmentation
  useEffect(() => {
    let mounted = true;

    const loadMediaPipe = async () => {
      try {
        // Dynamically import MediaPipe to avoid SSR issues
        const { SelfieSegmentation } = await import('@mediapipe/selfie_segmentation');
        
        if (!mounted) return;

        const selfieSegmentation = new (SelfieSegmentation as unknown as SelfieSegmentationConstructor)({
          locateFile: (file) => {
            return `https://cdn.jsdelivr.net/npm/@mediapipe/selfie_segmentation/${file}`;
          }
        });

        selfieSegmentation.setOptions({
          modelSelection: 1, // 0 for general (256x256), 1 for landscape (256x144) - faster and better for body
          selfieMode: true,
        });

        selfieSegmentation.onResults((results) => {
          if (!mounted) return;
          const segCanvas = segmentationCanvasRef.current;
          if (!segCanvas || !results.segmentationMask) return;

          const ctx = segCanvas.getContext('2d');
          if (!ctx) return;

          // Set canvas size to match video
          segCanvas.width = results.segmentationMask.width;
          segCanvas.height = results.segmentationMask.height;

          // Draw the segmentation mask
          ctx.drawImage(results.segmentationMask, 0, 0);
          
          // Get the image data for dot rendering
          const imageData = ctx.getImageData(0, 0, segCanvas.width, segCanvas.height);
          lastSegmentationRef.current = imageData;
        });

        selfieSegmentationRef.current = selfieSegmentation;
        setModelLoaded(true);
      } catch (err) {
        console.error("Failed to load MediaPipe:", err);
        setError("Failed to load AI model. Please refresh the page.");
      }
    };

    loadMediaPipe();

    return () => {
      mounted = false;
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
      if (selfieSegmentationRef.current) {
        selfieSegmentationRef.current.close().catch(console.error);
      }
    };
  }, []);

  // Background video setup
  useEffect(() => {
    const videoEl = bgVideoRef.current;
    if (videoEl) {
      videoEl.loop = true;
      videoEl.muted = true;
      videoEl.playsInline = true;
      const handlePlaying = () => setBgVideoReady(true);
      const handlePause = () => setBgVideoReady(false);
      videoEl.addEventListener("playing", handlePlaying);
      videoEl.addEventListener("pause", handlePause);

      return () => {
        videoEl.removeEventListener("playing", handlePlaying);
        videoEl.removeEventListener("pause", handlePause);
      };
    }
  }, []);

  useEffect(() => {
    resizeCanvas();
  }, [resizeCanvas]);

  useEffect(() => {
    window.addEventListener("resize", resizeCanvas);
    return () => {
      window.removeEventListener("resize", resizeCanvas);
    };
  }, [resizeCanvas]);

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  useEffect(() => {
    initializeDots();
  }, [initializeDots]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.code === "Space" || event.key === " ") {
        event.preventDefault();
        if (isActive) {
          cycleMode();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isActive, cycleMode]);

  // Animation Loop
  useEffect(() => {
    if (!modelLoaded) return;
    
    const segmentVideo = async () => {
      const v = videoRef.current;
      const selfieSegmentation = selfieSegmentationRef.current;
      if (!v || !selfieSegmentation || v.readyState < v.HAVE_CURRENT_DATA) return;
      
      try {
        await selfieSegmentation.send({ image: v });
      } catch (e) {
        console.error("Segmentation error:", e);
      }
    };

    const animate = () => {
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext("2d");
      if (!canvas || !ctx) {
        animationRef.current = requestAnimationFrame(animate);
        return;
      }

      frameCountRef.current++;
      if (isActive && frameCountRef.current % 2 === 0) {
        segmentVideo();
      }

      // Clear or fade previous frame
      const nowTs = performance.now();
      const delta = nowTs - (lastFrameTimeRef.current || nowTs);
      lastFrameTimeRef.current = nowTs;

      if (ghostlyEnabled) {
        const fadeFactor = 1 - Math.exp(-delta / 300);
        ctx.save();
        ctx.globalAlpha = Math.min(1, fadeFactor);
        ctx.fillStyle = "#000";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.restore();
      } else {
        ctx.fillStyle = "#000";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }

      // Prepare sampled background pixel data if needed
      let data: Uint8ClampedArray | null = null;
      let bgSource: HTMLVideoElement | HTMLImageElement | null = null;
      if (mode === MODES.IMAGE_REVEAL && imageRef.current && imageLoaded) {
        bgSource = imageRef.current;
      } else if (mode === MODES.VIDEO_REVEAL && bgVideoRef.current && bgVideoReady) {
        bgSource = bgVideoRef.current;
      }

      if (bgSource) {
        let off = imageCanvasRef.current;
        if (!off) {
          off = document.createElement("canvas");
          imageCanvasRef.current = off;
        }
        off.width = canvas.width;
        off.height = canvas.height;
        const ic = off.getContext("2d");
        if (ic) {
          ic.save();
          const sourceWidth = ('videoWidth' in bgSource ? bgSource.videoWidth : bgSource.width) || 0;
          const sourceHeight = ('videoHeight' in bgSource ? bgSource.videoHeight : bgSource.height) || 0;

          let drawWidth = canvas.width;
          let drawHeight = canvas.height;
          let offsetX = 0;
          let offsetY = 0;

          if (sourceWidth && sourceHeight) {
            const scale = Math.max(canvas.width / sourceWidth, canvas.height / sourceHeight);
            drawWidth = sourceWidth * scale;
            drawHeight = sourceHeight * scale;
            offsetX = (canvas.width - drawWidth) / 2;
            offsetY = (canvas.height - drawHeight) / 2;
          }

          const drawY = offsetY;
          if (isMirrored) {
            ic.scale(-1, 1);
            const drawX = -offsetX - drawWidth;
            ic.drawImage(bgSource, drawX, drawY, drawWidth, drawHeight);
          } else {
            const drawX = offsetX;
            ic.drawImage(bgSource, drawX, drawY, drawWidth, drawHeight);
          }
          ic.restore();
          const imgd = ic.getImageData(0, 0, canvas.width, canvas.height);
          data = imgd.data;
        }
      }

      // Segmentation data
      const segmentation = lastSegmentationRef.current;

      // Draw dots
      dotsRef.current.forEach((dot) => {
        let active = false;
        if (segmentation) {
          const scaleX = segmentation.width / canvas.width;
          const scaleY = segmentation.height / canvas.height;
          const mx = Math.floor(dot.baseX * scaleX);
          const my = Math.floor(dot.baseY * scaleY);
          if (mx >= 0 && my >= 0 && mx < segmentation.width && my < segmentation.height) {
            const idx = (my * segmentation.width + mx) * 4;
            // MediaPipe segmentation mask: check red channel (grayscale mask)
            const maskValue = segmentation.data[idx];
            active = maskValue > 128; // Threshold for person detection
          }
        }

        dot.active = active ? 1 : 0;
        if (dot.active) {
          const size = dot.baseSize * 1.5;
          ctx.beginPath();
          ctx.arc(dot.baseX, dot.baseY, size, 0, Math.PI * 2);
          let fill = "#fff";
          if (mode === MODES.GREEN_DOTS) {
            fill = "hsl(120,90%,70%)";
          } else if (data) {
            const px = Math.floor(dot.baseX);
            const py = Math.floor(dot.baseY);
            const pidx = (py * canvas.width + px) * 4;
            const r = data[pidx] || 0;
            const g = data[pidx + 1] || 0;
            const b = data[pidx + 2] || 0;
            fill = `rgb(${r}, ${g}, ${b})`;
          }
          ctx.fillStyle = fill;
          ctx.fill();
        } else {
          ctx.beginPath();
          ctx.arc(dot.baseX, dot.baseY, dot.baseSize * 0.5, 0, Math.PI * 2);
          ctx.fillStyle = "#000";
          ctx.fill();
        }
      });

      animationRef.current = requestAnimationFrame(animate);
    };

    animate();
    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [isActive, modelLoaded, bgVideoReady, imageLoaded, mode, ghostlyEnabled, isMirrored]);

  useEffect(() => {
    const handleFullscreenChange = () => {
      const fsElement = document.fullscreenElement ||
        (document as Document & { webkitFullscreenElement?: Element }).webkitFullscreenElement ||
        (document as Document & { mozFullScreenElement?: Element }).mozFullScreenElement ||
        (document as Document & { msFullscreenElement?: Element }).msFullscreenElement;
      setIsFullscreen(Boolean(fsElement));
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    document.addEventListener("webkitfullscreenchange", handleFullscreenChange);
    document.addEventListener("mozfullscreenchange", handleFullscreenChange);
    document.addEventListener("MSFullscreenChange", handleFullscreenChange);

    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
      document.removeEventListener("webkitfullscreenchange", handleFullscreenChange);
      document.removeEventListener("mozfullscreenchange", handleFullscreenChange);
      document.removeEventListener("MSFullscreenChange", handleFullscreenChange);
    };
  }, []);

  const toggleFullscreen = useCallback(async () => {
    const container = containerRef.current;
    if (!container) return;

    try {
      if (!document.fullscreenElement) {
        if (container.requestFullscreen) {
          await container.requestFullscreen();
        } else if ('webkitRequestFullscreen' in container) {
          await (container as unknown as { webkitRequestFullscreen: () => Promise<void> }).webkitRequestFullscreen();
        } else if ('mozRequestFullScreen' in container) {
          await (container as unknown as { mozRequestFullScreen: () => Promise<void> }).mozRequestFullScreen();
        } else if ('msRequestFullscreen' in container) {
          await (container as unknown as { msRequestFullscreen: () => Promise<void> }).msRequestFullscreen();
        }
      } else {
        if (document.exitFullscreen) {
          await document.exitFullscreen();
        } else if ('webkitExitFullscreen' in document) {
          await (document as unknown as { webkitExitFullscreen: () => Promise<void> }).webkitExitFullscreen();
        } else if ('mozCancelFullScreen' in document) {
          await (document as unknown as { mozCancelFullScreen: () => Promise<void> }).mozCancelFullScreen();
        } else if ('msExitFullscreen' in document) {
          await (document as unknown as { msExitFullscreen: () => Promise<void> }).msExitFullscreen();
        }
      }
    } catch (err) {
      console.error("Fullscreen toggle failed", err);
    }
  }, []);

  useEffect(() => {
    if (!isActive) return;

    const handler = (event: KeyboardEvent) => {
      if (event.repeat) return;
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA")) return;

      switch (event.key) {
        case "1":
          event.preventDefault();
          cycleMode();
          break;
        case "2":
          event.preventDefault();
          cycleDotMode();
          break;
        case "3":
          event.preventDefault();
          setGhostlyEnabled((prev) => !prev);
          break;
        case "4":
          event.preventDefault();
          setIsMirrored((prev) => !prev);
          break;
        case "5":
          event.preventDefault();
          toggleFullscreen();
          break;
        default:
          break;
      }
    };

    window.addEventListener("keydown", handler);
    return () => {
      window.removeEventListener("keydown", handler);
    };
  }, [isActive, cycleMode, cycleDotMode, toggleFullscreen]);

  const isStartButtonDisabled = !modelLoaded;

  const subtleButtonClasses =
    "flex items-center justify-center gap-2 px-5 py-2.5 rounded-full bg-black text-white font-medium shadow-lg shadow-black/40 border border-transparent backdrop-blur transition hover:border-white/10";

  return (
    <div ref={containerRef} className="relative w-full h-screen overflow-hidden bg-black">
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full"
        style={{ transform: isMirrored ? "scaleX(-1)" : "none" }}
      />

      {/* Hidden segmentation canvas */}
      <canvas ref={segmentationCanvasRef} className="hidden" />

      {/* Hidden bg video used when cycling to a video file */}
      <video ref={bgVideoRef} className="hidden" playsInline muted loop />

      {/* Hidden camera input */}
      <video
        ref={videoRef}
        className="hidden"
        playsInline
        muted
        style={{ transform: isMirrored ? "scaleX(-1)" : "none" }}
      />

      {!isFullscreen && !isActive && (
        <div className="absolute inset-0 pointer-events-none">
          <div
            className="pointer-events-auto relative flex h-full w-full items-center justify-center overflow-hidden bg-black text-white"
          >
            <div
              className="absolute inset-0 bg-cover bg-center"
              style={{
                backgroundImage: 'url(/app-cover.jpg)',
              }}
            />
            <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-black/70 to-black/80" />

              <div className="relative w-full max-w-lg rounded-[32px] border border-white/10 bg-black/65 px-8 py-12 text-center backdrop-blur-2xl shadow-2xl shadow-black/70">
              <div className="mx-auto w-full max-w-lg">
                <div className="text-3xl font-semibold tracking-tight drop-shadow-lg">Interactive Shadower</div>
                <div className="mt-2 text-sm font-medium text-white/80 leading-relaxed">
                  Creator: Faizan Khan - Creative Consultant & Innovator
                </div>
              </div>
              <div className="mt-6 mx-auto flex w-full max-w-lg items-center gap-3 text-sm font-medium text-white/95">
                <a
                  href="https://instagram.com/fanxology"
                  target="_blank"
                  rel="noreferrer"
                  className="flex flex-1 items-center justify-center gap-3 rounded-2xl bg-white/12 px-5 py-2.5 transition hover:bg-white/20"
                >
                  <Instagram className="h-5 w-5" />
                  <span>Fanxology</span>
                </a>
                <a
                  href="https://wa.me/923244036072?text=Contacting%20you%20regarding%20your%20Interactive%20Shadower%20App"
                  target="_blank"
                  rel="noreferrer"
                  className="flex flex-1 items-center justify-center gap-3 rounded-2xl bg-white/12 px-5 py-2.5 transition hover:bg-white/20"
                >
                  <MessageCircle className="h-5 w-5" />
                  <span>+92 324 4036072</span>
                </a>
              </div>
              <div className="mt-6 mx-auto w-full max-w-lg text-[11px] uppercase tracking-[0.3em] text-white/55">
                Photo by Janmesh Shah on Unsplash
              </div>
              <div className="mt-6 mx-auto w-full max-w-lg">
                <button
                  onClick={startCamera}
                  className={`pointer-events-auto flex w-full items-center justify-center gap-2 rounded-full bg-emerald-500 px-7 py-2.5 text-sm font-semibold text-black shadow-lg shadow-black/40 border border-transparent transition ${
                    isStartButtonDisabled ? "opacity-40 cursor-not-allowed" : "hover:bg-emerald-400"
                  }`}
                  disabled={isStartButtonDisabled}
                >
                  <Play className="w-4 h-4" />
                  {modelLoaded ? "Start Experience" : "Loading AI Model..."}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {!isFullscreen && isActive && (
          <div className="absolute inset-x-0 bottom-16 flex justify-center pointer-events-none">
          <div className="pointer-events-auto flex flex-wrap items-center justify-center gap-3 text-sm font-medium">
            <button onClick={cycleMode} className={subtleButtonClasses}>
              <RefreshCw className="w-4 h-4" />
              Toggle Effect <span className="text-white/50 text-xs font-medium">1</span>
            </button>
            <button
              onClick={cycleDotMode}
              className={subtleButtonClasses}
              title={`Current: ${currentDotMode.label}`}
            >
              <Grid3X3 className="w-4 h-4" />
              Toggle Dots <span className="text-white/50 text-xs font-medium">2</span>
            </button>
            <button
              onClick={() => setGhostlyEnabled((prev) => !prev)}
              className={subtleButtonClasses}
              title={ghostlyEnabled ? "Ghostly trail on" : "Ghostly trail off"}
            >
              <Ghost className="w-4 h-4" />
              {ghostlyEnabled ? "Disable Ghostly" : "Enable Ghostly"} <span className="text-white/50 text-xs font-medium">3</span>
            </button>
            <button
              onClick={() => setIsMirrored((prev) => !prev)}
              className={subtleButtonClasses}
              title={isMirrored ? "Mirrored view" : "Original view"}
            >
              <FlipHorizontal2 className="w-4 h-4" />
              {isMirrored ? "Unmirror View" : "Mirror View"} <span className="text-white/50 text-xs font-medium">4</span>
            </button>
            <button
              onClick={toggleFullscreen}
              className={subtleButtonClasses}
              title={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
            >
              {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
              {isFullscreen ? "Exit Fullscreen" : "Go Fullscreen"} <span className="text-white/50 text-xs font-medium">5</span>
            </button>
            <button
              onClick={stopCamera}
              className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-full bg-red-600 hover:bg-red-500 text-white font-semibold shadow-lg shadow-black/40 transition"
            >
              <CameraOff className="w-4 h-4" />
              Stop Experience
            </button>
          </div>
        </div>
      )}

      {!isFullscreen && error && (
        <div className="absolute top-8 left-1/2 -translate-x-1/2 bg-red-500 text-white px-4 py-2 rounded">
          {error}
        </div>
      )}

      {!isFullscreen && !modelLoaded && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 bg-yellow-500 text-white px-4 py-2 rounded animate-pulse">
          Initializing AI Model...
        </div>
      )}
    </div>
  );
}
