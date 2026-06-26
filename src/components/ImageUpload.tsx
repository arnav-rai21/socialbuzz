import React from 'react';
import { Camera, CheckCircle, Trash2 } from 'lucide-react';

interface ImageUploadProps {
  rawDataUrl:     string;
  croppedDataUrl: string;
  onFileSelected: (file: File) => void;
  onRemove?:      () => void;
  onOpenPicker:   () => void;
}

export default function ImageUpload({ rawDataUrl, croppedDataUrl, onFileSelected, onRemove, onOpenPicker }: ImageUploadProps) {
  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file?.type.startsWith('image/')) onFileSelected(file);
  }

  const hasImage   = Boolean(rawDataUrl || croppedDataUrl);
  const previewSrc = croppedDataUrl || rawDataUrl;

  if (hasImage) {
    return (
      <div className="flex items-center gap-3 p-3 rounded-2xl border-2 border-dashed border-green-300 bg-green-50">
        <div className="relative flex-shrink-0">
          <img src={previewSrc} alt="Uploaded photo" className="w-16 h-16 rounded-2xl object-cover shadow-sm" />
          <div className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-green-500 rounded-full flex items-center justify-center">
            <CheckCircle size={12} className="text-white" strokeWidth={3} />
          </div>
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-slate-900 text-sm">Photo uploaded</p>
          <p className="text-xs text-slate-400 mt-0.5">Tap to change or remove</p>
        </div>
        <div className="flex items-center gap-1.5">
          <button onClick={onOpenPicker}
            className="w-8 h-8 rounded-xl bg-white border border-slate-200 flex items-center justify-center cursor-pointer hover:bg-slate-50 transition-colors"
            title="Change photo">
            <Camera size={14} className="text-slate-500" />
          </button>
          {onRemove && (
            <button onClick={e => { e.stopPropagation(); onRemove(); }}
              className="w-8 h-8 rounded-xl bg-white border border-slate-200 flex items-center justify-center cursor-pointer hover:bg-red-50 hover:border-red-200 transition-colors"
              title="Remove photo">
              <Trash2 size={14} className="text-slate-400 hover:text-red-500" />
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div
      onClick={onOpenPicker}
      onDragOver={e => e.preventDefault()}
      onDrop={handleDrop}
      className="border-2 border-dashed border-slate-200 rounded-2xl p-5 flex items-center gap-4 cursor-pointer hover:border-violet-400 hover:bg-violet-50/40 transition-all duration-200"
    >
      <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-violet-100 to-pink-100 flex items-center justify-center flex-shrink-0">
        <Camera size={22} className="text-violet-500" />
      </div>
      <div>
        <p className="font-bold text-slate-800 text-sm">Click to upload your photo</p>
        <p className="text-xs text-slate-400 mt-0.5">Camera or gallery · PNG, JPG, WEBP</p>
      </div>
    </div>
  );
}
