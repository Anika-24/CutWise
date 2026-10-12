import React, { useState, useRef, useEffect } from 'react';
import {
  Camera,
  Upload,
  RefreshCw,
  Save,
  AlertTriangle,
  Ruler,
  Crosshair,
  SwitchCamera,
} from 'lucide-react';
import { useProject } from '@/lib/ProjectContext';
import { fromMm, toMm } from '@/lib/geometry';

const MAX_IMAGE_SIZE_BYTES =
  Number(import.meta.env.VITE_SCANNER_MAX_IMAGE_BYTES) || 10 * 1024 * 1024;

export default function ScrapScanner() {
  const [selectedMaterial, setSelectedMaterial] = useState('Plywood')
  const { addPiece, material: projectMaterial } = useProject()

  const u = projectMaterial.unit

  const [mode, setMode] = useState('idle');
  const [stream, setStream] = useState(null);
  const [imgUrl, setImgUrl] = useState(null);
  const [img, setImg] = useState(null);
  const [points, setPoints] = useState([]);
  const [refPts, setRefPts] = useState([]);
  const [refLen, setRefLen] = useState(100);
  const [manualW, setManualW] = useState('');
  const [manualH, setManualH] = useState('');
  const [error, setError] = useState('');
  const [cameraBusy, setCameraBusy] = useState(false);
  const [facingMode, setFacingMode] = useState('environment');
  

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const fileRef = useRef(null);
  const streamRef = useRef(null);
  const imageUrlRef = useRef(null);

  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }

      if (imageUrlRef.current) {
        URL.revokeObjectURL(imageUrlRef.current);
        imageUrlRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (mode !== 'camera' || !stream || !videoRef.current) return;

    const video = videoRef.current;
    video.srcObject = stream;
    video.play().catch(() => {});

    return () => {
      video.srcObject = null;
    };
  }, [stream, mode]);

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setStream(null);
  };

  const openCamera = async (facing = facingMode) => {
    setError('');

    if (!navigator.mediaDevices?.getUserMedia) {
      setError(
        'Camera access is unavailable in this browser. Use HTTPS or localhost, or upload a photo.'
      );
      return;
    }

    stopCamera();
    setCameraBusy(true);

    try {
      const s = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: facing },
          width: { ideal: 1280 },
          height: { ideal: 960 },
        },
        audio: false,
      });

      streamRef.current = s;
      setStream(s);
      setFacingMode(facing);
      setMode('camera');
    } catch (e) {
      const messages = {
        NotAllowedError:
          'Camera permission was denied. Allow camera access in browser settings or upload a photo.',
        NotFoundError: 'No camera was found on this device.',
        NotReadableError:
          'The camera is busy or unavailable. Close other apps using it and try again.',
        OverconstrainedError:
          'That camera is unavailable. Try switching cameras.',
      };

      setError(
        messages[e?.name] ||
          'Could not start the camera. Check browser permissions and try again, or upload a photo.'
      );
    } finally {
      setCameraBusy(false);
    }
  };

  const startCamera = () => openCamera();

  const setImageFile = (file) => {
    setError('');

    if (!file) return;

    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setError('Choose a JPEG, PNG, or WebP image.');
      return;
    }

    if (file.size > MAX_IMAGE_SIZE_BYTES) {
      setError(
        `Image is too large. Choose a file up to ${Math.round(
          MAX_IMAGE_SIZE_BYTES / (1024 * 1024)
        )} MB.`
      );
      return;
    }

    const url = URL.createObjectURL(file);
    const image = new Image();

    image.onload = () => {
      if (imageUrlRef.current) {
        URL.revokeObjectURL(imageUrlRef.current);
      }

      imageUrlRef.current = url;
      setImgUrl(url);
      setImg(image);
      setPoints([]);
      setRefPts([]);
      setManualW('');
      setManualH('');
      setMode('review');
    };

    image.onerror = () => {
      URL.revokeObjectURL(url);
      setError(
        'Could not open that image. Please choose another JPEG, PNG, or WebP photo.'
      );
    };

    image.src = url;
  };

  const capture = async () => {
    const video = videoRef.current;

    if (!video || !video.videoWidth || !video.videoHeight) {
      setError(
        'Camera preview is not ready yet. Wait a moment and try again.'
      );
      return;
    }

    try {
      const canvas = document.createElement('canvas');

      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;

      const ctx = canvas.getContext('2d');

      if (!ctx) {
        setError('Could not capture an image. Please try again.');
        return;
      }

      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      const blob = await new Promise((resolve) =>
        canvas.toBlob(resolve, 'image/jpeg', 0.9)
      );

      if (!blob) {
        setError('Could not capture an image. Please try again.');
        return;
      }

      stopCamera();

      setImageFile(
        new File([blob], `cutwise-${Date.now()}.jpg`, {
          type: 'image/jpeg',
        })
      );
    } catch (e) {
      setError('Could not capture an image. Please try again.');
    }
  };

  const onUpload = (e) => {
    setImageFile(e.target.files?.[0]);
    e.target.value = '';
  };

  const onCanvasClick = (e) => {
    const canvas = canvasRef.current;

    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();

    if (!rect.width || !rect.height) return;

    const x =
      ((e.clientX - rect.left) / rect.width) * canvas.width;

    const y =
      ((e.clientY - rect.top) / rect.height) * canvas.height;

    const point = { x, y };

    if (points.length < 4) {
      setPoints((prev) => [...prev, point]);
    } else if (refPts.length < 2) {
      setRefPts((prev) => [...prev, point]);
    }
  };

  const drawOverlay = () => {
    const canvas = canvasRef.current;

    if (!canvas || !img) return;

    const ctx = canvas.getContext('2d');

    if (!ctx) return;

    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    ctx.drawImage(
      img,
      0,
      0,
      canvas.width,
      canvas.height
    );

    if (points.length > 1) {
      ctx.beginPath();

      ctx.moveTo(points[0].x, points[0].y);

      for (let i = 1; i < points.length; i++) {
        ctx.lineTo(points[i].x, points[i].y);
      }

      if (points.length === 4) {
        ctx.closePath();
      }

      ctx.strokeStyle = '#16A34A';
      ctx.lineWidth = 4;
      ctx.stroke();
    }

    points.forEach((p, i) => {
      ctx.beginPath();
      ctx.arc(p.x, p.y, 10, 0, Math.PI * 2);

      ctx.fillStyle = '#16A34A';
      ctx.fill();

      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 18px sans-serif';
      ctx.fillText(
        String(i + 1),
        p.x + 12,
        p.y - 12
      );
    });

    refPts.forEach((p) => {
      ctx.beginPath();
      ctx.arc(p.x, p.y, 10, 0, Math.PI * 2);

      ctx.fillStyle = '#34A99D';
      ctx.fill();
    });

    if (refPts.length === 2) {
      ctx.beginPath();

      ctx.moveTo(refPts[0].x, refPts[0].y);
      ctx.lineTo(refPts[1].x, refPts[1].y);

      ctx.strokeStyle = '#34A99D';
      ctx.lineWidth = 4;
      ctx.stroke();
    }
  };

  useEffect(() => {
    drawOverlay();
  }, [points, refPts, img, imgUrl]);

  const dist = (a, b) =>
    Math.hypot(a.x - b.x, a.y - b.y);

  const measurement = React.useMemo(() => {
    if (points.length !== 4 || refPts.length !== 2) {
      return null;
    }

    const validRefLen = Number(refLen);

    if (!Number.isFinite(validRefLen) || validRefLen <= 0) {
      return null;
    }

    const refPx = dist(refPts[0], refPts[1]);

    if (!Number.isFinite(refPx) || refPx < 20) {
      return null;
    }

    const scale = validRefLen / refPx;

    const w =
      dist(points[0], points[1]) * scale;

    const h =
      dist(points[1], points[2]) * scale;

    if (
      !Number.isFinite(w) ||
      !Number.isFinite(h) ||
      w <= 0 ||
      h <= 0
    ) {
      return null;
    }

    return { w, h };
  }, [points, refPts, refLen]);


