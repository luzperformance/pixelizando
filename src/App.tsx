import React, { useState, useRef, useEffect } from "react";
import { motion } from "motion/react";
import { Upload, Download, RefreshCw, User, Grid2x2, Cpu, Scan } from "lucide-react";

export default function App() {
  const [image, setImage] = useState<string | null>(null);
  const [pixelSize, setPixelSize] = useState(16);
  const [isProcessing, setIsProcessing] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Expression Warp States
  const [smileIntensity, setSmileIntensity] = useState(40); // default to 40% smile to show off the gorgeous effect instantly!
  const [mouthX, setMouthX] = useState(50);
  const [mouthY, setMouthY] = useState(63);
  const [mouthWidth, setMouthWidth] = useState(24);
  const [showCrosshair, setShowCrosshair] = useState(true);

  const handleCanvasClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!image) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = ((e.clientX - rect.left) / rect.width) * 100;
    const clickY = ((e.clientY - rect.top) / rect.height) * 100;
    
    setMouthX(Math.round(clickX));
    setMouthY(Math.round(clickY));
  };

  // Preset densities
  const presets = [
    { label: "8-BIT NES", value: 32 },
    { label: "16-BIT VGA", value: 16 },
    { label: "GBOY GREEN", value: 48 },
    { label: "C64 MODE", value: 8 }
  ];

  // Mood Matrix Filters
  const moods = [
    { id: "neutral", label: "NEUTRAL", filter: "none", color: "#F5F5F5" },
    { id: "radiant", label: "RADIANT", filter: "saturate(1.4) contrast(1.1) sepia(0.2)", color: "#FFD700" },
    { id: "toxic", label: "TOXIC", filter: "hue-rotate(90deg) contrast(1.2)", color: "#00FF00" },
    { id: "deep", label: "DEEP", filter: "contrast(1.5) brightness(0.7) saturate(0.5)", color: "#4F46E5" }
  ];

  const [activeMood, setActiveMood] = useState(moods[0]);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setImage(event.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const processImage = () => {
    if (!image || !canvasRef.current) return;
    setIsProcessing(true);

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return;

    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = image;

    img.onload = () => {
      const size = 1024;
      canvas.width = size;
      canvas.height = size;

      // Draw original cropped to 1024x1024 square source Canvas
      const sourceCanvas = document.createElement("canvas");
      sourceCanvas.width = size;
      sourceCanvas.height = size;
      const sCtx = sourceCanvas.getContext("2d")!;
      
      const srcW = img.width;
      const srcH = img.height;
      const srcScale = Math.max(size / srcW, size / srcH);
      const drawW = srcW * srcScale;
      const drawH = srcH * srcScale;
      const drawX = (size - drawW) / 2;
      const drawY = (size - drawH) / 2;
      sCtx.drawImage(img, drawX, drawY, drawW, drawH);
      const sData = sCtx.getImageData(0, 0, size, size);

      const tempCanvas = document.createElement("canvas");
      const tempCtx = tempCanvas.getContext("2d")!;
      const tinySize = Math.max(8, Math.floor(size / pixelSize));
      tempCanvas.width = tinySize;
      tempCanvas.height = tinySize;
      
      const tinyData = tempCtx.createImageData(tinySize, tinySize);
      
      const mx = (mouthX / 100) * size;
      const my = (mouthY / 100) * size;
      const mw = (mouthWidth / 100) * size;
      const mh = mw * 0.45;
      const smileIntensityVal = smileIntensity / 100;

      for (let ty = 0; ty < tinySize; ty++) {
        for (let tx = 0; tx < tinySize; tx++) {
          // Centered pixel mapping within 1024 grid
          let sx = (tx + 0.5) * (size / tinySize);
          let sy = (ty + 0.5) * (size / tinySize);
          
          const dx = sx - mx;
          const dy = sy - my;
          
          const hFactor = Math.abs(dx) / mw;
          const vFactor = Math.abs(dy) / mh;
          
          if (hFactor < 1 && vFactor < 1) {
            // Smooth bell curve envelope
            const influence = Math.pow(Math.cos(hFactor * Math.PI / 2), 2) * Math.pow(Math.cos(vFactor * Math.PI / 2), 2);
            
            // Warp vertical: pull corners up (sample lower down in source)
            const curve = smileIntensityVal * (mw * 0.18) * ( (dx / mw) * (dx / mw) );
            // Slight uplift of lower lips
            const lift = -smileIntensityVal * (mw * 0.04);
            const totalShiftY = (curve + lift) * influence;
            
            // Warp horizontal: stretch corners outward (sample closer to center)
            const stretchX = smileIntensityVal * (dx * 0.18) * influence;
            
            sx = sx - stretchX;
            sy = sy + totalShiftY;
          }
          
          // Clamp target lookup bounds
          sx = Math.max(0, Math.min(size - 1, sx));
          sy = Math.max(0, Math.min(size - 1, sy));
          
          const srcIdx = (Math.floor(sy) * size + Math.floor(sx)) * 4;
          const tinyIdx = (ty * tinySize + tx) * 4;
          
          tinyData.data[tinyIdx] = sData.data[srcIdx];
          tinyData.data[tinyIdx + 1] = sData.data[srcIdx + 1];
          tinyData.data[tinyIdx + 2] = sData.data[srcIdx + 2];
          tinyData.data[tinyIdx + 3] = sData.data[srcIdx + 3];

          // Teeth brightening effect
          if (smileIntensityVal > 0.15 && hFactor < 0.4 && vFactor < 0.3) {
            const infl = (1 - hFactor) * (1 - vFactor) * smileIntensityVal;
            const r = tinyData.data[tinyIdx];
            const g = tinyData.data[tinyIdx+1];
            const b = tinyData.data[tinyIdx+2];
            const luminance = 0.299 * r + 0.587 * g + 0.114 * b;
            if (luminance < 110) {
              tinyData.data[tinyIdx] = Math.min(255, r + 24 * infl);
              tinyData.data[tinyIdx + 1] = Math.min(255, g + 24 * infl);
              tinyData.data[tinyIdx + 2] = Math.min(255, b + 24 * infl);
            }
          }
        }
      }
      
      tempCtx.putImageData(tinyData, 0, 0);

      ctx.imageSmoothingEnabled = false;
      ctx.clearRect(0, 0, size, size);
      
      // Apply mood filter in canvas
      ctx.filter = activeMood.filter;
      ctx.drawImage(tempCanvas, 0, 0, tinySize, tinySize, 0, 0, size, size);

      setIsProcessing(false);
    };
  };

  useEffect(() => {
    if (image) {
      processImage();
    }
  }, [image, pixelSize, activeMood, smileIntensity, mouthX, mouthY, mouthWidth]);

  const downloadImage = () => {
    if (!canvasRef.current) return;
    const link = document.createElement("a");
    link.download = "pixl-export.png";
    link.href = canvasRef.current.toDataURL("image/png");
    link.click();
  };

  return (
    <div className="min-h-screen bg-black text-white font-sans flex flex-col md:flex-row overflow-hidden border-4 md:border-8 border-black box-border">
      {/* LEFT CONTROL COLUMN */}
      <div className="w-full md:w-1/3 h-full border-b md:border-b-0 md:border-r border-white/20 flex flex-col p-6 md:p-12 bg-[#0a0a0a] z-20">
        <div className="flex flex-col h-full">
          <motion.div 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="mb-12"
          >
            <h1 className="text-8xl md:text-9xl font-black tracking-tighter leading-[0.75] text-[#00FF00] mb-4">
              PIXL
            </h1>
            <p className="font-mono text-[10px] tracking-widest text-[#00FF00]/60 uppercase flex items-center gap-2">
              <Cpu size={12} />
              v.2.0.4 - PIXEL ENGINE ACTIVE
            </p>
          </motion.div>

          <div className="space-y-12 flex-grow">
            {/* Step 01 */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <span className="w-4 h-px bg-[#00FF00]/40"></span>
                <label className="font-mono text-[10px] text-[#00FF00] uppercase tracking-[0.2em] font-bold">01. Source Image</label>
              </div>
              <div 
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-white/20 h-40 flex flex-col items-center justify-center p-8 cursor-pointer hover:border-[#00FF00] hover:bg-[#00FF00]/5 transition-all group rounded-sm"
              >
                <Upload size={24} className="text-white/20 group-hover:text-[#00FF00] mb-4 transition-colors" />
                <div className="text-center">
                  <div className="text-xs font-bold text-white/40 group-hover:text-white uppercase tracking-tight">[ DROP FILE HERE ]</div>
                  <div className="text-[10px] text-white/20 mt-1 uppercase">SUPPORTED: JPG, PNG, WEBP</div>
                </div>
              </div>
            </div>

            {/* Step 02 */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <span className="w-4 h-px bg-[#00FF00]/40"></span>
                <label className="font-mono text-[10px] text-[#00FF00] uppercase tracking-[0.2em] font-bold">02. Preset Engine</label>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {presets.map((p) => (
                  <button 
                    key={p.label}
                    onClick={() => setPixelSize(p.value)}
                    className={`border py-4 text-[10px] font-mono tracking-wider transition-all rounded-sm font-bold ${
                      pixelSize === p.value 
                      ? 'border-[#00FF00] bg-[#00FF00] text-black shadow-[0_0_15px_rgba(0,255,0,0.3)]' 
                      : 'border-white/10 bg-white/5 text-white/60 hover:bg-[#00FF00]/10 hover:text-[#00FF00] hover:border-[#00FF00]'
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Step 03 */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <span className="w-4 h-px bg-[#00FF00]/40"></span>
                <label className="font-mono text-[10px] text-[#00FF00] uppercase tracking-[0.2em] font-bold">03. Mood Matrix</label>
              </div>
              <div className="grid grid-cols-4 gap-1">
                {moods.map((m) => (
                  <button 
                    key={m.id}
                    onClick={() => setActiveMood(m)}
                    className={`border py-2 text-[8px] font-mono tracking-tighter transition-all rounded-sm font-black ${
                      activeMood.id === m.id 
                      ? 'border-[#00FF00] bg-[#00FF00] text-black' 
                      : 'border-white/10 bg-white/5 text-white/40 hover:bg-white/10'
                    }`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Step 04: Smile Mechanics */}
            <div className="space-y-5 bg-white/[0.02] border border-white/5 p-4 rounded-md">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-4 h-px bg-[#00FF00]/40"></span>
                  <label className="font-mono text-[10px] text-[#00FF00] uppercase tracking-[0.2em] font-bold">04. Expression Matrix</label>
                </div>
                {image && (
                  <button 
                    onClick={() => setShowCrosshair(!showCrosshair)}
                    className={`font-mono text-[8px] border px-2 py-0.5 rounded-sm uppercase tracking-wider ${
                      showCrosshair ? 'bg-[#00FF00]/10 border-[#00FF00] text-[#00FF00]' : 'bg-transparent border-white/20 text-white/40'
                    }`}
                  >
                    {showCrosshair ? 'Lock On' : 'Lock Off'}
                  </button>
                )}
              </div>

              {/* Slider for Smile Power */}
              <div className="space-y-2">
                <div className="flex justify-between items-center font-mono text-[9px] text-white/50 uppercase">
                  <span>Smile Intensity (Sorriso)</span>
                  <span className="text-[#00FF00] font-bold">{smileIntensity}%</span>
                </div>
                <input 
                  type="range" 
                  min="0" 
                  max="100" 
                  step="2"
                  value={smileIntensity} 
                  disabled={!image}
                  onChange={(e) => setSmileIntensity(parseInt(e.target.value))}
                  className="w-full accent-[#00FF00] bg-white/10 h-1 rounded-full cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                />
                <div className="flex justify-between font-mono text-[8px] text-white/20 uppercase font-black tracking-tighter">
                  <span>Neutral (Neutro)</span>
                  <span>Beaming Smile (Radiante)</span>
                </div>
              </div>

              {image && (
                <div className="pt-2 border-t border-white/5 space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    {/* Position Y Control */}
                    <div className="space-y-1">
                      <div className="flex justify-between items-center font-mono text-[8px] text-white/40 uppercase">
                        <span>Mouth Y ({mouthY}%)</span>
                      </div>
                      <input 
                        type="range" 
                        min="35" 
                        max="85" 
                        step="1"
                        value={mouthY} 
                        onChange={(e) => setMouthY(parseInt(e.target.value))}
                        className="w-full accent-[#00FF00]/60 bg-white/5 h-1 rounded-full cursor-pointer"
                      />
                    </div>

                    {/* Mouth Width Control */}
                    <div className="space-y-1">
                      <div className="flex justify-between items-center font-mono text-[8px] text-white/40 uppercase">
                        <span>Width ({mouthWidth}%)</span>
                      </div>
                      <input 
                        type="range" 
                        min="12" 
                        max="40" 
                        step="1"
                        value={mouthWidth} 
                        onChange={(e) => setMouthWidth(parseInt(e.target.value))}
                        className="w-full accent-[#00FF00]/60 bg-white/5 h-1 rounded-full cursor-pointer"
                      />
                    </div>
                  </div>

                  <p className="font-mono text-[8px] text-[#00FF00]/40 leading-normal uppercase">
                    💡 Click directly on the avatar to center sensor onto your mouth!
                  </p>
                </div>
              )}
            </div>

            {/* Step 05 */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <span className="w-4 h-px bg-[#00FF00]/40"></span>
                <label className="font-mono text-[10px] text-[#00FF00] uppercase tracking-[0.2em] font-bold">05. Density Control</label>
              </div>
              <div className="space-y-3">
                <input 
                  type="range" 
                  min="4" 
                  max="64" 
                  step="4"
                  value={pixelSize} 
                  onChange={(e) => setPixelSize(parseInt(e.target.value))}
                  className="w-full accent-[#00FF00] bg-white/10 h-1 rounded-full cursor-pointer"
                />
                <div className="flex justify-between font-mono text-[9px] text-white/30 uppercase font-bold tracking-tighter">
                  <span>LOW RESOLUTION</span>
                  <span>ULTRA DETAIL</span>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-12 space-y-3">
            <button 
              onClick={downloadImage}
              disabled={!image}
              className="w-full bg-[#00FF00] text-black font-black py-6 text-xl tracking-tighter hover:brightness-110 disabled:opacity-30 disabled:cursor-not-allowed transition-all uppercase flex items-center justify-center gap-3 shadow-[0_0_30px_rgba(0,255,0,0.2)]"
            >
              <Download size={20} strokeWidth={3} />
              {activeMood.id === 'radiant' ? 'EXPORT_RADIANT_VERSION' : 'EXPORT_MATRIX'}
            </button>
            <p className="text-[9px] font-mono text-white/30 text-center uppercase tracking-widest leading-relaxed">
              {activeMood.id === 'radiant' 
                ? 'AI ENHANCEMENT: Radiant mood active. Simulating warmth.' 
                : 'Awaiting execution parameters... AI Generation restricted by quota.'}
            </p>
          </div>
        </div>
      </div>

      {/* RIGHT PREVIEW PANE */}
      <div className="w-full md:w-2/3 h-[60vh] md:h-full relative flex items-center justify-center bg-[#111] overflow-hidden overflow-y-auto">
        {/* Grid Background Layer */}
        <div 
          className="absolute inset-0 opacity-10 pointer-events-none" 
          style={{ backgroundImage: 'radial-gradient(#00FF00 1px, transparent 1px)', backgroundSize: '30px 30px' }}
        ></div>

        {/* Preview Frame */}
        <motion.div 
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.5 }}
          onClick={handleCanvasClick}
          className={`relative w-[300px] h-[300px] sm:w-[450px] sm:h-[450px] lg:w-[500px] lg:h-[500px] border-4 border-[#00FF00] bg-black shadow-[0_0_80px_rgba(0,255,0,0.15)] group ${image ? 'cursor-crosshair' : 'cursor-default'}`}
        >
          {!image ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center p-12 text-center pointer-events-none">
              <Scan size={80} className="text-white/5 mb-6 animate-pulse" />
              <div className="space-y-2">
                <p className="font-mono text-[10px] text-white/30 uppercase tracking-[0.4em]">Identity Sensor</p>
                <p className="font-mono text-[10px] text-[#00FF00]/40 uppercase tracking-widest italic animate-pulse">NO_SOURCE_DETECTED</p>
              </div>
            </div>
          ) : (
            <>
              <canvas 
                ref={canvasRef} 
                className="w-full h-full object-cover transition-all duration-500 group-hover:scale-[1.02]"
              />

              {/* Glowing Target Locator HUD Ring */}
              {showCrosshair && (
                <div 
                  style={{ left: `${mouthX}%`, top: `${mouthY}%` }}
                  className="absolute -translate-x-1/2 -translate-y-1/2 pointer-events-none z-20 flex items-center justify-center transition-all duration-150"
                >
                  <div className="absolute w-12 h-12 border-2 border-dashed border-[#00FF00] rounded-full animate-spin [animation-duration:12s] opacity-70"></div>
                  <div className="absolute w-18 h-18 border border-[#00FF00]/20 rounded-full"></div>
                  {/* Scope lines */}
                  <div className="absolute h-18 w-0.5 bg-[#00FF00]/50"></div>
                  <div className="absolute w-18 h-0.5 bg-[#00FF00]/50"></div>
                  {/* Center Dot */}
                  <div className="w-2 h-2 bg-[#00FF00] rounded-full shadow-[0_0_12px_#00FF00]"></div>
                  
                  {/* Tag label */}
                  <div className="absolute top-10 whitespace-nowrap bg-black/90 text-[#00FF00] border border-[#00FF00]/30 font-mono text-[8px] px-2 py-0.5 tracking-tighter uppercase font-bold rounded-sm">
                    SENSOR LOCK: {mouthX}% X / {mouthY}% Y
                  </div>
                </div>
              )}
            </>
          )}

          {/* Decorative Corner Accents */}
          <div className="absolute -top-1 -left-1 w-8 h-8 border-t-4 border-l-4 border-[#00FF00] z-10 pointer-events-none" />
          <div className="absolute -bottom-1 -right-1 w-8 h-8 border-b-4 border-r-4 border-[#00FF00] z-10 pointer-events-none" />
          
          {/* Status Indicators */}
          <div className="absolute top-4 left-4 font-mono text-[9px] bg-black text-[#00FF00] px-3 py-1.5 border border-[#00FF00]/40 flex items-center gap-2 z-10 pointer-events-none">
            <span className="w-1.5 h-1.5 bg-[#00FF00] animate-ping rounded-full"></span>
            REF: 0981-PX
          </div>
          
          <div className="absolute bottom-4 right-4 font-mono text-[9px] bg-[#00FF00] text-black px-3 py-1.5 font-bold flex items-center gap-2 z-10 pointer-events-none">
            {isProcessing ? "STATUS: PROCESSING..." : "STATUS: LIVE_PREVIEW"}
          </div>

          {/* Processing Overlay */}
          {isProcessing && (
            <div className="absolute inset-0 bg-black/80 backdrop-blur-sm z-30 flex flex-col items-center justify-center gap-4">
              <RefreshCw className="animate-spin text-[#00FF00]" size={40} />
              <span className="font-mono text-[10px] uppercase tracking-[0.5em] text-[#00FF00]">Reconstructing Matrix</span>
            </div>
          )}
        </motion.div>

        {/* Floating Side Info */}
        <div className="hidden lg:block absolute right-12 top-1/2 -translate-y-1/2 rotate-180" style={{ writingMode: 'vertical-rl' }}>
          <p className="font-mono text-[10px] tracking-[0.8em] text-white/20 uppercase font-black">
            AUTO-ALIGNMENT / MATRIX-SYNC / REALTIME-PROCESSING
          </p>
        </div>

        {/* Small Data Blocks */}
        <div className="absolute bottom-8 left-12 font-mono text-[8px] text-white/20 space-y-1 hidden sm:block">
          <p>[ COORDS: 40.7128N / 74.0060W ]</p>
          <p>[ KERNEL: STABLE_BUILD_205 ]</p>
          <p>[ ENCRYPTION: AES-256-BIT ]</p>
        </div>

        <input 
          type="file" 
          ref={fileInputRef} 
          onChange={handleImageUpload} 
          accept="image/*" 
          className="hidden" 
        />
      </div>
    </div>
  );
}
