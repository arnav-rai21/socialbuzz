import React, { useCallback, useEffect, useRef, useState } from 'react';
import type { FontSettings, ImageSlot, TemplateConfig, TextSlot, UserProfile } from '../types';
import { DEFAULT_FONT_SETTINGS } from '../types';

interface CanvasPreviewProps {
  templateConfig:       TemplateConfig;
  userCroppedDataUrl:   string;
  profile:              UserProfile;
  isMappingMode:        boolean;
  isTextMappingMode?:   boolean;
  showSlotIndicators?:  boolean;
  fontSettings?:        FontSettings;
  onSlotChange:         (slot: ImageSlot) => void;
  onTextSlotChange?:    (slot: TextSlot) => void;
  onCanvasDataUrl:      (dataUrl: string) => void;
}

function clampSlot(slot: ImageSlot, canvasW: number, canvasH: number): ImageSlot {
  const MIN = 60;
  let { x, y, width, height, radius } = slot;
  width = Math.max(MIN, width);
  height = Math.max(MIN, height);
  x = Math.max(0, Math.min(x, canvasW - MIN));
  y = Math.max(0, Math.min(y, canvasH - MIN));
  width = Math.min(width, canvasW - x);
  height = Math.min(height, canvasH - y);
  radius = Math.max(0, Math.min(radius, width / 2, height / 2));
  return {
    x: Math.round(x),
    y: Math.round(y),
    width: Math.round(width),
    height: Math.round(height),
    radius: Math.round(radius),
  };
}

function drawRoundedRectPath(ctx: CanvasRenderingContext2D, slot: ImageSlot) {
  const r = Math.max(0, Math.min(slot.radius ?? 0, slot.width / 2, slot.height / 2));
  ctx.beginPath();
  ctx.moveTo(slot.x + r, slot.y);
  ctx.lineTo(slot.x + slot.width - r, slot.y);
  ctx.quadraticCurveTo(slot.x + slot.width, slot.y, slot.x + slot.width, slot.y + r);
  ctx.lineTo(slot.x + slot.width, slot.y + slot.height - r);
  ctx.quadraticCurveTo(slot.x + slot.width, slot.y + slot.height, slot.x + slot.width - r, slot.y + slot.height);
  ctx.lineTo(slot.x + r, slot.y + slot.height);
  ctx.quadraticCurveTo(slot.x, slot.y + slot.height, slot.x, slot.y + slot.height - r);
  ctx.lineTo(slot.x, slot.y + r);
  ctx.quadraticCurveTo(slot.x, slot.y, slot.x + r, slot.y);
  ctx.closePath();
}

function drawCoverImage(ctx: CanvasRenderingContext2D, img: HTMLImageElement, slot: ImageSlot) {
  const ir = img.width / img.height;
  const sr = slot.width / slot.height;
  let sx = 0, sy = 0, sw = img.width, sh = img.height;
  if (ir > sr) {
    sw = img.height * sr;
    sx = (img.width - sw) / 2;
  } else {
    sh = img.width / sr;
    sy = (img.height - sh) / 2;
  }
  ctx.save();
  drawRoundedRectPath(ctx, slot);
  ctx.clip();
  ctx.drawImage(img, sx, sy, sw, sh, slot.x, slot.y, slot.width, slot.height);
  ctx.restore();
}

