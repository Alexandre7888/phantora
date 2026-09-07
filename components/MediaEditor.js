function MediaEditor({ media, selectedAudio, onCancel, onSend }) {
    const [text, setText] = React.useState('');
    const [isEditingText, setIsEditingText] = React.useState(false);
    const [isProcessing, setIsProcessing] = React.useState(false);
    const inputRef = React.useRef(null);
    const mediaRef = React.useRef(null);
    const videoRef = React.useRef(null);

    // Edit modes: 'none', 'filter', 'adjust', 'sound', 'text'
    const [activeMode, setActiveMode] = React.useState('none');
    
    // Adjustments
    const [brightness, setBrightness] = React.useState(100);
    const [contrast, setContrast] = React.useState(100);
    const [saturation, setSaturation] = React.useState(100);
    const [volume, setVolume] = React.useState(100);
    const [activeFilter, setActiveFilter] = React.useState('none');
    const [filterIntensity, setFilterIntensity] = React.useState(100);

    const isVideo = media.type === 'video' || (media.url && media.url.match(/\.(mp4|webm|mov)$/i));

    React.useEffect(() => {
        if (isEditingText && inputRef.current) {
            inputRef.current.focus();
        }
    }, [isEditingText]);

    React.useEffect(() => {
        if (videoRef.current) {
            videoRef.current.volume = volume / 100;
        }
    }, [volume]);

    // Apply CSS filters
    const getFilterStyle = () => {
        let baseFilter = `brightness(${brightness}%) contrast(${contrast}%) saturate(${saturation}%)`;
        
        let extraFilter = '';
        if (activeFilter !== 'none') {
            const intensity = filterIntensity / 100;
            switch(activeFilter) {
                case 'vibe': extraFilter = ` sepia(${50 * intensity}%) hue-rotate(${150 * intensity}%)`; break;
                case 'sunset': extraFilter = ` sepia(${30 * intensity}%) saturate(${150 * intensity}%) hue-rotate(-15deg)`; break;
                case 'bw': extraFilter = ` grayscale(${100 * intensity}%)`; break;
                case 'vintage': extraFilter = ` sepia(${80 * intensity}%) contrast(${120 * intensity}%)`; break;
            }
        }
        
        return { filter: `${baseFilter}${extraFilter}` };
    };

    const handleSend = () => {
        setIsProcessing(true);
        
        setTimeout(() => {
            try {
                if (!isVideo && media.type === 'image') {
                    const img = new Image();
                    img.onload = () => {
                        const canvas = document.createElement('canvas');
                        const MAX_WIDTH = 1080;
                        let width = img.width;
                        let height = img.height;
                        
                        if (width > MAX_WIDTH) {
                            height = height * (MAX_WIDTH / width);
                            width = MAX_WIDTH;
                        }
                        
                        canvas.width = width;
                        canvas.height = height;
                        const ctx = canvas.getContext('2d');
                        
                        // Apply CSS filters to canvas context
                        ctx.filter = getFilterStyle().filter;
                        ctx.drawImage(img, 0, 0, width, height);
                        
                        canvas.toBlob((blob) => {
                            if (blob) {
                                const file = new File([blob], `image_${Date.now()}.jpg`, { type: 'image/jpeg' });
                                onSend(file, 'image', selectedAudio, text);
                            } else {
                                fallbackSend();
                            }
                        }, 'image/jpeg', 0.85);
                    };
                    img.onerror = fallbackSend;
                    img.src = media.url;
                } else {
                    // For video, we might just send the original file as rendering filters requires a canvas stream setup
                    fallbackSend();
                }
            } catch (e) {
                console.error("Erro ao processar mídia", e);
                fallbackSend();
            }
        }, 100);
    };

    const fallbackSend = () => {
        let type = media.type === 'image' ? 'image/jpeg' : (media.mimeType || 'video/mp4');
        let ext = media.type === 'image' ? 'jpg' : (type.includes('mp4') ? 'mp4' : 'webm');
        const file = new File([media.blob], `media_${Date.now()}.${ext}`, { type });
        onSend(file, media.type, selectedAudio, text);
    };

    const MiniVideoPlayer = ({ src, filterStyle }) => {
        const [isPlaying, setIsPlaying] = React.useState(true);
        const [progress, setProgress] = React.useState(0);
        
        React.useEffect(() => {
            const video = videoRef.current;
            if(!video) return;
            const updateTime = () => {
                if(video.duration) setProgress((video.currentTime / video.duration) * 100);
            };
            video.addEventListener('timeupdate', updateTime);
            return () => video.removeEventListener('timeupdate', updateTime);
        }, []);
        
        const togglePlay = (e) => {
            e.stopPropagation();
            if(videoRef.current) {
                if(isPlaying) videoRef.current.pause();
                else videoRef.current.play();
                setIsPlaying(!isPlaying);
            }
        };
        
        return (
            <div className="w-full h-full relative group cursor-pointer" onClick={togglePlay}>
                <video ref={videoRef} src={src} autoPlay loop playsInline className="w-full h-full object-contain" style={filterStyle} />
                
                {!isPlaying && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/20 backdrop-blur-sm transition-all z-10">
                        <div className="w-16 h-16 rounded-full bg-white/20 flex items-center justify-center border border-white/30 backdrop-blur-md">
                            <div className="icon-play text-4xl text-white ml-2"></div>
                        </div>
                    </div>
                )}
                
                <div className="absolute bottom-32 left-0 right-0 px-8 z-10">
                    <div className="h-1 bg-white/20 rounded-full overflow-hidden">
                        <div className="h-full bg-brand-500 rounded-full transition-all duration-75" style={{ width: `${progress}%` }}></div>
                    </div>
                </div>
            </div>
        );
    };

    const CustomSlider = ({ value, onChange, min = 0, max = 200, label }) => (
        <div className="w-full">
            <div className="flex justify-between text-white text-xs mb-2">
                <span>{label}</span>
                <span>{value}%</span>
            </div>
            <input 
                type="range" 
                min={min} 
                max={max} 
                value={value}
                onChange={(e) => onChange(parseInt(e.target.value))}
                className="w-full h-1 bg-gray-700 rounded-lg appearance-none outline-none cursor-pointer"
                style={{
                    background: `linear-gradient(to right, #a855f7 0%, #a855f7 ${(value-min)/(max-min)*100}%, #404040 ${(value-min)/(max-min)*100}%, #404040 100%)`
                }}
            />
        </div>
    );

    return (
        <div className="fixed inset-0 bg-black z-[110] flex flex-col font-sans select-none overflow-hidden" data-name="media-editor" data-file="components/MediaEditor.js">
            
            {/* Top Area: Controls */}
            <div className="absolute top-0 left-0 right-0 p-6 flex justify-between items-start z-30 pointer-events-none">
                <button 
                    onClick={onCancel}
                    className="pointer-events-auto w-12 h-12 rounded-full bg-black/40 backdrop-blur-xl flex items-center justify-center border border-white/10 text-white hover:bg-white/20 transition-all active:scale-95"
                >
                    <div className="icon-x text-2xl"></div>
                </button>
                
                <div className="flex flex-col gap-4 pointer-events-auto">
                    <button 
                        onClick={handleSend}
                        disabled={isProcessing}
                        className="h-12 px-6 rounded-full bg-brand-600 backdrop-blur-xl flex items-center justify-center border border-white/10 text-white font-semibold hover:bg-brand-500 transition-all active:scale-95 disabled:opacity-50"
                    >
                        Avançar
                    </button>
                </div>
            </div>

            {/* Media Content */}
            <div className="flex-1 w-full h-full relative flex items-center justify-center bg-[#0a0a0f] pb-32">
                {!isVideo ? (
                    <img src={media.url} className="w-full h-full object-contain" alt="Preview" style={getFilterStyle()} />
                ) : (
                    <MiniVideoPlayer src={media.url} filterStyle={getFilterStyle()} />
                )}

                {/* Rendered Text */}
                {!isEditingText && text && (
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none p-6 z-20">
                        <div className="bg-black/40 backdrop-blur-xl px-6 py-4 rounded-2xl max-w-[85%] text-center border border-white/10 shadow-2xl transform transition-transform hover:scale-105 pointer-events-auto cursor-pointer" onClick={() => { setActiveMode('text'); setIsEditingText(true); }}>
                            <span className="text-white text-3xl md:text-4xl font-bold break-words whitespace-pre-wrap leading-snug drop-shadow-md">
                                {text}
                            </span>
                        </div>
                    </div>
                )}
            </div>

            {/* Text Editing Overlay */}
            {isEditingText && (
                <div className="absolute inset-0 z-40 flex flex-col bg-black/80 backdrop-blur-2xl animate-fade-in">
                    <div className="flex justify-between items-center p-6">
                        <button 
                            onClick={() => setIsEditingText(false)}
                            className="text-white/70 hover:text-white px-4 py-2 font-medium text-lg transition-colors"
                        >
                            Cancelar
                        </button>
                        <button 
                            onClick={() => setIsEditingText(false)}
                            className="bg-white text-black px-6 py-2 rounded-full font-semibold text-lg hover:bg-gray-200 transition-colors shadow-[0_0_20px_rgba(255,255,255,0.3)]"
                        >
                            Concluído
                        </button>
                    </div>
                    <div className="flex-1 flex items-center justify-center p-6">
                        <textarea
                            ref={inputRef}
                            value={text}
                            onChange={(e) => setText(e.target.value)}
                            placeholder="Digite algo incrível..."
                            className="w-full bg-transparent text-white text-4xl md:text-5xl font-bold text-center outline-none resize-none overflow-hidden placeholder-white/30 drop-shadow-xl"
                            rows={5}
                            autoFocus
                        />
                    </div>
                </div>
            )}

            {/* Editing Panels */}
            {activeMode !== 'none' && activeMode !== 'text' && (
                <div className="absolute bottom-[80px] left-0 right-0 bg-black/80 backdrop-blur-xl border-t border-white/10 p-6 z-30 animate-slide-up rounded-t-3xl">
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="text-white font-semibold text-lg capitalize">{activeMode === 'adjust' ? 'Ajustes' : activeMode === 'filter' ? 'Filtros' : 'Som'}</h3>
                        <button onClick={() => setActiveMode('none')} className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center">
                            <div className="icon-check text-white"></div>
                        </button>
                    </div>

                    {activeMode === 'adjust' && (
                        <div className="space-y-6">
                            <CustomSlider label="Brilho" value={brightness} onChange={setBrightness} min={0} max={200} />
                            <CustomSlider label="Contraste" value={contrast} onChange={setContrast} min={0} max={200} />
                            <CustomSlider label="Saturação" value={saturation} onChange={setSaturation} min={0} max={200} />
                        </div>
                    )}

                    {activeMode === 'filter' && (
                        <div className="space-y-6">
                            <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide">
                                {['none', 'vibe', 'sunset', 'bw', 'vintage'].map((f) => (
                                    <div key={f} className="flex flex-col items-center gap-2 cursor-pointer flex-shrink-0" onClick={() => setActiveFilter(f)}>
                                        <div className={`w-16 h-16 rounded-xl border-2 overflow-hidden ${activeFilter === f ? 'border-purple-500' : 'border-transparent'}`}>
                                            <div className="w-full h-full bg-gray-800" style={{
                                                backgroundImage: `url(${media.url})`,
                                                backgroundSize: 'cover',
                                                backgroundPosition: 'center',
                                                filter: f === 'vibe' ? 'sepia(50%) hue-rotate(150deg)' : f === 'sunset' ? 'sepia(30%) saturate(150%) hue-rotate(-15deg)' : f === 'bw' ? 'grayscale(100%)' : f === 'vintage' ? 'sepia(80%) contrast(120%)' : 'none'
                                            }}></div>
                                        </div>
                                        <span className="text-xs text-white/70 capitalize">{f === 'none' ? 'Normal' : f}</span>
                                    </div>
                                ))}
                            </div>
                            {activeFilter !== 'none' && (
                                <CustomSlider label="Intensidade" value={filterIntensity} onChange={setFilterIntensity} min={0} max={100} />
                            )}
                        </div>
                    )}

                    {activeMode === 'sound' && isVideo && (
                        <div className="space-y-6">
                            <CustomSlider label="Volume do Vídeo" value={volume} onChange={setVolume} min={0} max={100} />
                        </div>
                    )}
                </div>
            )}

            {/* Bottom Bar: Action Icons */}
            <div className="absolute bottom-0 left-0 right-0 h-[80px] bg-black border-t border-white/10 flex justify-around items-center px-6 z-30">
                <button 
                    onClick={() => setActiveMode(activeMode === 'filter' ? 'none' : 'filter')}
                    className={`flex flex-col items-center gap-1 p-2 transition-colors ${activeMode === 'filter' ? 'text-purple-400' : 'text-white/60 hover:text-white'}`}
                >
                    <div className="icon-sparkles text-xl"></div>
                    <span className="text-[10px] font-medium">Filtros</span>
                </button>

                <button 
                    onClick={() => setActiveMode(activeMode === 'adjust' ? 'none' : 'adjust')}
                    className={`flex flex-col items-center gap-1 p-2 transition-colors ${activeMode === 'adjust' ? 'text-purple-400' : 'text-white/60 hover:text-white'}`}
                >
                    <div className="icon-sliders text-xl"></div>
                    <span className="text-[10px] font-medium">Ajustar</span>
                </button>

                {isVideo && (
                    <button 
                        onClick={() => setActiveMode(activeMode === 'sound' ? 'none' : 'sound')}
                        className={`flex flex-col items-center gap-1 p-2 transition-colors ${activeMode === 'sound' ? 'text-purple-400' : 'text-white/60 hover:text-white'}`}
                    >
                        <div className="icon-volume-2 text-xl"></div>
                        <span className="text-[10px] font-medium">Som</span>
                    </button>
                )}

                <button 
                    onClick={() => { setActiveMode('none'); setIsEditingText(true); }}
                    className="flex flex-col items-center gap-1 p-2 transition-colors text-white/60 hover:text-white"
                >
                    <div className="icon-type text-xl"></div>
                    <span className="text-[10px] font-medium">Texto</span>
                </button>
            </div>

            {/* Processing Overlay */}
            {isProcessing && (
                <div className="absolute inset-0 bg-black/90 backdrop-blur-xl z-50 flex flex-col items-center justify-center animate-fade-in">
                    <div className="relative w-24 h-24 mb-8">
                        <div className="absolute inset-0 border-4 border-brand-500/30 rounded-full"></div>
                        <div className="absolute inset-0 border-4 border-brand-500 rounded-full border-t-transparent animate-spin shadow-[0_0_30px_rgba(124,58,237,0.5)]"></div>
                        <div className="absolute inset-0 flex items-center justify-center">
                            <div className="icon-send text-3xl text-brand-400 animate-pulse"></div>
                        </div>
                    </div>
                    <span className="text-white font-bold text-2xl tracking-wide">Preparando...</span>
                    <span className="text-white/50 text-sm mt-3 font-medium">Aplicando magia nos pixels ✨</span>
                </div>
            )}
            
            <style jsx>{`
                .scrollbar-hide::-webkit-scrollbar {
                    display: none;
                }
                .scrollbar-hide {
                    -ms-overflow-style: none;
                    scrollbar-width: none;
                }
                input[type=range]::-webkit-slider-thumb {
                    -webkit-appearance: none;
                    appearance: none;
                    width: 16px;
                    height: 16px;
                    border-radius: 50%;
                    background: white;
                    border: 2px solid #a855f7;
                    cursor: pointer;
                    margin-top: -6px;
                    box-shadow: 0 0 10px rgba(0,0,0,0.5);
                }
                input[type=range]::-webkit-slider-runnable-track {
                    height: 4px;
                    border-radius: 2px;
                    background: transparent;
                }
            `}</style>
        </div>
    );
}

window.MediaEditor = MediaEditor;