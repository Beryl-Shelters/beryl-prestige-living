"use client";

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";

export type SignatureCanvasHandle = {
  getBlob: () => Promise<Blob | null>;
  clear: () => void;
  hasDrawn: () => boolean;
  hasExisting: () => boolean;
};

type SignatureCanvasProps = {
  initialSignatureUrl?: string | null;
  onSignatureChange?: (hasValidSignature: boolean) => void;
  disabled?: boolean;
};

export const SignatureCanvas = forwardRef<SignatureCanvasHandle, SignatureCanvasProps>(
  function SignatureCanvas(
    { initialSignatureUrl, onSignatureChange, disabled = false },
    ref
  ) {
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const containerRef = useRef<HTMLDivElement | null>(null);
    const isDrawingRef = useRef(false);
    const [pointCount, setPointCount] = useState(0);
    const pointCountRef = useRef(0);
    const [hasExisting, setHasExisting] = useState(Boolean(initialSignatureUrl));

    const syncSignatureState = useCallback(
      (points: number, existing: boolean) => {
        const valid = existing || points >= 5;
        onSignatureChange?.(valid);
      },
      [onSignatureChange]
    );

    const setupCanvas = useCallback(() => {
      const canvas = canvasRef.current;
      const container = containerRef.current;
      if (!canvas || !container) return;

      const rect = container.getBoundingClientRect();
      if (rect.width === 0) return;

      const dpr = window.devicePixelRatio || 1;
      const displayWidth = Math.floor(rect.width);
      const displayHeight = 150;

      // Preserve the bitmap when the responsive layout or device pixel ratio changes.
      if (canvas.width !== displayWidth * dpr || canvas.height !== displayHeight * dpr) {
        const previous = document.createElement("canvas");
        previous.width = canvas.width;
        previous.height = canvas.height;
        previous.getContext("2d")?.drawImage(canvas, 0, 0);
        canvas.width = displayWidth * dpr;
        canvas.height = displayHeight * dpr;
        canvas.style.width = `${displayWidth}px`;
        canvas.style.height = `${displayHeight}px`;

        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.scale(dpr, dpr);
          ctx.lineCap = "round";
          ctx.lineJoin = "round";
          ctx.lineWidth = 2.5;
          ctx.strokeStyle = "#1b1b1b";
          if (pointCountRef.current > 0) {
            ctx.drawImage(previous, 0, 0, previous.width, previous.height, 0, 0, displayWidth, displayHeight);
          }
        }
      }
    }, []);

    useEffect(() => {
      setupCanvas();
      const onResize = () => setupCanvas();
      window.addEventListener("resize", onResize);
      return () => window.removeEventListener("resize", onResize);
    }, [setupCanvas]);

    useEffect(() => {
      if (initialSignatureUrl) {
        setHasExisting(true);
        syncSignatureState(0, true);
      }
    }, [initialSignatureUrl, syncSignatureState]);

    const clearCanvas = useCallback(() => {
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          // Reset stroke properties after clear
          const dpr = window.devicePixelRatio || 1;
          ctx.setTransform(1, 0, 0, 1, 0, 0);
          ctx.scale(dpr, dpr);
          ctx.lineCap = "round";
          ctx.lineJoin = "round";
          ctx.lineWidth = 2.5;
          ctx.strokeStyle = "#1b1b1b";
        }
      }
      pointCountRef.current = 0;
      setPointCount(0);
      setHasExisting(false);
      syncSignatureState(0, false);
    }, [syncSignatureState]);

    useImperativeHandle(
      ref,
      () => ({
        getBlob: () => {
          return new Promise<Blob | null>((resolve) => {
            const canvas = canvasRef.current;
            if (!canvas || pointCountRef.current < 5) {
              resolve(null);
              return;
            }
            canvas.toBlob((blob) => {
              resolve(blob);
            }, "image/png");
          });
        },
        clear: clearCanvas,
        hasDrawn: () => pointCountRef.current >= 5,
        hasExisting: () => hasExisting,
      }),
      [clearCanvas, hasExisting]
    );

    function handlePointerDown(e: ReactPointerEvent<HTMLCanvasElement>) {
      if (disabled || isDrawingRef.current) return;
      const canvas = canvasRef.current;
      if (!canvas) return;

      if ("setPointerCapture" in e.currentTarget && "pointerId" in e) {
        try {
          e.currentTarget.setPointerCapture(e.pointerId);
        } catch {
          /* ignore synthetic or unsupported pointer capture */
        }
      }
      isDrawingRef.current = true;

      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.beginPath();
        ctx.moveTo(x, y);
      }

      pointCountRef.current += 1;
      setPointCount((p) => p + 1);
    }

    function handlePointerMove(e: ReactPointerEvent<HTMLCanvasElement>) {
      if (!isDrawingRef.current || disabled) return;
      const canvas = canvasRef.current;
      if (!canvas) return;

      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.lineTo(x, y);
        ctx.stroke();
      }

      pointCountRef.current += 1;
      const nextPoints = pointCountRef.current;
      setPointCount(nextPoints);
      if (nextPoints >= 5) {
        syncSignatureState(nextPoints, false);
      }
    }

    function handlePointerUp(
      e: ReactPointerEvent<HTMLCanvasElement> | React.MouseEvent<HTMLCanvasElement>
    ) {
      if (!isDrawingRef.current) return;
      isDrawingRef.current = false;
      const canvas = canvasRef.current;
      if (canvas && "hasPointerCapture" in canvas && "pointerId" in e) {
        try {
          if (canvas.hasPointerCapture(e.pointerId)) {
            canvas.releasePointerCapture(e.pointerId);
          }
        } catch {
          /* ignore */
        }
      }
      syncSignatureState(pointCountRef.current, false);
    }

    function handlePointerCancel(e: ReactPointerEvent<HTMLCanvasElement>) {
      if (!isDrawingRef.current) return;
      isDrawingRef.current = false;
      const canvas = canvasRef.current;
      if (canvas) {
        try {
          if (canvas.hasPointerCapture(e.pointerId)) {
            canvas.releasePointerCapture(e.pointerId);
          }
        } catch {
          /* ignore */
        }
      }
      syncSignatureState(pointCountRef.current, false);
    }

    return (
      <div className="signature-canvas-container" ref={containerRef}>
        <div className="signature-canvas-header">
          <span className="signature-canvas-title">
            SIGNATURE OF VENDOR/SELLER/CLIENT <b>*</b>
          </span>
          <button
            type="button"
            className="signature-reset-btn"
            onClick={clearCanvas}
            disabled={disabled || (!hasExisting && pointCount === 0)}
            aria-label="Reset signature"
          >
            Reset
          </button>
        </div>

        {hasExisting && initialSignatureUrl ? (
          <div className="signature-existing-preview">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={initialSignatureUrl}
              alt="Saved signature"
              className="signature-preview-img"
            />
            <div className="signature-existing-overlay">
              <span className="signature-existing-tag">Saved Signature On File</span>
              <button
                type="button"
                className="button button-secondary signature-change-btn"
                onClick={clearCanvas}
                disabled={disabled}
              >
                Clear & Re-sign
              </button>
            </div>
          </div>
        ) : (
          <div className="signature-canvas-wrapper">
            <canvas
              ref={canvasRef}
              className="signature-canvas"
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerCancel={handlePointerCancel}
              tabIndex={0}
              role="img"
              aria-label="Draw your signature with mouse, stylus or touch"
            />
            {pointCount === 0 && (
              <div className="signature-placeholder-hint" aria-hidden="true">
                Sign here using mouse, finger or stylus
              </div>
            )}
          </div>
        )}
      </div>
    );
  }
);
