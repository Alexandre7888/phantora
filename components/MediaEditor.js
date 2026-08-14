function MediaEditor({ media, selectedAudio, onCancel, onSend }) {
    const [text, setText] = React.useState('');
    const [isEditingText, setIsEditingText] = React.useState(false);
    const [isProcessing, setIsProcessing] = React.useState(false);
    const inputRef = React.useRef(null);

    React.useEffect(() => {
        if (isEditingText && inputRef.current) {
            inputRef.current.focus();
        }
    }, [isEditingText]);

    const handleSend = () => {
        setIsProcessing(true);
        
        setTimeout(() => {
            try {
                if (media.type === 'image') {
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

    const MiniVideoPlayer = ({ src }) => {
        const videoRef = React.useRef(null);
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
                <video ref={videoRef} src={src} autoPlay loop playsInline className="w-full h-full object-contain" />
                
                {/* Custom Play/Pause Overlay */}
                {!isPlaying && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/20 backdrop-blur-sm transition-all z-10">
                        <div className="w-16 h-16 rounded-full bg-white/20 flex items-center justify-center border border-white/30 backdrop-blur-md">
                            <div className="icon-play text-4xl text-white ml-2"></div>
                        </div>
                    </div>
                )}
                
                {/* Custom Progress Bar */}
                <div className="absolute bottom-24 left-0 right-0 px-8 z-10">
                    <div className="h-1 bg-white/20 rounded-full overflow-hidden">
                        <div className="h-full bg-brand-500 rounded-full transition-all duration-75" style={{ width: `${progress}%` }}></div>
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="fixed inset-0 bg-black z-[110] flex flex-col font-sans select-none overflow-hidden" data-name="media-editor" data-file="components/MediaEditor.js">
            
            {/* Top Area: Controls */}
            <div className="absolute top-0 left-0 right-0 p-6 flex justify-between items-start z-30 pointer-events-none">
                <button 
                    onClick={onCancel}
                    className="pointer-events-auto w-12 h-12 rounded-full bg-black/40 backdrop-blur-xl flex items-center justify-center border border-white/10 text-white hover:bg-white/20 transition-all active:scale-95"
                >
                    <div className="icon-arrow-left text-2xl"></div>
                </button>
                
                <div className="flex flex-col gap-4 pointer-events-auto">
                    <button 
                        onClick={() => setIsEditingText(true)}
                        className="w-12 h-12 rounded-full bg-black/40 backdrop-blur-xl flex items-center justify-center border border-white/10 text-white hover:bg-white/20 transition-all active:scale-95"
                    >
                        <div className="icon-type text-2xl"></div>
                    </button>
                    {/* Mais botões de edição podem ser adicionados aqui futuramente (ex: crop, stickers, filters) */}
                </div>
            </div>

            {/* Media Content */}
            <div className="flex-1 w-full h-full relative flex items-center justify-center bg-[#0a0a0f]">
                {media.type === 'image' ? (
                    <img src={media.url} className="w-full h-full object-contain" alt="Preview" />
                ) : (
                    <MiniVideoPlayer src={media.url} />
                )}

                {/* Rendered Text */}
                {!isEditingText && text && (
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none p-6 z-20">
                        <div className="bg-black/40 backdrop-blur-xl px-6 py-4 rounded-2xl max-w-[85%] text-center border border-white/10 shadow-2xl transform transition-transform hover:scale-105 pointer-events-auto cursor-pointer" onClick={() => setIsEditingText(true)}>
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

            {/* Bottom Bar: Action */}
            <div className="absolute bottom-0 left-0 right-0 p-8 flex justify-center z-30 pointer-events-none bg-gradient-to-t from-black/80 via-black/40 to-transparent">
                <button 
                    onClick={handleSend} 
                    disabled={isProcessing}
                    className="pointer-events-auto group relative overflow-hidden bg-brand-600 text-white rounded-full py-4 px-10 flex items-center justify-center gap-3 transition-all active:scale-95 disabled:opacity-50 disabled:active:scale-100 shadow-[0_0_40px_rgba(124,58,237,0.4)] hover:shadow-[0_0_60px_rgba(124,58,237,0.6)]"
                >
                    <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300 ease-out"></div>
                    <span className="text-xl font-bold relative z-10">Compartilhar</span>
                    <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center backdrop-blur-sm relative z-10 group-hover:bg-white/30 transition-colors">
                        <div className="icon-send text-xl transform group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform"></div>
                    </div>
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
        </div>
    );
}

window.MediaEditor = MediaEditor;