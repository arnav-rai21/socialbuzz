import React, { useCallback, useEffect, useRef, useState } from 'react';
import type { FontSettings, ImageSlot, TemplateConfig, TextSlot, UserProfile } from '../types';
import { DEFAULT_FONT_SETTINGS } from '../types';

interface CanvasPreviewProps {
  templateConfig:       TemplateConfig;
  imageSlotSet?:        boolean;          // false = photo area not drawn yet (blank)
  userCroppedDataUrl:   string;
  profile:              UserProfile;
  isMappingMode:        boolean;
  isTextMappingMode?:   boolean;
  showSlotIndicators?:  boolean;
  fontSettings?:        FontSettings;
  onSlotChange:         (slot: ImageSlot) => void;
  onClearPhotoSlot?:    () => void;
  onTextSlotChange?:    (slot: TextSlot | undefined) => void;
  onCanvasDataUrl:      (dataUrl: string) => void;
}

type Rect   = { x: number; y: number; width: number; height: number };
type Corner = 'nw' | 'ne' | 'sw' | 'se';
type Drag   = { kind: 'draw' | 'move' | 'resize'; handle?: Corner; startCx: number; startCy: number; orig: Rect } | null;

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
  return { x: Math.round(x), y: Math.round(y), width: Math.round(width), height: Math.round(height), radius: Math.round(radius) };
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
  if (ir > sr) { sw = img.height * sr; sx = (img.width - sw) / 2; }
  else         { sh = img.width / sr;  sy = (img.height - sh) / 2; }
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

  const PAD = textSlot ? Math.round(Math.min(textSlot.width, textSlot.height) * 0.08) : 0;
  const cx           = textSlot ? textSlot.x + textSlot.width / 2 : slot.x + slot.width / 2;
  const maxTextWidth = textSlot ? textSlot.width - PAD * 2         : slot.width * 1.1;
  const fontFamily   = fontSettings.fontFamily || 'Inter, Arial, sans-serif';
  const maxY         = textSlot ? textSlot.y + textSlot.height - PAD : canvasH;

  ctx.save();
  ctx.textAlign    = 'center';
  ctx.textBaseline = 'top';
  if (textSlot) {
    ctx.beginPath();
    ctx.rect(textSlot.x, textSlot.y, textSlot.width, textSlot.height);
    ctx.clip();
  }

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
    if (ctx.measureText(test).width > maxWidth && line) { lines.push(line); line = word; }
    else line = test;
  }
  if (line) lines.push(line);
  return lines.length ? lines : [text];
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

