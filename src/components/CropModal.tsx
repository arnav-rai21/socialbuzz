import { AnimatePresence, motion } from 'motion/react';
import { Check, X } from 'lucide-react';
import { useRef } from 'react';
import Cropper from 'react-cropper';
import 'cropperjs/dist/cropper.css';
import type { ImageSlot } from '../types';

interface CropModalProps {
  open: boolean;
  imageSrc: string;
  slot: ImageSlot;
  onApply: (croppedDataUrl: string) => void;
  onClose: () => void;
}

export default function CropModal({ open, imageSrc, slot, onApply, onClose }: CropModalProps) {
  const cropperRef = useRef<any>(null);

  const aspectRatio = slot.width && slot.height ? slot.width / slot.height : 1;

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
              className="w-full rounded-2xl overflow-hidden bg-slate-100"
              style={{ height: 'min(55vh, 420px)' }}
            >
              {imageSrc && (
                <Cropper
                  key={imageSrc}
                  ref={cropperRef}
                  src={imageSrc}
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
                />
              )}
            </div>

            {/* Actions */}
            <div className="flex gap-3">
              <button
                onClick={handleApply}
                className="flex-1 flex items-center justify-center gap-2 py-3 px-5 rounded-xl bg-gradient-to-r from-red-500 to-violet-600 text-white text-sm font-bold cursor-pointer hover:shadow-lg hover:shadow-violet-500/25 transition-all duration-150 hover:-translate-y-0.5 active:translate-y-0"
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
