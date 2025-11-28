import React, { useState } from 'react';
import { ImageUploader } from './components/ImageUploader';
import { Button } from './components/Button';
import { analyzeProductImage, generateScenarioImage } from './services/geminiService';
import { GeneratedImage, GenerationSettings, ProductAnalysis } from './types';
import { ASPECT_RATIOS, MAX_IMAGES, MIN_IMAGES } from './constants';
import { Sparkles, Layers, Download, Image as ImageIcon, CheckCircle, RefreshCw, ShoppingBag, Maximize2, X, ZoomIn } from 'lucide-react';

export default function App() {
  // State
  const [sourceImage, setSourceImage] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<ProductAnalysis | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedImages, setGeneratedImages] = useState<GeneratedImage[]>([]);
  const [previewImage, setPreviewImage] = useState<GeneratedImage | null>(null);
  
  // Settings
  const [settings, setSettings] = useState<GenerationSettings>({
    count: 4,
    ratio: '1:1'
  });

  // Derived state to track progress
  const completedCount = generatedImages.filter(img => img.status === 'success').length;
  
  // Handlers
  const handleImageSelected = async (base64: string) => {
    setSourceImage(base64);
    setAnalysis(null);
    setGeneratedImages([]);
    
    // Auto analyze on upload
    setIsAnalyzing(true);
    try {
      const result = await analyzeProductImage(base64);
      setAnalysis(result);
    } catch (error) {
      console.error("Analysis failed", error);
      alert("Could not analyze image. Please try a clearer photo.");
      setSourceImage(null);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleClear = () => {
    setSourceImage(null);
    setAnalysis(null);
    setGeneratedImages([]);
    setIsGenerating(false);
  };

  const startGeneration = async () => {
    if (!sourceImage || !analysis) return;
    
    setIsGenerating(true);
    setGeneratedImages([]); // Clear previous

    // Prepare placeholders
    const placeholders: GeneratedImage[] = Array.from({ length: settings.count }).map((_, i) => ({
      id: `pending-${i}`,
      url: '',
      prompt: analysis.scenarios[i % analysis.scenarios.length] || "Professional product shot",
      ratio: settings.ratio,
      status: 'loading'
    }));

    setGeneratedImages(placeholders);

    // Generate sequentially to allow UI updates and avoid potential rate limits/race conditions
    // Using a loop with index tracking to update specific placeholder
    for (let i = 0; i < settings.count; i++) {
        const scenario = analysis.scenarios[i % analysis.scenarios.length];
        
        try {
            const url = await generateScenarioImage(sourceImage, scenario, settings.ratio);
            
            setGeneratedImages(prev => prev.map((img, idx) => {
                if (idx === i) {
                    return { ...img, url, status: 'success' };
                }
                return img;
            }));
        } catch (err) {
            console.error(`Failed to generate image ${i}`, err);
            setGeneratedImages(prev => prev.map((img, idx) => {
                if (idx === i) {
                    return { ...img, status: 'error' };
                }
                return img;
            }));
        }
    }
    
    setIsGenerating(false);
  };

  const downloadImage = (url: string, index: number) => {
    const link = document.createElement('a');
    link.href = url;
    link.download = `amazon-product-${analysis?.name.replace(/\s+/g, '-').toLowerCase()}-${index + 1}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 font-sans selection:bg-blue-100">
      {/* Header */}
      <header className="bg-white border-b sticky top-0 z-20 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="bg-gradient-to-br from-blue-600 to-indigo-600 p-2 rounded-lg text-white">
              <ShoppingBag size={20} />
            </div>
            <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-700 to-indigo-700">
              AmazonGen
            </h1>
          </div>
          <div className="text-sm text-gray-500 font-medium hidden sm:block">
            AI-Powered Product Photography Suite
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* Left Column: Input & Controls */}
          <div className="lg:col-span-4 space-y-6">
            
            {/* 1. Upload Section */}
            <section className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <span className="flex items-center justify-center w-6 h-6 rounded-full bg-blue-100 text-blue-600 text-xs font-bold">1</span>
                Product Source
              </h2>
              <ImageUploader 
                selectedImage={sourceImage}
                onImageSelected={handleImageSelected}
                onClear={handleClear}
              />
            </section>

            {/* 2. Analysis & Settings Section */}
            {sourceImage && (
              <section className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 animate-fadeIn">
                <div className="mb-6">
                  <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
                    <span className="flex items-center justify-center w-6 h-6 rounded-full bg-blue-100 text-blue-600 text-xs font-bold">2</span>
                    Product Analysis
                  </h2>
                  
                  {isAnalyzing ? (
                    <div className="space-y-3 animate-pulse">
                      <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                      <div className="h-4 bg-gray-200 rounded w-full"></div>
                      <div className="h-4 bg-gray-200 rounded w-5/6"></div>
                    </div>
                  ) : analysis ? (
                    <div className="space-y-3 text-sm">
                      <div>
                        <span className="text-gray-500 block text-xs uppercase tracking-wider font-bold">Product Name</span>
                        <p className="font-medium text-gray-900">{analysis.name}</p>
                      </div>
                      <div>
                        <span className="text-gray-500 block text-xs uppercase tracking-wider font-bold">Features</span>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {analysis.sellingPoints.map((pt, i) => (
                            <span key={i} className="bg-green-50 text-green-700 px-2 py-1 rounded text-xs border border-green-100">
                              {pt}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <p className="text-red-500 text-sm">Analysis failed. Please try again.</p>
                  )}
                </div>

                <hr className="my-6 border-gray-100" />

                <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <span className="flex items-center justify-center w-6 h-6 rounded-full bg-blue-100 text-blue-600 text-xs font-bold">3</span>
                  Generation Settings
                </h2>

                <div className="space-y-5">
                  {/* Quantity Slider */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2 flex justify-between">
                      <span>Image Quantity</span>
                      <span className="text-blue-600 font-bold">{settings.count} images</span>
                    </label>
                    <input 
                      type="range"
                      min={MIN_IMAGES}
                      max={MAX_IMAGES}
                      value={settings.count}
                      onChange={(e) => setSettings({...settings, count: parseInt(e.target.value)})}
                      className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                    />
                    <div className="flex justify-between text-xs text-gray-400 mt-1">
                      <span>1</span>
                      <span>8</span>
                    </div>
                  </div>

                  {/* Aspect Ratio */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Aspect Ratio</label>
                    <div className="grid grid-cols-3 gap-2">
                      {ASPECT_RATIOS.map((ratio) => (
                        <button
                          key={ratio.value}
                          onClick={() => setSettings({...settings, ratio: ratio.value})}
                          className={`px-2 py-2 text-xs rounded-lg border font-medium transition-all
                            ${settings.ratio === ratio.value 
                              ? 'bg-blue-600 text-white border-blue-600 shadow-sm' 
                              : 'bg-white text-gray-600 border-gray-200 hover:border-blue-300'
                            }`}
                        >
                          {ratio.label.split(' ')[0]}
                          <span className="block text-[10px] opacity-80 font-normal">{ratio.label.split('(')[1].replace(')', '')}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  <Button 
                    onClick={startGeneration} 
                    disabled={isGenerating || !analysis} 
                    isLoading={isGenerating}
                    className="w-full h-12 text-lg shadow-blue-200 shadow-lg"
                  >
                     <Sparkles size={20} />
                     Generate {settings.count} Images
                  </Button>
                </div>
              </section>
            )}
          </div>

          {/* Right Column: Results */}
          <div className="lg:col-span-8">
            <div className="bg-white rounded-2xl min-h-[600px] shadow-sm border border-gray-100 flex flex-col">
              <div className="p-6 border-b border-gray-100 flex items-center justify-between sticky top-0 bg-white/95 backdrop-blur z-10 rounded-t-2xl">
                <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                  <Layers className="text-blue-600" />
                  Generated Suite
                </h2>
                {isGenerating && (
                   <span className="text-sm text-blue-600 font-medium animate-pulse">
                     Generating {completedCount}/{settings.count}...
                   </span>
                )}
              </div>

              <div className="p-6 flex-1">
                {!sourceImage ? (
                  <div className="h-full flex flex-col items-center justify-center text-gray-400 opacity-60">
                    <ImageIcon size={64} className="mb-4" />
                    <p className="text-lg font-medium">Upload a product to start</p>
                  </div>
                ) : generatedImages.length === 0 && !isGenerating ? (
                  <div className="h-full flex flex-col items-center justify-center text-gray-400 opacity-60">
                    <Sparkles size={64} className="mb-4" />
                    <p className="text-lg font-medium">Ready to generate magic</p>
                    <p className="text-sm">Select your settings and click Generate</p>
                  </div>
                ) : (
                  <div className={`grid gap-6 ${
                    generatedImages.length === 1 ? 'grid-cols-1 max-w-xl mx-auto' : 
                    generatedImages.length <= 4 ? 'grid-cols-1 sm:grid-cols-2' : 
                    'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3'
                  }`}>
                    {generatedImages.map((img, idx) => (
                      <div key={img.id} className="group relative bg-gray-50 rounded-xl overflow-hidden border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
                        
                        {/* Status Overlay */}
                        {img.status === 'loading' && (
                           <div className="aspect-square flex flex-col items-center justify-center bg-gray-100 animate-pulse">
                             <RefreshCw className="w-8 h-8 text-blue-400 animate-spin mb-2" />
                             <span className="text-xs text-gray-500 font-medium px-4 text-center">Creating: {img.prompt.slice(0, 30)}...</span>
                           </div>
                        )}

                        {img.status === 'error' && (
                           <div className="aspect-square flex flex-col items-center justify-center bg-red-50">
                             <span className="text-red-500 font-medium">Generation Failed</span>
                           </div>
                        )}

                        {img.status === 'success' && (
                          <>
                            <div 
                              className="aspect-square relative overflow-hidden bg-white cursor-pointer"
                              onClick={() => setPreviewImage(img)}
                            >
                                <img 
                                  src={img.url} 
                                  alt={`Generated product ${idx + 1}`} 
                                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                                />
                                {/* Dark overlay on hover */}
                                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                                    {/* Magnify Icon */}
                                    <div className="opacity-0 group-hover:opacity-100 transform translate-y-4 group-hover:translate-y-0 transition-all duration-300 bg-white/20 backdrop-blur-md p-3 rounded-full text-white border border-white/30 shadow-lg">
                                        <Maximize2 size={24} />
                                    </div>
                                </div>
                            </div>
                            
                            {/* Action Bar */}
                            <div className="absolute bottom-0 left-0 right-0 p-3 translate-y-full group-hover:translate-y-0 transition-transform bg-white/95 backdrop-blur border-t border-gray-200 flex gap-2" onClick={(e) => e.stopPropagation()}>
                               <button 
                                 onClick={() => setPreviewImage(img)}
                                 className="flex-1 flex items-center justify-center gap-1.5 bg-gray-100 text-gray-700 py-2 rounded-lg text-xs font-medium hover:bg-gray-200 transition-colors"
                                 title="View Fullscreen"
                               >
                                 <ZoomIn size={14} /> View
                               </button>
                               <button 
                                 onClick={() => downloadImage(img.url, idx)}
                                 className="flex-1 flex items-center justify-center gap-1.5 bg-gray-900 text-white py-2 rounded-lg text-xs font-medium hover:bg-gray-800 transition-colors"
                                 title="Download Image"
                               >
                                 <Download size={14} /> Save
                               </button>
                            </div>

                            <div className="absolute top-2 right-2 pointer-events-none">
                                <span className="bg-green-100 text-green-700 text-[10px] font-bold px-2 py-1 rounded-full shadow-sm flex items-center gap-1">
                                  <CheckCircle size={10} /> DONE
                                </span>
                            </div>
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Fullscreen Preview Modal */}
      {previewImage && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-8 bg-black/95 backdrop-blur-sm animate-fadeIn" 
          onClick={() => setPreviewImage(null)}
        >
            <div className="absolute top-4 right-4 z-10">
                <button 
                    onClick={() => setPreviewImage(null)}
                    className="bg-white/10 hover:bg-white/20 text-white p-2 rounded-full transition-colors"
                >
                    <X size={24} />
                </button>
            </div>
            
            <div 
              className="relative w-full h-full flex flex-col items-center justify-center" 
              onClick={e => e.stopPropagation()}
            >
                <img 
                    src={previewImage.url} 
                    alt="Full preview"
                    className="max-w-full max-h-[80vh] object-contain rounded-lg shadow-2xl"
                />
                
                <div className="mt-6 flex flex-col items-center gap-3">
                    <p className="text-white/80 text-sm max-w-2xl text-center font-light">{previewImage.prompt}</p>
                    <button 
                        onClick={() => downloadImage(previewImage.url, generatedImages.findIndex(img => img.id === previewImage.id))}
                        className="bg-white text-black px-6 py-2.5 rounded-full font-medium flex items-center gap-2 hover:bg-gray-200 transition-all shadow-lg hover:shadow-xl hover:scale-105"
                    >
                        <Download size={18} /> Download High-Res Image
                    </button>
                </div>
            </div>
        </div>
      )}
    </div>
  );
}