const finalW =
  manualW.trim() !== ''
    ? toMm(Number(manualW) || 0, u)
    : 100;

const finalH =
  manualH.trim() !== ''
    ? toMm(Number(manualH) || 0, u)
    : 100;

  const canSave =
  Number.isFinite(finalW) &&
  Number.isFinite(finalH) &&
  finalW > 0 &&
  finalH > 0;

    const saveScrap = () => {
      if (!canSave) return

      addPiece({
        name: 'Scrap piece',
        material: selectedMaterial,
        width: Math.round(finalW),
        height: Math.round(finalH),
        quantity: 1,
        rotationAllowed: true,
      })

      alert('Scrap piece saved!')
    }
  const redoPoints = () => {
    setPoints([]);
    setRefPts([]);
    setManualW('');
    setManualH('');
  };

  const startOver = () => {
    stopCamera();

    if (imageUrlRef.current) {
      URL.revokeObjectURL(imageUrlRef.current);
      imageUrlRef.current = null;
    }

    setImgUrl(null);
    setImg(null);
    setPoints([]);
    setRefPts([]);
    setManualW('');
    setManualH('');
    setError('');
    setMode('idle');
  };

  return (
    <div className="p-4 sm:p-6 max-w-[900px] mx-auto">
      <div className="mb-6">
        <h1 className="font-display text-2xl font-bold text-foreground">
          Smart Scrap Scanner
        </h1>

        <p className="text-sm text-muted-foreground mt-1">
          Measure a rectangular scrap piece from a photo using a reference object of known length.
        </p>
      </div>

      <div className="bg-card border border-border rounded-xl px-4 py-3 text-xs text-primary flex items-start gap-2 mb-4">
        <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />

        <span>
          Measurements are estimates from a calibrated photo, not exact.
          Photograph flat from above with a ruler visible. Always verify
          before cutting.
        </span>
      </div>

      {error && (
        <div className="bg-card border border-border text-primary rounded-xl px-4 py-3 text-sm mb-4">
          {error}
        </div>
      )}

      {mode === 'idle' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
         <button
            onClick={startCamera}
            disabled={cameraBusy}
            className="bg-card rounded-2xl border-2 border-border hover:border-primary p-8 text-center transition disabled:opacity-60"
          >
            <Camera className="w-10 h-10 text-primary mx-auto mb-3" />

            <div className="font-semibold text-foreground">
              {cameraBusy ? 'Opening camera…' : 'Open camera'}
            </div>

            <div className="text-xs text-muted-foreground mt-1">
              Photograph the scrap live
            </div>
          </button>

          <button
            onClick={() => fileRef.current?.click()}
            className="bg-card rounded-2xl border-2 border-border hover:border-primary p-8 text-center transition"
          >
            <Upload className="w-10 h-10 text-primary mx-auto mb-3" />

            <div className="font-semibold text-foreground">
              Upload photo
            </div>

            <div className="text-xs text-muted-foreground mt-1">
              Choose an image file
            </div>
          </button>

          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={onUpload}
          />
        </div>
      )}

      {mode === 'camera' && (
        <div className="bg-card rounded-2xl border border-border p-4">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            aria-label="Live camera preview"
            className="w-full rounded-xl bg-black"
            style={{ maxHeight: 500 }}
          />

          <div className="flex flex-wrap items-center justify-center gap-3 mt-3">
            <button
              onClick={capture}
              className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-primary text-primary-foreground font-semibold"
            >
              <Camera className="w-4 h-4" />
              Capture
            </button>

            <button
              onClick={() =>
                openCamera(
                  facingMode === 'environment'
                    ? 'user'
                    : 'environment'
                )
              }
              className="flex items-center gap-2 px-4 py-2.5 rounded-lg border border-border text-muted-foreground hover:bg-background"
            >
              <SwitchCamera className="w-4 h-4" />
              Switch
            </button>

            <button
              onClick={() => {
                stopCamera();
                setMode('idle');
              }}
              className="px-4 py-2.5 rounded-lg border border-border text-muted-foreground hover:bg-background"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {mode === 'review' && imgUrl && (
        <div className="bg-card rounded-2xl border border-border p-4">
          <canvas
            ref={canvasRef}
            onClick={onCanvasClick}
            className="block w-full rounded-xl cursor-crosshair touch-none"
            style={{ height: 'auto' }}
          />

          <div className="mt-4 space-y-3">
            <div className="text-sm text-muted-foreground">
              {points.length < 4 ? (
                <span className="flex items-center gap-1.5">
                  <Crosshair className="w-4 h-4 text-primary" />
                  Click the 4 corners of the scrap in order (
                  {points.length}/4)
                </span>
              ) : refPts.length < 2 ? (
                <span className="flex items-center gap-1.5">
                  <Ruler className="w-4 h-4 text-primary" />
                  Click the two ends of a reference object of known length (
                  {refPts.length}/2)
                </span>
              ) : (
                <span className="text-primary font-medium">
                  Measurement ready — review and correct below.
                </span>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <label className="text-sm text-muted-foreground">
              <div className="space-y-2">
  <label className="text-sm font-medium">
    Material
  </label>

  <select
    value={selectedMaterial}
    onChange={(e) => setSelectedMaterial(e.target.value)}
    className="w-full rounded-lg border border-border bg-background px-3 py-2"
  >
    <option value="Plywood">Plywood</option>
    <option value="MDF">MDF</option>
    <option value="OSB">OSB</option>
    <option value="Solid Wood">Solid Wood</option>
    <option value="Hardwood">Hardwood</option>
    <option value="Softwood">Softwood</option>
    <option value="Particle Board">Particle Board</option>
    <option value="Melamine">Melamine</option>
    <option value="Other">Other</option>
  </select>
</div>
                Reference length:
              </label>

              <input
                type="number"
                min={1}
                value={refLen}
                onChange={(e) =>
                  setRefLen(
                    Math.max(
                      1,
                      Number(e.target.value) || 1
                    )
                  )
                }
                className="w-24 px-2 py-1.5 rounded-lg border border-border text-sm bg-background"
              />

              <span className="text-sm text-muted-foreground">
                mm
              </span>
            </div>

            {measurement && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground font-medium">
                    Detected width ({u})
                  </label>

                  <input
                    type="number"
                    value={
                      manualW ||
                      Number(
                        fromMm(measurement.w, u)
                      ).toFixed(u === 'mm' ? 0 : 1)
                    }
                    onChange={(e) =>
                      setManualW(e.target.value)
                    }
                    className="w-full mt-1 px-3 py-2 rounded-lg border border-border text-sm bg-background"
                    placeholder="Correct if needed"
                  />
                </div>

                <div>
                  <label className="text-xs text-muted-foreground font-medium">
                    Detected height ({u})
                  </label>

                  <input
                    type="number"
                    value={
                      manualH ||
                      Number(
                        fromMm(measurement.h, u)
                      ).toFixed(u === 'mm' ? 0 : 1)
                    }
                    onChange={(e) =>
                      setManualH(e.target.value)
                    }
                    className="w-full mt-1 px-3 py-2 rounded-lg border border-border text-sm bg-background"
                    placeholder="Correct if needed"
                  />
                </div>
              </div>
            )}

            <div className="flex flex-wrap items-center gap-2 pt-2">
              <button
                onClick={saveScrap}
                disabled={!canSave}
                className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-primary text-primary-foreground font-semibold disabled:opacity-40"
              >
                <Save className="w-4 h-4" />
                Save as piece
              </button>

              <button
                onClick={redoPoints}
                className="flex items-center gap-2 px-4 py-2.5 rounded-lg border border-border text-muted-foreground hover:bg-background"
              >
                <RefreshCw className="w-4 h-4" />
                Redo points
              </button>

              <button
                onClick={startOver}
                className="px-4 py-2.5 rounded-lg border border-border text-muted-foreground hover:bg-background"
              >
                Start over
              </button>
            </div>

            <p className="text-xs text-muted-foreground">
              Saving adds the scrap to your cut list on the Dashboard.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