function drawProfileText(
  ctx: CanvasRenderingContext2D,
  profile: UserProfile,
  slot: ImageSlot,
  canvasH: number,
  fontSettings: FontSettings,
  textSlot?: TextSlot
) {
  const rawName  = profile.name.trim();
  const hasName  = Boolean(rawName);
  const hasTitle = Boolean(profile.title.trim());
  const hasCo    = Boolean(profile.company.trim());
  if (!hasName && !hasTitle && !hasCo) return;

  const nameCase     = fontSettings.nameCase || 'upper';
  const displayName  = nameCase === 'upper' ? rawName.toUpperCase() : rawName;

  const baseNameSize = Math.max(28, Math.min(slot.width * 0.065, 72));
  const baseSubSize  = Math.max(20, Math.min(slot.width * 0.042, 48));
  const nameSize     = baseNameSize * (fontSettings.nameSizeScale || 1);
  const subSize      = baseSubSize  * (fontSettings.subSizeScale  || 1);
  const lineGap      = nameSize * 0.28;
  const subLineGap   = subSize  * 0.22;
  const gap          = Math.max(20, slot.height * 0.06);

  // Inner padding (canvas pixels) so text never touches the slot edge
  const PAD = textSlot ? Math.round(Math.min(textSlot.width, textSlot.height) * 0.08) : 0;

  // If a text slot is defined by the admin, use it; otherwise fall back to auto-position below the image slot.
  const cx           = textSlot ? textSlot.x + textSlot.width / 2 : slot.x + slot.width / 2;
  const maxTextWidth = textSlot ? textSlot.width - PAD * 2         : slot.width * 1.1;
  const fontFamily   = fontSettings.fontFamily || 'Inter, Arial, sans-serif';

  // Hard bottom boundary — clamp to text slot height when defined (leave bottom padding too).
  const maxY = textSlot ? textSlot.y + textSlot.height - PAD : canvasH;

  ctx.save();
  ctx.textAlign    = 'center';
  ctx.textBaseline = 'top';

  // Hard-clip to text slot so nothing can physically overflow the mapped area.
  if (textSlot) {
    ctx.beginPath();
    ctx.rect(textSlot.x, textSlot.y, textSlot.width, textSlot.height);
    ctx.clip();
  }

  // Always word-wrap — returns total height consumed by all wrapped lines.
  function drawText(text: string, x: number, y: number, fontSize: number, bold: boolean, color: string): number {
    ctx.font = `${bold ? '800' : '600'} ${fontSize}px ${fontFamily}`;
    const lineH = fontSize * 1.28;
    const lines = wrapTextLines(ctx, text, maxTextWidth);
    for (const ln of lines) {
      if (fontSettings.strokeEnabled) {
        ctx.strokeStyle = 'rgba(0,0,0,0.55)';
        ctx.lineWidth   = fontSize * 0.28;
        ctx.lineJoin    = 'round';
        ctx.strokeText(ln, x, y, maxTextWidth);
      }
      ctx.fillStyle = color;
      ctx.fillText(ln, x, y, maxTextWidth);
      y += lineH;
    }
    return lines.length * lineH;
  }

  let curY = textSlot ? textSlot.y + PAD : slot.y + slot.height + gap;

  if (hasName && curY + nameSize <= maxY) {
    const h = drawText(displayName, cx, curY, nameSize, true, fontSettings.nameColor || '#ffffff');
    curY += h + lineGap;
  }

  if (hasTitle && curY + subSize <= maxY) {
    const h = drawText(profile.title.trim(), cx, curY, subSize, false, fontSettings.subColor || '#ffffff');
    curY += h + subLineGap;
  }

  if (hasCo && curY + subSize <= maxY) {
    drawText(profile.company.trim(), cx, curY, subSize, false, fontSettings.subColor || '#ffffff');
  }

  ctx.restore();
}

