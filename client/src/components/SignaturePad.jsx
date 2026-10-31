import React, { useRef, useState, useEffect } from 'react';
import { Eraser, Check } from 'lucide-react';

export default function SignaturePad({ onSave, onCancel }) {
  const canvasRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasDrawn, setHasDrawn] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#0f1b2d';
  }, []);

  function getCoordinates(e) {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    if (e.touches && e.touches[0]) {
      return {
        x: e.touches[0].clientX - rect.left,
        y: e.touches[0].clientY - rect.top,
      };
    }
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  }

  function startDrawing(e) {
    e.preventDefault();
    setIsDrawing(true);
    setHasDrawn(true);
    const { x, y } = getCoordinates(e);
    const ctx = canvasRef.current.getContext('2d');
    ctx.beginPath();
    ctx.moveTo(x, y);
  }

  function draw(e) {
    if (!isDrawing) return;
    e.preventDefault();
    const { x, y } = getCoordinates(e);
    const ctx = canvasRef.current.getContext('2d');
    ctx.lineTo(x, y);
    ctx.stroke();
  }

  function stopDrawing(e) {
    if (isDrawing) {
      e.preventDefault();
      setIsDrawing(false);
    }
  }

  function clear() {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasDrawn(false);
  }

  function confirmSignature() {
    if (!hasDrawn) return;
    const canvas = canvasRef.current;
    const dataUrl = canvas.toDataURL('image/png');
    onSave(dataUrl);
  }

  return (
    <div className="signature-pad-container">
      <div className="signature-pad-hint">
        <span>Sign above using finger, stylus, or mouse to accept the rooftop installation.</span>
      </div>
      <canvas
        ref={canvasRef}
        width={500}
        height={180}
        className="signature-canvas"
        onMouseDown={startDrawing}
        onMouseMove={draw}
        onMouseUp={stopDrawing}
        onMouseLeave={stopDrawing}
        onTouchStart={startDrawing}
        onTouchMove={draw}
        onTouchEnd={stopDrawing}
      />
      <div className="signature-actions">
        <button type="button" className="button outline small-button" onClick={clear}>
          <Eraser size={15} /> Clear
        </button>
        {onCancel && (
          <button type="button" className="button outline small-button" onClick={onCancel}>
            Cancel
          </button>
        )}
        <button
          type="button"
          className="button primary small-button"
          onClick={confirmSignature}
          disabled={!hasDrawn}
        >
          <Check size={15} /> Confirm Signature
        </button>
      </div>
    </div>
  );
}

