import React, { useState } from 'react';
import { Upload, Image as ImageIcon, X } from 'lucide-react';

interface ImageUploaderProps {
  onImageSelected: (base64: string) => void;
  onClear: () => void;
  selectedImage: string | null;
}

export const ImageUploader: React.FC<ImageUploaderProps> = ({ onImageSelected, onClear, selectedImage }) => {
  const [isDragging, setIsDragging] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  };

  const processFile = (file: File) => {
    if (!file.type.startsWith('image/')) return;
    
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      // Remove data URL prefix for API if needed, but display needs it. 
      // We pass the full string, service will handle stripping if necessary.
      // For Gemini API, we usually need the base64 part split.
      const base64Clean = result.split(',')[1]; 
      onImageSelected(base64Clean); 
    };
    reader.readAsDataURL(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) processFile(file);
  };

  if (selectedImage) {
    return (
      <div className="relative group rounded-xl overflow-hidden border-2 border-blue-500 shadow-md bg-white">
        <img 
          src={`data:image/jpeg;base64,${selectedImage}`} 
          alt="Product Source" 
          className="w-full h-64 object-contain p-4"
        />
        <div className="absolute top-2 right-2">
           <button 
            onClick={onClear}
            className="bg-white/90 p-2 rounded-full shadow-lg hover:bg-red-50 text-red-500 transition-colors"
           >
             <X size={20} />
           </button>
        </div>
        <div className="absolute bottom-0 left-0 right-0 bg-blue-600/90 text-white p-2 text-center text-sm font-medium">
          Source Product Image
        </div>
      </div>
    );
  }

  return (
    <div 
      className={`relative border-2 border-dashed rounded-xl p-8 transition-all duration-200 flex flex-col items-center justify-center text-center h-64 cursor-pointer
        ${isDragging ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-blue-400 hover:bg-gray-50'}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <input 
        type="file" 
        accept="image/*" 
        onChange={handleFileChange}
        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
      />
      <div className="bg-blue-100 p-4 rounded-full mb-4">
        <Upload className="w-8 h-8 text-blue-600" />
      </div>
      <h3 className="text-lg font-semibold text-gray-800">Upload Product Image</h3>
      <p className="text-sm text-gray-500 mt-2 max-w-xs">
        Drag & drop or click to upload. <br/> Use a clear image with good lighting.
      </p>
    </div>
  );
};
