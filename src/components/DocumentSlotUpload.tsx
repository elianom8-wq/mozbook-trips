import React, { useState, useRef } from 'react';
import { Camera, Upload, CheckCircle2, RefreshCw, Eye, X, Image as ImageIcon } from 'lucide-react';
import CameraCaptureModal from './CameraCaptureModal';

interface DocumentSlotUploadProps {
  label: string;
  required?: boolean;
  hint: string;
  value: string;
  onChange: (val: string) => void;
  captureTitle: string;
}

export default function DocumentSlotUpload({
  label,
  required,
  hint,
  value,
  onChange,
  captureTitle,
}: DocumentSlotUploadProps) {
  const [cameraOpen, setCameraOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      if (dataUrl) {
        onChange(dataUrl);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      if (dataUrl) {
        onChange(dataUrl);
      }
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="border border-gray-200 rounded-xl p-4 bg-gray-50/50 hover:bg-white transition-all space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <label className="text-xs font-bold text-gray-900 uppercase tracking-wide flex items-center gap-1.5">
            <span>{label}</span>
            {required ? (
              <span className="text-rose-500">*</span>
            ) : (
              <span className="text-[10px] lowercase text-gray-400 font-normal">(optional)</span>
            )}
          </label>
          <p className="text-xs text-gray-500 mt-0.5">{hint}</p>
        </div>

        {value ? (
          <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 bg-emerald-100/70 px-2 py-0.5 rounded-full shrink-0">
            <CheckCircle2 size={12} /> Captured
          </span>
        ) : (
          <span className="text-[11px] text-gray-400 font-medium shrink-0">Required</span>
        )}
      </div>

      {value ? (
        <div className="relative group rounded-xl overflow-hidden border border-gray-200 bg-gray-900 aspect-video max-h-48 flex items-center justify-center">
          <img
            src={value}
            alt={label}
            className="w-full h-full object-contain"
            referrerPolicy="no-referrer"
          />
          <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
            <button
              type="button"
              onClick={() => setPreviewOpen(true)}
              className="px-3 py-1.5 bg-white/90 hover:bg-white text-gray-900 text-xs font-semibold rounded-lg flex items-center gap-1 shadow-sm cursor-pointer"
            >
              <Eye size={14} /> View
            </button>
            <button
              type="button"
              onClick={() => setCameraOpen(true)}
              className="px-3 py-1.5 bg-[#009A60] hover:bg-[#008250] text-white text-xs font-semibold rounded-lg flex items-center gap-1 shadow-sm cursor-pointer"
            >
              <Camera size={14} /> Retake
            </button>
            <button
              type="button"
              onClick={() => onChange('')}
              className="p-1.5 bg-gray-800/80 hover:bg-gray-800 text-gray-300 hover:text-white rounded-lg cursor-pointer"
              title="Remove photo"
            >
              <X size={16} />
            </button>
          </div>
        </div>
      ) : (
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDrop}
          className="border-2 border-dashed border-gray-300 hover:border-[#009A60]/60 rounded-xl p-5 text-center bg-white transition-colors flex flex-col items-center justify-center gap-3"
        >
          <div className="w-10 h-10 rounded-full bg-[#e6f7f0] flex items-center justify-center text-[#009A60]">
            <ImageIcon size={20} />
          </div>

          <div className="space-y-1">
            <p className="text-xs font-semibold text-gray-800">
              Take a photo or upload from device
            </p>
            <p className="text-[11px] text-gray-400">
              Supports JPEG, PNG, WEBP. Crisp, well-lit photos required.
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
            <button
              type="button"
              onClick={() => setCameraOpen(true)}
              className="px-3.5 py-1.5 bg-[#009A60] hover:bg-[#008250] text-white text-xs font-bold rounded-lg flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
            >
              <Camera size={14} />
              <span>Take Photo</span>
            </button>

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="px-3.5 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-colors"
            >
              <Upload size={14} />
              <span>Upload File</span>
            </button>
          </div>
        </div>
      )}

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleFileChange}
        className="hidden"
      />

      {/* Live Camera Modal */}
      <CameraCaptureModal
        isOpen={cameraOpen}
        onClose={() => setCameraOpen(false)}
        onCapture={(dataUrl) => onChange(dataUrl)}
        title={captureTitle}
        subtitle={`Align your ${label.toLowerCase()} flat within good lighting`}
      />

      {/* Full Preview Modal */}
      {previewOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 backdrop-blur-xs">
          <div className="max-w-2xl w-full bg-gray-900 rounded-2xl overflow-hidden border border-gray-800 flex flex-col max-h-[90vh]">
            <div className="p-4 border-b border-gray-800 flex items-center justify-between text-white">
              <span className="font-bold text-sm">{label} Preview</span>
              <button
                type="button"
                onClick={() => setPreviewOpen(false)}
                className="p-1 rounded-lg text-gray-400 hover:text-white"
              >
                <X size={20} />
              </button>
            </div>
            <div className="p-4 overflow-auto flex items-center justify-center bg-black">
              <img
                src={value}
                alt={label}
                className="max-h-[70vh] object-contain rounded-lg"
                referrerPolicy="no-referrer"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