function wrapTextLines(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let line = '';
  for (const word of words) {
    const test = line ? line + ' ' + word : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  return lines.length ? lines : [text];
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous'; // required for canvas.toDataURL() with Vercel Blob CDN URLs
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

export default function CanvasPreview({
  templateConfig,
  userCroppedDataUrl,
  profile,
  isMappingMode,
  isTextMappingMode = false,
  showSlotIndicators = false,
  fontSettings,
  onSlotChange,
  onTextSlotChange,
  onCanvasDataUrl,
}: CanvasPreviewProps) {
  const resolvedFont = fontSettings || templateConfig.fontSettings || DEFAULT_FONT_SETTINGS;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stageRef  = useRef<HTMLDivElement>(null);

  const templateImgRef = useRef<HTMLImageElement | null>(null);
  const userImgRef     = useRef<HTMLImageElement | null>(null);

  const [boxStyle,  setBoxStyle]  = useState<React.CSSProperties>({});
  const [tagText,   setTagText]   = useState('');
  const [dimText,   setDimText]   = useState('');
  const [scale,     setScale]     = useState({ sx: 0, sy: 0 });
  // click-to-select state: step 0 = waiting first corner, step 1 = waiting second corner
  const [clickStep, setClickStep] = useState<0 | 1>(0);
  const [startPt,   setStartPt]   = useState<{ cx: number; cy: number } | null>(null);
  const [hoverPt,   setHoverPt]   = useState<{ px: number; py: number } | null>(null);

  // ── Render canvas ──────────────────────────────────────────────────────────
  const renderCanvas = useCallback(async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const templateSrc = templateConfig.templateDataUrl;
    const slot = templateConfig.imageSlot;

    if (!templateSrc) {
      canvas.width  = 1200;
      canvas.height = 630;
      ctx.fillStyle = '#f1f5f9';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle  = '#94a3b8';
      ctx.textAlign  = 'center';
      ctx.font = '600 28px Inter, sans-serif';
      ctx.fillText('Upload and save a template to begin', canvas.width / 2, canvas.height / 2);
      onCanvasDataUrl('');
      return;
    }

    // Load/reuse template image
    if (!templateImgRef.current || templateImgRef.current.src !== templateSrc) {
      try {
        templateImgRef.current = await loadImage(templateSrc);
      } catch { return; }
    }

    const tImg = templateImgRef.current;
    canvas.width  = tImg.width;
    canvas.height = tImg.height;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(tImg, 0, 0);

    // Draw user photo or dashed placeholder
    if (userCroppedDataUrl) {
      if (!userImgRef.current || userImgRef.current.src !== userCroppedDataUrl) {
        try { userImgRef.current = await loadImage(userCroppedDataUrl); }
        catch { userImgRef.current = null; }
      }
      if (userImgRef.current) drawCoverImage(ctx, userImgRef.current, slot);
    } else {
      ctx.save();
      ctx.fillStyle   = 'rgba(96,165,250,0.14)';
      ctx.strokeStyle = 'rgba(37,99,235,0.90)';
      ctx.lineWidth   = 6;
      ctx.setLineDash([18, 10]);
      drawRoundedRectPath(ctx, slot);
      ctx.fill();
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = 'rgba(15,23,42,0.72)';
      ctx.font = '700 26px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('Your photo goes here', slot.x + slot.width / 2, slot.y + slot.height / 2);
      ctx.restore();
    }

    // In text-mapping mode show demo text so admin can see placement live
    const renderProfile = isTextMappingMode ? {
      name:    profile.name.trim()    || 'Sachitanand Rai',
      title:   profile.title.trim()   || 'Product Manager',
      company: profile.company.trim() || 'Times Internet',
      email:   profile.email || '',
    } : profile;

    drawProfileText(ctx, renderProfile, slot, canvas.height, resolvedFont, templateConfig.textSlot);

    try { onCanvasDataUrl(canvas.toDataURL('image/png')); } catch (_) {}

    syncOverlay();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [templateConfig, userCroppedDataUrl, profile, isTextMappingMode, fontSettings]);

  // ── Sync overlay ───────────────────────────────────────────────────────────
  const syncOverlay = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !canvas.width || !canvas.height) return;
    const r  = canvas.getBoundingClientRect();
    const sx = r.width  / canvas.width;
    const sy = r.height / canvas.height;
    const slot = templateConfig.imageSlot;
    setScale({ sx, sy });
    setBoxStyle({
      left:         slot.x * sx,
      top:          slot.y * sy,
      width:        slot.width  * sx,
      height:       slot.height * sy,
      borderRadius: slot.radius * Math.min(sx, sy),
    });
    setTagText(`Photo Slot · ${Math.round(slot.x)}, ${Math.round(slot.y)}`);
    setDimText(`${Math.round(slot.width)} × ${Math.round(slot.height)}`);
  }, [templateConfig.imageSlot]);

  useEffect(() => { renderCanvas(); }, [renderCanvas]);

  useEffect(() => {
    const handler = () => syncOverlay();
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, [syncOverlay]);

  useEffect(() => { syncOverlay(); }, [syncOverlay, isMappingMode]);

  // Reset click state whenever mapping mode toggles
  useEffect(() => {
    setClickStep(0);
    setStartPt(null);
    setHoverPt(null);
  }, [isMappingMode, isTextMappingMode]);

  // ── Click-to-select handlers ───────────────────────────────────────────────
  function onOverlayClick(e: React.MouseEvent<HTMLDivElement>) {
    const canvas = canvasRef.current;
    if (!canvas?.width) return;
    // Compute click position in overlay (CSS) coords, then canvas coords
    const overlayRect = e.currentTarget.getBoundingClientRect();
    const px = e.clientX - overlayRect.left;
    const py = e.clientY - overlayRect.top;
    const cx = px * (canvas.width  / overlayRect.width);
    const cy = py * (canvas.height / overlayRect.height);

    if (clickStep === 0) {
      setStartPt({ cx, cy });
      setClickStep(1);
      setHoverPt({ px, py });
    } else if (startPt) {
      const x = Math.min(startPt.cx, cx);
      const y = Math.min(startPt.cy, cy);
      const w = Math.abs(cx - startPt.cx);
      const h = Math.abs(cy - startPt.cy);
      // Ignore accidental double-clicks on the same spot
      if (w < 30 || h < 30) {
        setClickStep(0); setStartPt(null); setHoverPt(null);
        return;
      }
      const clamped = clampSlot({ x, y, width: w, height: h, radius: 0 }, canvas.width, canvas.height);
      if (isMappingMode) {
        onSlotChange({ ...clamped, radius: templateConfig.imageSlot.radius });
      } else {
        onTextSlotChange?.({ x: clamped.x, y: clamped.y, width: clamped.width, height: clamped.height });
      }
      setClickStep(0); setStartPt(null); setHoverPt(null);
    }
  }

  function onOverlayMouseMove(e: React.MouseEvent<HTMLDivElement>) {
    if (clickStep !== 1) return;
    const rect = e.currentTarget.getBoundingClientRect();
    setHoverPt({ px: e.clientX - rect.left, py: e.clientY - rect.top });
  }

  const hasTemplate = Boolean(templateConfig.templateDataUrl);
  const showOverlay = (isMappingMode || isTextMappingMode) && hasTemplate;

  // Rubber band geometry — computed from scale state + hoverPt
  let rubber: { left: number; top: number; width: number; height: number } | null = null;
  if (clickStep === 1 && startPt && hoverPt && scale.sx > 0) {
    const x0 = startPt.cx * scale.sx;
    const y0 = startPt.cy * scale.sy;
    const rw = Math.abs(hoverPt.px - x0);
    const rh = Math.abs(hoverPt.py - y0);
    if (rw > 2 || rh > 2) {
      rubber = { left: Math.min(x0, hoverPt.px), top: Math.min(y0, hoverPt.py), width: rw, height: rh };
    }
  }

  // Dot marker at first click
  const dotLeft = startPt && scale.sx > 0 ? startPt.cx * scale.sx : 0;
  const dotTop  = startPt && scale.sy > 0 ? startPt.cy * scale.sy : 0;

  // Confirmed text-slot box geometry
  const ts = templateConfig.textSlot;
  const tbOk = ts && scale.sx > 0;
  const tbLeft = tbOk ? ts!.x * scale.sx : 0;
  const tbTop  = tbOk ? ts!.y * scale.sy : 0;
  const tbW    = tbOk ? ts!.width  * scale.sx : 0;
  const tbH    = tbOk ? ts!.height * scale.sy : 0;

  const dotColor  = isMappingMode ? '#2563eb' : '#059669';
  const bandColor = isMappingMode ? 'rgba(59,130,246,0.9)' : 'rgba(5,150,105,0.9)';
  const bandBg    = isMappingMode ? 'rgba(96,165,250,0.12)' : 'rgba(16,185,129,0.12)';

  return (
    <div
      ref={stageRef}
      className={['relative rounded-[22px] overflow-hidden', showOverlay ? 'canvas-stage-mapping' : ''].join(' ')}
    >
      <canvas ref={canvasRef} className="block rounded-[22px] bg-slate-50"
        style={{ maxWidth: '100%', maxHeight: 'calc(100vh - 200px)', width: 'auto', height: 'auto' }} />

      {showOverlay && (
        <div
          className="absolute inset-0 z-10"
          style={{ cursor: 'crosshair', pointerEvents: 'auto' }}
          onClick={onOverlayClick}
          onMouseMove={onOverlayMouseMove}
          onMouseLeave={() => { if (clickStep === 1) setHoverPt(null); }}
        >
          {/* Instruction label */}
          <div style={{ position:'absolute', top:12, left:12, padding:'6px 14px', borderRadius:999, background:'rgba(15,23,42,0.88)', color:'#fff', fontSize:12, fontWeight:700, pointerEvents:'none', userSelect:'none', whiteSpace:'nowrap', zIndex:30 }}>
            {clickStep === 0
              ? `Click first corner of ${isMappingMode ? 'photo slot' : 'text area'}`
              : 'Click opposite corner to confirm'}
          </div>

          {/* First-click dot */}
          {clickStep === 1 && startPt && (
            <div style={{ position:'absolute', left:dotLeft-6, top:dotTop-6, width:12, height:12, borderRadius:999, background:dotColor, border:'3px solid #fff', boxShadow:'0 0 0 2px rgba(0,0,0,0.3)', pointerEvents:'none', zIndex:20 }} />
          )}

          {/* Rubber band preview */}
          {rubber && (
            <div style={{ position:'absolute', ...rubber, border:`2px dashed ${bandColor}`, background:bandBg, pointerEvents:'none', zIndex:15 }} />
          )}

          {/* Confirmed photo-slot box (step 0, photo mode) */}
          {clickStep === 0 && isMappingMode && tagText && (
            <div style={{ position:'absolute', ...boxStyle, border:'3px solid rgba(255,255,255,0.98)', outline:'3px solid rgba(29,78,216,0.95)', background:'linear-gradient(135deg,rgba(96,165,250,0.18),rgba(236,72,153,0.16))', pointerEvents:'none', userSelect:'none' }}>
              <div style={{ position:'absolute', top:10, left:10, padding:'5px 10px', borderRadius:999, background:'rgba(15,23,42,0.86)', color:'#fff', fontSize:11, fontWeight:800, letterSpacing:'0.02em', whiteSpace:'nowrap' }}>{tagText}</div>
              <div style={{ position:'absolute', bottom:10, right:10, padding:'4px 10px', borderRadius:999, background:'rgba(15,23,42,0.86)', color:'#60a5fa', fontSize:11, fontWeight:800, letterSpacing:'0.04em', whiteSpace:'nowrap', fontVariantNumeric:'tabular-nums' }}>{dimText}</div>
            </div>
          )}

          {/* Confirmed text-area box — visible in any mapping mode at step 0 */}
          {clickStep === 0 && tbOk && tbW > 0 && (
            <div style={{ position:'absolute', left:tbLeft, top:tbTop, width:tbW, height:tbH, border:'3px solid rgba(255,255,255,0.98)', outline:'3px solid rgba(5,150,105,0.95)', background:'rgba(16,185,129,0.12)', pointerEvents:'none', userSelect:'none' }}>
              <div style={{ position:'absolute', top:10, left:10, padding:'5px 10px', borderRadius:999, background:'rgba(5,46,22,0.86)', color:'#fff', fontSize:11, fontWeight:800, letterSpacing:'0.02em', whiteSpace:'nowrap' }}>
                Text Area · {Math.round(ts!.x)}, {Math.round(ts!.y)}
              </div>
              <div style={{ position:'absolute', bottom:10, right:10, padding:'4px 10px', borderRadius:999, background:'rgba(5,46,22,0.86)', color:'#6ee7b7', fontSize:11, fontWeight:800, letterSpacing:'0.04em', whiteSpace:'nowrap', fontVariantNumeric:'tabular-nums' }}>
                {Math.round(ts!.width)} × {Math.round(ts!.height)}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Persistent slot indicators — shown when admin is active but no mapping mode is on */}
      {showSlotIndicators && !showOverlay && hasTemplate && scale.sx > 0 && (
        <>
          {/* Photo slot outline */}
          <div style={{ position:'absolute', ...boxStyle, border:'2px solid rgba(59,130,246,0.55)', background:'rgba(96,165,250,0.07)', pointerEvents:'none', userSelect:'none' }}>
            <div style={{ position:'absolute', top:6, left:6, padding:'3px 8px', borderRadius:999, background:'rgba(15,23,42,0.72)', color:'#93c5fd', fontSize:10, fontWeight:700, whiteSpace:'nowrap' }}>
              Photo · {Math.round(templateConfig.imageSlot.width)}×{Math.round(templateConfig.imageSlot.height)}
            </div>
          </div>
          {/* Text slot outline */}
          {tbOk && tbW > 0 && (
            <div style={{ position:'absolute', left:tbLeft, top:tbTop, width:tbW, height:tbH, border:'2px solid rgba(5,150,105,0.55)', background:'rgba(16,185,129,0.07)', pointerEvents:'none', userSelect:'none' }}>
              <div style={{ position:'absolute', top:6, left:6, padding:'3px 8px', borderRadius:999, background:'rgba(5,46,22,0.72)', color:'#6ee7b7', fontSize:10, fontWeight:700, whiteSpace:'nowrap' }}>
                Text · {Math.round(ts!.width)}×{Math.round(ts!.height)}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