export default function CanvasPreview({
  templateConfig,
  imageSlotSet,
  userCroppedDataUrl,
  profile,
  isMappingMode,
  isTextMappingMode = false,
  showSlotIndicators = false,
  fontSettings,
  onSlotChange,
  onClearPhotoSlot,
  onTextSlotChange,
  onCanvasDataUrl,
}: CanvasPreviewProps) {
  const resolvedFont = fontSettings || templateConfig.fontSettings || DEFAULT_FONT_SETTINGS;
  const canvasRef  = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);

  const templateImgRef = useRef<HTMLImageElement | null>(null);
  const userImgRef     = useRef<HTMLImageElement | null>(null);

  const [scale,    setScale]    = useState({ sx: 0, sy: 0 });
  const [drag,     setDrag]     = useState<Drag>(null);
  const [liveRect, setLiveRect] = useState<Rect | null>(null);  // live geometry during a drag
  const [selected, setSelected] = useState(false);
  const liveRectRef = useRef<Rect | null>(null);                // latest liveRect for the pointerup handler

  const photoMode  = isMappingMode;
  const photoBlank = imageSlotSet === false;
  const imageSlot  = templateConfig.imageSlot;
  const textSlot   = templateConfig.textSlot;

  // ── Render canvas ──────────────────────────────────────────────────────────
  const renderCanvas = useCallback(async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const templateSrc = templateConfig.templateDataUrl;
    const slot = templateConfig.imageSlot;
    const blank = imageSlotSet === false;

    if (!templateSrc) {
      canvas.width = 1200; canvas.height = 630;
      ctx.fillStyle = '#f1f5f9'; ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = '#94a3b8'; ctx.textAlign = 'center';
      ctx.font = '600 28px Inter, sans-serif';
      ctx.fillText('Upload and save a template to begin', canvas.width / 2, canvas.height / 2);
      onCanvasDataUrl('');
      return;
    }

    if (!templateImgRef.current || templateImgRef.current.src !== templateSrc) {
      try { templateImgRef.current = await loadImage(templateSrc); } catch { return; }
    }

    const tImg = templateImgRef.current;
    canvas.width = tImg.width; canvas.height = tImg.height;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(tImg, 0, 0);

    // Photo slot: when blank (fresh template, not yet drawn) render nothing here.
    if (!blank) {
      if (userCroppedDataUrl) {
        if (!userImgRef.current || userImgRef.current.src !== userCroppedDataUrl) {
          try { userImgRef.current = await loadImage(userCroppedDataUrl); } catch { userImgRef.current = null; }
        }
        if (userImgRef.current) drawCoverImage(ctx, userImgRef.current, slot);
      } else {
        ctx.save();
        ctx.fillStyle   = 'rgba(96,165,250,0.14)';
        ctx.strokeStyle = 'rgba(37,99,235,0.90)';
        ctx.lineWidth   = 6;
        ctx.setLineDash([18, 10]);
        drawRoundedRectPath(ctx, slot);
        ctx.fill(); ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = 'rgba(15,23,42,0.72)';
        ctx.font = '700 26px Inter, sans-serif';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText('Your photo goes here', slot.x + slot.width / 2, slot.y + slot.height / 2);
        ctx.restore();
      }
    }

    const renderProfile = isTextMappingMode ? {
      name:    profile.name.trim()    || 'Sachitanand Rai',
      title:   profile.title.trim()   || 'Product Manager',
      company: profile.company.trim() || 'Times Internet',
      email:   profile.email || '',
    } : profile;

    drawProfileText(ctx, renderProfile, slot, canvas.height, resolvedFont, templateConfig.textSlot);

    try {
      const MAX_W = 1200;
      if (canvas.width > MAX_W) {
        const s = MAX_W / canvas.width;
        const tmp = document.createElement('canvas');
        tmp.width = MAX_W; tmp.height = Math.round(canvas.height * s);
        const tmpCtx = tmp.getContext('2d');
        if (tmpCtx) tmpCtx.drawImage(canvas, 0, 0, tmp.width, tmp.height);
        onCanvasDataUrl(tmp.toDataURL('image/jpeg', 0.82));
      } else {
        onCanvasDataUrl(canvas.toDataURL('image/jpeg', 0.82));
      }
    } catch (_) {}

    syncOverlay();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [templateConfig, imageSlotSet, userCroppedDataUrl, profile, isTextMappingMode, fontSettings]);

  // ── Sync overlay scale ──────────────────────────────────────────────────────
  const syncOverlay = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !canvas.width || !canvas.height) return;
    const r = canvas.getBoundingClientRect();
    setScale({ sx: r.width / canvas.width, sy: r.height / canvas.height });
  }, []);

  useEffect(() => { renderCanvas(); }, [renderCanvas]);
  useEffect(() => {
    const h = () => syncOverlay();
    window.addEventListener('resize', h);
    return () => window.removeEventListener('resize', h);
  }, [syncOverlay]);
  useEffect(() => { syncOverlay(); }, [syncOverlay, isMappingMode, isTextMappingMode]);

  // Reset selection/drag when the mapping mode changes.
  useEffect(() => { setSelected(false); setDrag(null); setLiveRect(null); }, [isMappingMode, isTextMappingMode]);

  // ── Geometry helpers ────────────────────────────────────────────────────────
  const hasTemplate = Boolean(templateConfig.templateDataUrl);
  const showOverlay = (isMappingMode || isTextMappingMode) && hasTemplate;

  // The slot currently being edited (photo or text), or null when blank/unset.
  const curRect: Rect | null = photoMode
    ? (photoBlank ? null : imageSlot)
    : (textSlot ?? null);

  function evtToCanvas(e: { clientX: number; clientY: number }): { cx: number; cy: number } {
    const canvas = canvasRef.current, ov = overlayRef.current;
    if (!canvas || !ov) return { cx: 0, cy: 0 };
    const rect = ov.getBoundingClientRect();
    return {
      cx: (e.clientX - rect.left) * (canvas.width  / rect.width),
      cy: (e.clientY - rect.top)  * (canvas.height / rect.height),
    };
  }

  function clampRect(r: Rect): Rect {
    const c = clampSlot({ ...r, radius: 0 }, canvasRef.current?.width || 1, canvasRef.current?.height || 1);
    return { x: c.x, y: c.y, width: c.width, height: c.height };
  }

  function commit(r: Rect) {
    if (photoMode) {
      onSlotChange(clampSlot({ ...r, radius: imageSlot.radius }, canvasRef.current?.width || 1, canvasRef.current?.height || 1));
    } else {
      onTextSlotChange?.(clampRect(r));
    }
  }

  function deleteSlot() {
    setSelected(false);
    if (photoMode) onClearPhotoSlot?.();
    else onTextSlotChange?.(undefined);
  }

  // ── Pointer drag (draw / move / resize) ─────────────────────────────────────
  function startDraw(e: React.PointerEvent<HTMLDivElement>) {
    // pointerdown on empty overlay: draw a new box when blank, else deselect.
    if (curRect) { setSelected(false); return; }
    const { cx, cy } = evtToCanvas(e);
    setDrag({ kind: 'draw', startCx: cx, startCy: cy, orig: { x: cx, y: cy, width: 0, height: 0 } });
    setLiveRect({ x: cx, y: cy, width: 0, height: 0 });
  }

  function startMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!curRect) return;
    e.stopPropagation();
    setSelected(true);
    const { cx, cy } = evtToCanvas(e);
    setDrag({ kind: 'move', startCx: cx, startCy: cy, orig: { ...curRect } });
  }

  function startResize(e: React.PointerEvent<HTMLDivElement>, handle: Corner) {
    if (!curRect) return;
    e.stopPropagation();
    setSelected(true);
    const { cx, cy } = evtToCanvas(e);
    setDrag({ kind: 'resize', handle, startCx: cx, startCy: cy, orig: { ...curRect } });
  }

  // Window listeners during an active drag.
  useEffect(() => {
    if (!drag) return;
    function onMove(e: PointerEvent) {
      const { cx, cy } = evtToCanvas(e);
      const o = drag!.orig;
      let r: Rect;
      if (drag!.kind === 'move') {
        r = { x: o.x + (cx - drag!.startCx), y: o.y + (cy - drag!.startCy), width: o.width, height: o.height };
      } else if (drag!.kind === 'resize') {
        // opposite (fixed) corner stays put; new rect spans it to the cursor
        const fx = drag!.handle === 'nw' || drag!.handle === 'sw' ? o.x + o.width : o.x;
        const fy = drag!.handle === 'nw' || drag!.handle === 'ne' ? o.y + o.height : o.y;
        r = { x: Math.min(fx, cx), y: Math.min(fy, cy), width: Math.abs(cx - fx), height: Math.abs(cy - fy) };
      } else { // draw
        r = { x: Math.min(drag!.startCx, cx), y: Math.min(drag!.startCy, cy), width: Math.abs(cx - drag!.startCx), height: Math.abs(cy - drag!.startCy) };
      }
      setLiveRect(r);
    }
    function onUp() {
      const r = liveRectRef.current;
      const kind = drag!.kind;
      setDrag(null);
      setLiveRect(null);
      if (!r) return;
      if (kind === 'draw') {
        if (r.width < 24 || r.height < 24) { setSelected(false); return; } // too small → treat as click
        setSelected(true);
        commit(r);
      } else {
        setSelected(true);
        commit(r);
      }
    }
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    return () => { window.removeEventListener('pointermove', onMove); window.removeEventListener('pointerup', onUp); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drag]);

  useEffect(() => { liveRectRef.current = liveRect; }, [liveRect]);

  // ── Keyboard: nudge / delete the selected box ───────────────────────────────
  useEffect(() => {
    if (!showOverlay || !selected || !curRect) return;
    function onKey(e: KeyboardEvent) {
      const el = document.activeElement;
      if (el && /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName)) return; // don't hijack form fields
      const step = e.shiftKey ? 10 : 1;
      const r = { ...curRect! };
      if (e.key === 'ArrowLeft')      r.x -= step;
      else if (e.key === 'ArrowRight') r.x += step;
      else if (e.key === 'ArrowUp')    r.y -= step;
      else if (e.key === 'ArrowDown')  r.y += step;
      else if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); deleteSlot(); return; }
      else return;
      e.preventDefault();
      commit(r);
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showOverlay, selected, curRect, photoMode]);

  // ── Overlay box geometry (CSS px) — live during drag, else from props (#3) ──
  const dispRect = liveRect ?? curRect;
  const sx = scale.sx, sy = scale.sy;
  const accent     = photoMode ? '29,78,216'  : '5,150,105';
  const accentSoft = photoMode ? '96,165,250' : '16,185,129';
  const radiusPx   = photoMode && dispRect ? (imageSlot.radius || 0) * Math.min(sx, sy) : 0;

  const box = dispRect && sx > 0 ? {
    left: dispRect.x * sx, top: dispRect.y * sy,
    width: dispRect.width * sx, height: dispRect.height * sy,
  } : null;

  const CORNERS: Corner[] = ['nw', 'ne', 'sw', 'se'];
  const cornerPos = (c: Corner) => ({
    left: c === 'nw' || c === 'sw' ? -6 : undefined,
    right: c === 'ne' || c === 'se' ? -6 : undefined,
    top: c === 'nw' || c === 'ne' ? -6 : undefined,
    bottom: c === 'sw' || c === 'se' ? -6 : undefined,
    cursor: c === 'nw' || c === 'se' ? 'nwse-resize' : 'nesw-resize',
  } as React.CSSProperties);

  // Persistent (non-mapping) indicators (read-only outlines when admin active, no mapping mode)
  const showPhotoInd = showSlotIndicators && !showOverlay && hasTemplate && sx > 0 && !photoBlank;
  const tIndOk       = showSlotIndicators && !showOverlay && hasTemplate && sx > 0 && !!textSlot;

  return (
    <div
      className={['relative rounded-[22px] overflow-hidden', showOverlay ? 'canvas-stage-mapping' : ''].join(' ')}
    >
      <canvas ref={canvasRef} className="block rounded-[22px] bg-slate-50"
        style={{ maxWidth: '100%', maxHeight: 'calc(100vh - 200px)', width: 'auto', height: 'auto' }} />

      {/* ── Interactive mapping overlay ── */}
      {showOverlay && (
        <div
          ref={overlayRef}
          className="absolute inset-0 z-10"
          style={{ cursor: box ? 'default' : 'crosshair', touchAction: 'none' }}
          onPointerDown={startDraw}
        >
          {/* Hint when nothing drawn yet */}
          {!box && (
            <div style={{ position:'absolute', top:12, left:12, padding:'6px 14px', borderRadius:999, background:'rgba(15,23,42,0.88)', color:'#fff', fontSize:12, fontWeight:700, pointerEvents:'none', whiteSpace:'nowrap' }}>
              Drag to draw the {photoMode ? 'photo' : 'text'} area
            </div>
          )}

          {/* The box — interactive when placed, plain outline while drawing */}
          {box && (
            <div
              onPointerDown={drag?.kind === 'draw' ? undefined : startMove}
              style={{
                position: 'absolute', left: box.left, top: box.top, width: box.width, height: box.height,
                borderRadius: radiusPx,
                border: '3px solid rgba(255,255,255,0.98)',
                outline: `3px solid rgba(${accent},0.95)`,
                background: `rgba(${accentSoft},0.16)`,
                cursor: drag?.kind === 'draw' ? 'crosshair' : 'move',
                touchAction: 'none',
              }}
            >
              {/* Dimensions label */}
              <div style={{ position:'absolute', top:8, left:8, padding:'4px 9px', borderRadius:999, background:'rgba(15,23,42,0.86)', color:'#fff', fontSize:11, fontWeight:800, whiteSpace:'nowrap', pointerEvents:'none', fontVariantNumeric:'tabular-nums' }}>
                {Math.round(dispRect!.width)} × {Math.round(dispRect!.height)}
              </div>

              {/* Delete button — only when selected and not mid-drag */}
              {selected && !drag && (
                <button
                  onPointerDown={(e) => { e.stopPropagation(); }}
                  onClick={(e) => { e.stopPropagation(); deleteSlot(); }}
                  title="Delete this area"
                  style={{ position:'absolute', top:-12, right:-12, width:26, height:26, borderRadius:999, background:'#ef4444', color:'#fff', border:'2px solid #fff', boxShadow:'0 2px 8px rgba(0,0,0,0.3)', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', fontSize:15, fontWeight:700, lineHeight:1, padding:0 }}
                >×</button>
              )}

              {/* Corner resize handles — only when selected and not mid-drag */}
              {selected && !drag && CORNERS.map(c => (
                <div
                  key={c}
                  onPointerDown={(e) => startResize(e, c)}
                  style={{ position:'absolute', width:12, height:12, borderRadius:3, background:'#fff', border:`2px solid rgba(${accent},0.95)`, ...cornerPos(c) }}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Persistent read-only indicators ── */}
      {showPhotoInd && (
        <div style={{ position:'absolute', left: imageSlot.x * sx, top: imageSlot.y * sy, width: imageSlot.width * sx, height: imageSlot.height * sy, borderRadius: (imageSlot.radius || 0) * Math.min(sx, sy), border:'2px solid rgba(59,130,246,0.55)', background:'rgba(96,165,250,0.07)', pointerEvents:'none' }}>
          <div style={{ position:'absolute', top:6, left:6, padding:'3px 8px', borderRadius:999, background:'rgba(15,23,42,0.72)', color:'#93c5fd', fontSize:10, fontWeight:700, whiteSpace:'nowrap' }}>
            Photo · {Math.round(imageSlot.width)}×{Math.round(imageSlot.height)}
          </div>
        </div>
      )}
      {tIndOk && (
        <div style={{ position:'absolute', left: textSlot!.x * sx, top: textSlot!.y * sy, width: textSlot!.width * sx, height: textSlot!.height * sy, border:'2px solid rgba(5,150,105,0.55)', background:'rgba(16,185,129,0.07)', pointerEvents:'none' }}>
          <div style={{ position:'absolute', top:6, left:6, padding:'3px 8px', borderRadius:999, background:'rgba(5,46,22,0.72)', color:'#6ee7b7', fontSize:10, fontWeight:700, whiteSpace:'nowrap' }}>
            Text · {Math.round(textSlot!.width)}×{Math.round(textSlot!.height)}
          </div>
        </div>
      )}
    </div>
  );
}
