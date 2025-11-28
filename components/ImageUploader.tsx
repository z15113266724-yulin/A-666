import React, { useState } from 'react';
import { Upload, X, Plus } from 'lucide-react';

interface ImageUploaderProps {
  onImagesSelected: (base64s: string[]) => void;
  onClear: () => void;
  selectedImages: string[];
}

export const ImageUploader: React.FC<ImageUploaderProps> = ({ onImagesSelected, onClear, selectedImages }) => {
  const [isDragging, setIsDragging] = useState(false);

  const processFiles = (files: FileList | null) => {
    if (!files || files.length === 0) return;

    const newImages: string[] = [];
    let processedCount = 0;

    Array.from(files).forEach(file => {
      if (!file.type.startsWith('image/')) return;
      
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        const base64Clean = result.split(',')[1];
        newImages.push(base64Clean);
        processedCount++;
        
        if (processedCount === files.length) {
          // Combine with existing images if needed, or just replace? 
          // Use case: appending.
          onImagesSelected([...selectedImages, ...newImages]);
        }
      };
      reader.readAsDataURL(file);
    });
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
    processFiles(e.dataTransfer.files);
  };

  const removeImage = (index: number) => {
    const newImages = selectedImages.filter((_, i) => i !== index);
    if (newImages.length === 0) {
        onClear();
    } else {
        // We need to update the parent state manually effectively
        // Since onImagesSelected usually expects to add, we might need a better way to set state directly
        // But for now, let's assume the parent handles the "set" logic if we pass the new array
        // Re-using onImagesSelected to SET the full array is a bit hacky based on name, but works for React state setters.
        // Let's modify App.tsx to treat this callback as "setImages".
        // Actually, let's just emit the new full array.
        onImagesSelected(newImages); // NOTE: This requires App.tsx to SET state, not append.
    }
  };

  if (selectedImages.length > 0) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            {selectedImages.map((img, idx) => (
                <div key={idx} className="relative group rounded-xl overflow-hidden border border-gray-200 shadow-sm bg-white aspect-square">
                    <img 
                    src={`data:image/jpeg;base64,${img}`} 
                    alt={`Source ${idx}`} 
                    className="w-full h-full object-contain p-2"
                    />
                    <div className="absolute top-1 right-1">
                        <button 
                            onClick={() => removeImage(idx)}
                            className="bg-white/90 p-1.5 rounded-full shadow-md hover:bg-red-50 text-red-500 transition-colors"
                        >
                            <X size={14} />
                        </button>
                    </div>
                </div>
            ))}
            
            {/* Add More Button */}
            {selectedImages.length < 5 && (
                 <label className="flex flex-col items-center justify-center border-2 border-dashed border-gray-300 rounded-xl cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-colors aspect-square">
                    <input 
                        type="file" 
                        accept="image/*" 
                        multiple
                        onChange={(e) => {
                            // Helper to append
                            // We need to pass ONLY new files to process, but processFiles merges them.
                            // Actually processFiles merges with selectedImages prop.
                            // But here we want to process NEW files and merge them.
                            // The processFiles logic: onImagesSelected([...selectedImages, ...newImages])
                            // So if we pass new files to it, it will append them to CURRENT selectedImages.
                            processFiles(e.target.files);
                        }}
                        className="hidden"
                    />
                    <Plus className="w-8 h-8 text-gray-400" />
                    <span className="text-xs text-gray-500 mt-1">Add Image</span>
                 </label>
            )}
        </div>
        
        <div className="text-center">
            <button onClick={onClear} className="text-xs text-red-500 hover:underline">Clear All Images</button>
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
        multiple
        onChange={(e) => {
            // Initial upload, selectedImages is empty.
            // processFiles appends new images to empty array.
            // onImagesSelected(newImages)
            // App.tsx needs to handle this "set".
            // Since processFiles uses selectedImages prop, if it is empty, it works fine.
            processFiles(e.target.files)
        }}
        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
      />
      <div className="bg-blue-100 p-4 rounded-full mb-4">
        <Upload className="w-8 h-8 text-blue-600" />
      </div>
      <h3 className="text-lg font-semibold text-gray-800">Upload Product Images</h3>
      <p className="text-sm text-gray-500 mt-2 max-w-xs">
        Drag & drop or click to upload multiple images.<br/>
        <span className="text-blue-600 text-xs font-medium bg-blue-50 px-2 py-0.5 rounded-full mt-1 inline-block">Supports Group Shots</span>
      </p>
    </div>
  );
};