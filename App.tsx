
import React, { useState, useEffect } from 'react';
import { ImageUploader } from './components/ImageUploader';
import { Button } from './components/Button';
import { analyzeProductImage, generateScenarioImage } from './services/geminiService';
import { GeneratedImage, GenerationSettings, ProductAnalysis, AppTab } from './types';
import { ASPECT_RATIOS, MAX_IMAGES, MIN_IMAGES, TABS } from './constants';
import { Sparkles, Layers, Download, Image as ImageIcon, CheckCircle, RefreshCw, ShoppingBag, Maximize2, X, ZoomIn, History, Clock, Command, ScanEye, Edit2, Plus, Trash2 } from 'lucide-react';

export default function App() {
  // State
  const [activeTab, setActiveTab] = useState<AppTab>('studio');
  const [sourceImages, setSourceImages] = useState<string[]>([]);
  
  // Analysis & Edit State
  const [analysis, setAnalysis] = useState<ProductAnalysis | null>(null);
  const [editedAnalysis, setEditedAnalysis] = useState<ProductAnalysis | null>(null);
  
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  
  // Custom Instruction
  const [customInstruction, setCustomInstruction] = useState("");

  // Current Session Images
  const [currentSessionImages, setCurrentSessionImages] = useState<GeneratedImage[]>([]);
  // History Images
  const [historyImages, setHistoryImages] = useState<GeneratedImage[]>([]);
  
  const [previewImage, setPreviewImage] = useState<GeneratedImage | null>(null);
  
  // Settings
  const [settings, setSettings] = useState<GenerationSettings>({
    count: 4,
    ratio: '1:1'
  });

  const completedCount = currentSessionImages.filter(img => img.status === 'success').length;
  
  // Handlers
  const handleImagesSelected = async (base64s: string[]) => {
    if (base64s.length < sourceImages.length) {
        setSourceImages(base64s);
        if (base64s.length === 0) handleClear();
        return;
    }

    setSourceImages(base64s);
    setAnalysis(null);
    setEditedAnalysis(null);
    setCurrentSessionImages([]);
    setCustomInstruction("");
    
    setIsAnalyzing(true);
    try {
      const result = await analyzeProductImage(base64s);
      setAnalysis(result);
      setEditedAnalysis(JSON.parse(JSON.stringify(result))); // Deep copy for editing
    } catch (error) {
      console.error("Analysis failed", error);
      alert("无法分析图片，请确保图片清晰。");
      setSourceImages([]);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleClear = () => {
    setSourceImages([]);
    setAnalysis(null);
    setEditedAnalysis(null);
    setCurrentSessionImages([]);
    setIsGenerating(false);
    setCustomInstruction("");
  };

  // Editing Handlers
  const updateFeature = (index: number, value: string) => {
    if (!editedAnalysis) return;
    const newFeatures = [...editedAnalysis.visualFeatures];
    newFeatures[index] = value;
    setEditedAnalysis({ ...editedAnalysis, visualFeatures: newFeatures });
  };

  const removeFeature = (index: number) => {
    if (!editedAnalysis) return;
    const newFeatures = editedAnalysis.visualFeatures.filter((_, i) => i !== index);
    setEditedAnalysis({ ...editedAnalysis, visualFeatures: newFeatures });
  };

  const addFeature = () => {
    if (!editedAnalysis) return;
    setEditedAnalysis({ ...editedAnalysis, visualFeatures: [...editedAnalysis.visualFeatures, "新特征描述..."] });
  };

  const updateScenario = (index: number, value: string) => {
    if (!editedAnalysis) return;
    const newScenarios = [...editedAnalysis.scenarios];
    newScenarios[index] = value;
    setEditedAnalysis({ ...editedAnalysis, scenarios: newScenarios });
  };

  const startGeneration = async () => {
    if (sourceImages.length === 0 || !editedAnalysis) return;
    
    setIsGenerating(true);
    setCurrentSessionImages([]); 

    const finalCount = Math.min(settings.count, editedAnalysis.scenarios.length);

    // Prepare placeholders
    const newBatchIds: string[] = [];
    const placeholders: GeneratedImage[] = Array.from({ length: finalCount }).map((_, i) => {
      const id = `gen-${Date.now()}-${i}`;
      newBatchIds.push(id);
      return {
        id,
        url: '',
        prompt: editedAnalysis.scenarios[i % editedAnalysis.scenarios.length],
        ratio: settings.ratio,
        status: 'loading',
        createdAt: Date.now()
      };
    });

    setCurrentSessionImages(placeholders);

    // Generate sequentially
    for (let i = 0; i < finalCount; i++) {
        const scenario = editedAnalysis.scenarios[i % editedAnalysis.scenarios.length];
        const currentId = newBatchIds[i];
        
        if (i > 0) {
            await new Promise(r => setTimeout(r, 1000)); 
        }

        try {
            const url = await generateScenarioImage(
              sourceImages, 
              scenario, 
              settings.ratio, 
              customInstruction,
              editedAnalysis.visualFeatures 
            );
            
            const updatedImage: GeneratedImage = {
                ...placeholders[i],
                url,
                status: 'success'
            };

            setCurrentSessionImages(prev => prev.map(img => 
                img.id === currentId ? updatedImage : img
            ));
            
            setHistoryImages(prev => [updatedImage, ...prev]);

        } catch (err) {
            console.error(`Failed to generate image ${i}`, err);
            setCurrentSessionImages(prev => prev.map(img => 
                img.id === currentId ? { ...img, status: 'error' } : img
            ));
        }
    }
    
    setIsGenerating(false);
  };

  const downloadImage = (url: string, prefix: string) => {
    const link = document.createElement('a');
    link.href = url;
    link.download = `amazon-${prefix}-${Date.now()}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const renderImageGrid = (images: GeneratedImage[], emptyMessage: string) => {
    if (images.length === 0) {
      return (
        <div className="h-96 flex flex-col items-center justify-center text-gray-400 opacity-60">
          <ImageIcon size={64} className="mb-4" />
          <p className="text-lg font-medium">{emptyMessage}</p>
        </div>
      );
    }

    return (
      <div className={`grid gap-6 ${
        images.length === 1 ? 'grid-cols-1 max-w-xl mx-auto' : 
        'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'
      }`}>
        {images.map((img, idx) => (
          <div key={img.id} className="group relative bg-gray-50 rounded-xl overflow-hidden border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
            
            {/* Status Overlay */}
            {img.status === 'loading' && (
                <div className="aspect-square flex flex-col items-center justify-center bg-gray-100 animate-pulse">
                  <RefreshCw className="w-8 h-8 text-blue-400 animate-spin mb-2" />
                  <span className="text-xs text-gray-500 font-medium px-4 text-center">
                    正在生成第 {idx + 1} 张...
                  </span>
                </div>
            )}

            {img.status === 'error' && (
                <div className="aspect-square flex flex-col items-center justify-center bg-red-50">
                  <span className="text-red-500 font-medium">生成失败</span>
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
                      alt={`Generated ${idx}`} 
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                        <div className="opacity-0 group-hover:opacity-100 transform translate-y-4 group-hover:translate-y-0 transition-all duration-300 bg-white/20 backdrop-blur-md p-3 rounded-full text-white border border-white/30 shadow-lg">
                            <Maximize2 size={24} />
                        </div>
                    </div>
                </div>
                
                <div className="absolute bottom-0 left-0 right-0 p-3 translate-y-full group-hover:translate-y-0 transition-transform bg-white/95 backdrop-blur border-t border-gray-200 flex gap-2" onClick={(e) => e.stopPropagation()}>
                    <button 
                      onClick={() => setPreviewImage(img)}
                      className="flex-1 flex items-center justify-center gap-1.5 bg-gray-100 text-gray-700 py-2 rounded-lg text-xs font-medium hover:bg-gray-200 transition-colors"
                    >
                      <ZoomIn size={14} /> 查看
                    </button>
                    <button 
                      onClick={() => downloadImage(img.url, 'gen')}
                      className="flex-1 flex items-center justify-center gap-1.5 bg-gray-900 text-white py-2 rounded-lg text-xs font-medium hover:bg-gray-800 transition-colors"
                    >
                      <Download size={14} /> 保存
                    </button>
                </div>

                <div className="absolute top-2 right-2 pointer-events-none">
                    <span className="bg-green-100 text-green-700 text-[10px] font-bold px-2 py-1 rounded-full shadow-sm flex items-center gap-1">
                      <CheckCircle size={10} /> 完成
                    </span>
                </div>
              </>
            )}
          </div>
        ))}
      </div>
    );
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
              亚马逊智绘
            </h1>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {/* Navigation Tabs */}
        <div className="flex justify-center mb-8">
            <div className="bg-white p-1 rounded-xl border border-gray-200 shadow-sm flex gap-1">
                <button 
                    onClick={() => setActiveTab('studio')}
                    className={`px-6 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${
                        activeTab === 'studio' 
                        ? 'bg-blue-50 text-blue-700 shadow-sm' 
                        : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                    }`}
                >
                    <Sparkles size={16} /> 创作工坊
                </button>
                <button 
                    onClick={() => setActiveTab('history')}
                    className={`px-6 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${
                        activeTab === 'history' 
                        ? 'bg-blue-50 text-blue-700 shadow-sm' 
                        : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                    }`}
                >
                    <History size={16} /> 历史记录 <span className="ml-1 bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded-full text-xs">{historyImages.length}</span>
                </button>
            </div>
        </div>

        {/* STUDIO VIEW */}
        {activeTab === 'studio' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 animate-fadeIn">
            {/* Left Column: Input & Controls */}
            <div className="lg:col-span-4 space-y-6">
                {/* 1. Upload Section */}
                <section className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                    <span className="flex items-center justify-center w-6 h-6 rounded-full bg-blue-100 text-blue-600 text-xs font-bold">1</span>
                    产品素材
                </h2>
                <ImageUploader 
                    selectedImages={sourceImages}
                    onImagesSelected={handleImagesSelected}
                    onClear={handleClear}
                />
                </section>

                {/* 2. Analysis & Settings Section */}
                {sourceImages.length > 0 && (
                <section className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 animate-fadeIn">
                    <div className="mb-6">
                    <div className="flex items-center justify-between mb-3">
                        <h2 className="text-lg font-semibold flex items-center gap-2">
                            <span className="flex items-center justify-center w-6 h-6 rounded-full bg-blue-100 text-blue-600 text-xs font-bold">2</span>
                            产品分析 (可编辑)
                        </h2>
                        {editedAnalysis && <span className="text-xs text-gray-400 bg-gray-100 px-2 py-1 rounded">可直接修改内容</span>}
                    </div>
                    
                    {isAnalyzing ? (
                        <div className="space-y-3 animate-pulse">
                            <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                            <div className="h-4 bg-gray-200 rounded w-full"></div>
                            <div className="h-4 bg-gray-200 rounded w-5/6"></div>
                            <p className="text-center text-sm text-blue-500 mt-4">AI 正在深度分析产品特征与卖点...</p>
                        </div>
                    ) : editedAnalysis ? (
                        <div className="space-y-4 text-sm">
                            {/* Editable Name */}
                            <div>
                                <label className="text-gray-500 block text-xs uppercase tracking-wider font-bold mb-1">产品名称</label>
                                <input 
                                    type="text" 
                                    value={editedAnalysis.name}
                                    onChange={(e) => setEditedAnalysis({...editedAnalysis, name: e.target.value})}
                                    className="w-full border-b border-gray-200 focus:border-blue-500 outline-none py-1 font-medium text-gray-900 bg-transparent transition-colors"
                                />
                            </div>
                            
                            {/* Editable Visual Features */}
                            <div className="bg-indigo-50 p-3 rounded-lg border border-indigo-100">
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-indigo-800 text-xs uppercase tracking-wider font-bold flex items-center gap-1">
                                        <ScanEye size={12} /> 视觉特征锁定
                                    </span>
                                    <button onClick={addFeature} className="text-indigo-600 hover:text-indigo-800 p-1">
                                        <Plus size={14} />
                                    </button>
                                </div>
                                <div className="space-y-2">
                                    {editedAnalysis.visualFeatures.map((feat, i) => (
                                        <div key={i} className="flex items-center gap-2">
                                            <span className="block w-1 h-1 rounded-full bg-indigo-500 shrink-0"></span>
                                            <input 
                                                type="text"
                                                value={feat}
                                                onChange={(e) => updateFeature(i, e.target.value)}
                                                className="flex-1 bg-white/50 border-b border-transparent focus:border-indigo-400 focus:bg-white text-xs text-indigo-900 outline-none px-1 py-0.5 rounded transition-all"
                                            />
                                            <button onClick={() => removeFeature(i)} className="text-indigo-300 hover:text-red-500 transition-colors">
                                                <X size={12} />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                                <p className="text-[10px] text-indigo-400 mt-2 leading-tight">
                                    * 请检查是否包含“无黑色后跟”等防幻觉特征，点击文字可修改。
                                </p>
                            </div>

                            {/* Editable Scenarios (Collapsed by default or simple input?) Let's show first few or allow editing current selection logic later. 
                                For now, let's keep it simple: Scenarios are auto-used. We can list them if we want to be fancy, but space is limited.
                                Let's list selling points instead as badges.
                            */}
                            <div>
                                <span className="text-gray-500 block text-xs uppercase tracking-wider font-bold mb-1">核心卖点</span>
                                <div className="flex flex-wrap gap-1">
                                {editedAnalysis.sellingPoints.map((pt, i) => (
                                    <span key={i} className="bg-green-50 text-green-700 px-2 py-1 rounded text-xs border border-green-100">
                                    {pt}
                                    </span>
                                ))}
                                </div>
                            </div>
                        </div>
                    ) : (
                        <p className="text-red-500 text-sm">分析失败，请重试。</p>
                    )}
                    </div>

                    <hr className="my-6 border-gray-100" />

                    <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                    <span className="flex items-center justify-center w-6 h-6 rounded-full bg-blue-100 text-blue-600 text-xs font-bold">3</span>
                    生成设置
                    </h2>

                    <div className="space-y-5">
                    
                    {/* Custom Instructions */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-1">
                        <Command size={14} className="text-blue-500" />
                        自定义指令 <span className="text-gray-400 font-normal">(可选 - 最高优先级)</span>
                      </label>
                      <textarea
                        className="w-full border border-gray-200 rounded-lg p-3 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all resize-none shadow-sm placeholder:text-gray-400"
                        rows={2}
                        placeholder="例如：由美国老年模特展示，放在木质桌面上，背景虚化..."
                        value={customInstruction}
                        onChange={(e) => setCustomInstruction(e.target.value)}
                      />
                    </div>

                    {/* Quantity Slider */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2 flex justify-between">
                        <span>生成数量</span>
                        <span className="text-blue-600 font-bold">{settings.count} 张</span>
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
                        <label className="block text-sm font-medium text-gray-700 mb-2">图片比例</label>
                        <div className="grid grid-cols-2 gap-2">
                        {ASPECT_RATIOS.map((ratio) => (
                            <button
                            key={ratio.value}
                            onClick={() => setSettings({...settings, ratio: ratio.value})}
                            className={`px-2 py-2 text-xs rounded-lg border font-medium transition-all text-left
                                ${settings.ratio === ratio.value 
                                ? 'bg-blue-600 text-white border-blue-600 shadow-sm' 
                                : 'bg-white text-gray-600 border-gray-200 hover:border-blue-300'
                                }`}
                            >
                            <span className="font-bold">{ratio.value}</span> <span className="opacity-80 font-normal scale-90">{ratio.label.split(' ')[1]}</span>
                            </button>
                        ))}
                        </div>
                    </div>

                    <Button 
                        onClick={startGeneration} 
                        disabled={isGenerating || !editedAnalysis} 
                        isLoading={isGenerating}
                        className="w-full h-12 text-lg shadow-blue-200 shadow-lg"
                    >
                        <Sparkles size={20} />
                        开始生成 {settings.count} 张图片
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
                    当前创作会话
                    </h2>
                    {isGenerating && (
                    <span className="text-sm text-blue-600 font-medium animate-pulse">
                        正在生成第 {completedCount + 1} / {Math.min(settings.count, editedAnalysis?.scenarios.length || 8)} 张...
                    </span>
                    )}
                </div>

                <div className="p-6 flex-1">
                    {renderImageGrid(currentSessionImages, "请先在左侧上传产品图，AI 将为您生成专业的亚马逊商品图。")}
                </div>
                </div>
            </div>
            </div>
        )}

        {/* HISTORY VIEW */}
        {activeTab === 'history' && (
             <div className="bg-white rounded-2xl min-h-[600px] shadow-sm border border-gray-100 animate-fadeIn">
                <div className="p-6 border-b border-gray-100 flex items-center justify-between">
                     <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                        <Clock className="text-blue-600" />
                        生成历史
                    </h2>
                </div>
                <div className="p-6">
                    {renderImageGrid(historyImages, "暂无历史记录。去创作工坊开始生图吧！")}
                </div>
             </div>
        )}

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
                        onClick={() => downloadImage(previewImage.url, 'high-res')}
                        className="bg-white text-black px-6 py-2.5 rounded-full font-medium flex items-center gap-2 hover:bg-gray-200 transition-all shadow-lg hover:shadow-xl hover:scale-105"
                    >
                        <Download size={18} /> 下载高清大图
                    </button>
                </div>
            </div>
        </div>
      )}
    </div>
  );
}
