import { AnimatePresence, motion } from 'motion/react';
import { Check, RotateCcw, Scissors, Sparkles, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import Cropper from 'react-cropper';
import 'cropperjs/dist/cropper.css';
import { toast } from 'sonner';
import type { ImageSlot } from '../types';
import { callRemoveBackground, callEnhanceImage } from '../lib/server';

interface CropModalProps {
  open: boolean;
  imageSrc: string;
  slot: ImageSlot;
  /** Remove-bg / Enhance are Pro features, each independently switchable per event
   *  from the backend's Photo Tools section. A tool's button is hidden when off. */
  removeBgEnabled?: boolean;
  enhanceEnabled?:  boolean;
  onApply: (croppedDataUrl: string) => void;
  onClose: () => void;
}

export default function CropModal({ open, imageSrc, slot, removeBgEnabled = true, enhanceEnabled = true, onApply, onClose }: CropModalProps) {
  const cropperRef = useRef<any>(null);

  // The image currently shown in the cropper. Starts as the uploaded photo and
  // is replaced in place when the user removes the background or enhances it.
  const [workingSrc, setWorkingSrc] = useState(imageSrc);
  const [processing,  setProcessing]  = useState<null | 'bg' | 'enhance'>(null);
  const [bgRemoved,   setBgRemoved]   = useState(false);

  // Reset working state whenever a new photo is loaded into the modal.
  useEffect(() => {
    setWorkingSrc(imageSrc);
    setBgRemoved(false);
    setProcessing(null);
  }, [imageSrc]);

  const aspectRatio = slot.width && slot.height ? slot.width / slot.height : 1;
  const isOriginal  = workingSrc === imageSrc;
  const showTools   = removeBgEnabled || enhanceEnabled;

  function handleApply() {
    const cropper = cropperRef.current?.cropper;
    if (!cropper) return;
    const w = Math.max(slot.width || 800, 800);
    const h = Math.max(slot.height || 800, 800);
    const croppedCanvas = cropper.getCroppedCanvas({
      width: w,
      height: h,
      imageSmoothingQuality: 'high',
    });
    onApply(croppedCanvas.toDataURL('image/png'));
  }

  // Run a Cutout.Pro op on the full working image and swap it back into the cropper.
  function runProcess(kind: 'bg' | 'enhance') {
    if (processing) return;
    setProcessing(kind);
    const fn = kind === 'bg' ? callRemoveBackground : callEnhanceImage;
    fn(
      workingSrc,
      (res) => {
        setWorkingSrc(res.base64Data);
        if (kind === 'bg') setBgRemoved(true);
        setProcessing(null);
        toast.success(kind === 'bg' ? 'Background removed!' : 'Photo enhanced!');
      },
      (err) => {
        setProcessing(null);
        const msg = (err as Error)?.message ?? String(err);
        toast.error(`${kind === 'bg' ? "Couldn't remove background" : "Couldn't enhance photo"}: ${msg}`);
      }
    );
  }

  function resetToOriginal() {
    setWorkingSrc(imageSrc);
    setBgRemoved(false);
  }

  const btnBase =
    'flex-1 flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl text-xs font-bold cursor-pointer transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed';

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-3 sm:p-4"
          style={{ background: 'rgba(15,23,42,0.72)', backdropFilter: 'blur(4px)' }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
        >
          <motion.div
            className="w-full max-w-3xl bg-white rounded-3xl shadow-2xl p-4 sm:p-6 flex flex-col gap-3 max-h-[95vh] overflow-y-auto"
            initial={{ opacity: 0, scale: 0.95, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 16 }}
            transition={{ duration: 0.24, type: 'spring', stiffness: 340, damping: 26 }}
          >
            {/* Header */}
            <div className="flex items-center justify-between">
              <span className="text-xs font-black uppercase tracking-widest text-slate-800">
                Crop Your Photo
              </span>
              <button
                onClick={onClose}
                className="w-9 h-9 rounded-xl bg-slate-100 border border-slate-200 text-slate-500 flex items-center justify-center hover:bg-red-50 hover:text-red-500 hover:border-red-200 transition-colors cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            {/* Cropper area */}
            <div
              className="relative w-full rounded-2xl overflow-hidden bg-slate-100"
              style={{ height: 'min(55vh, 420px)' }}
            >
              {workingSrc && (
                <Cropper
                  key={workingSrc}
                  ref={cropperRef}
                  src={workingSrc}
                  style={{ height: '100%', width: '100%' }}
                  aspectRatio={aspectRatio}
                  viewMode={1}
                  autoCropArea={0.88}
                  dragMode="move"
                  responsive={true}
                  restore={false}
                  guides={true}
                  highlight={true}
                  cropBoxMovable={true}
                  cropBoxResizable={true}
                  toggleDragModeOnDblclick={false}
                  background={true}
                />
              )}
              {/* Processing overlay */}
              {processing && (
                <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-white/75 backdrop-blur-sm">
                  <span style={{ width: 28, height: 28, border: '3px solid rgba(124,58,237,0.25)', borderTopColor: '#7c3aed', borderRadius: '50%', animation: 'spin 0.7s linear infinite', display: 'inline-block' }} />
                  <p className="text-sm font-bold text-slate-700">
                    {processing === 'bg' ? 'Removing background…' : 'Enhancing photo…'}
                  </p>
                  <p className="text-xs text-slate-400">This can take a few seconds.</p>
                </div>
              )}
            </div>

            {/* AI photo tools (Pro; each togglable per event) */}
            {showTools && (
            <div className="flex gap-2">
              {removeBgEnabled && (
              <button
                onClick={() => runProcess('bg')}
                disabled={!!processing || bgRemoved}
                className={[btnBase, bgRemoved ? 'bg-violet-50 text-violet-700 border border-violet-200' : 'bg-violet-600 text-white hover:shadow-lg hover:shadow-violet-500/25'].join(' ')}
                title="Remove the background from your photo"
              >
                <Scissors size={14} /> {bgRemoved ? 'Background removed' : 'Remove background'}
              </button>
              )}
              {enhanceEnabled && (
              <button
                onClick={() => runProcess('enhance')}
                disabled={!!processing}
                className={[btnBase, 'bg-gradient-to-r from-violet-600 to-pink-500 text-white hover:shadow-lg hover:shadow-violet-500/25'].join(' ')}
                title="Sharpen and upscale your photo"
              >
                <Sparkles size={14} /> Enhance
              </button>
              )}
              {!isOriginal && (
                <button
                  onClick={resetToOriginal}
                  disabled={!!processing}
                  className="flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl text-xs font-bold cursor-pointer transition-all active:scale-[0.98] bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                  title="Revert to the original photo"
                >
                  <RotateCcw size={14} /> Reset
                </button>
              )}
            </div>
            )}

            {/* Actions */}
            <div className="flex gap-3">
              <button
                onClick={handleApply}
                disabled={!!processing}
                className="flex-1 flex items-center justify-center gap-2 py-3 px-5 rounded-xl bg-gradient-to-r from-red-500 to-violet-600 text-white text-sm font-bold cursor-pointer hover:shadow-lg hover:shadow-violet-500/25 transition-all duration-150 hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
              >
                <Check size={16} />
                Apply Crop
              </button>
              <button
                onClick={onClose}
                className="flex-1 py-3 px-5 rounded-xl bg-white border-[1.5px] border-slate-200 text-slate-700 text-sm font-bold cursor-pointer hover:-translate-y-0.5 active:translate-y-0 transition-all duration-150"
              >
                Cancel
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
