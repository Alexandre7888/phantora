function MediaEditor({ media, selectedAudio, onCancel, onSend }) {
    const [isProcessing, setIsProcessing] = React.useState(false);
    const [processingProgress, setProcessingProgress] = React.useState(0);
    const videoRef = React.useRef(null);
    const canvasRef = React.useRef(null);
    const overlayCanvasRef = React.useRef(null);

    const [activeMode, setActiveMode] = React.useState('none');

    // Ajustes de imagem
    const [brightness, setBrightness] = React.useState(100);
    const [contrast, setContrast] = React.useState(100);
    const [saturation, setSaturation] = React.useState(100);
    const [volume, setVolume] = React.useState(100);
    const [activeFilter, setActiveFilter] = React.useState('none');
    const [filterIntensity, setFilterIntensity] = React.useState(100);

    // TEXTO — agora com array de textos (múltiplos)
    const [texts, setTexts] = React.useState([]);
    const [editingTextIndex, setEditingTextIndex] = React.useState(null);
    const [selectedTextIndex, setSelectedTextIndex] = React.useState(null);

    // Editor de texto atual (quando está editando)
    const [currentText, setCurrentText] = React.useState({
        content: '',
        x: 50,          // % da largura
        y: 50,          // % da altura
        size: 32,       // px
        color: '#ffffff',
        fontFamily: 'Arial',
        fontWeight: 'bold',
        background: 'transparent',
        stroke: false,
        strokeColor: '#000000'
    });

    // DESENHO
    const [isDrawing, setIsDrawing] = React.useState(false);
    const [drawColor, setDrawColor] = React.useState('#ff0000');
    const [drawSize, setDrawSize] = React.useState(5);
    const [drawStrokes, setDrawStrokes] = React.useState([]); // array de traços
    const currentStrokeRef = React.useRef([]);
    const [lastPointer, setLastPointer] = React.useState(null);

    // UNDO/REDO
    const [history, setHistory] = React.useState([]);
    const [historyIndex, setHistoryIndex] = React.useState(-1);

    const isVideo = media.type === 'video' || (media.url && media.url.match(/\.(mp4|webm|mov)$/i));

    React.useEffect(() => {
        if (videoRef.current) videoRef.current.volume = volume / 100;
    }, [volume]);

    // FILTROS CSS
    const getFilterStyle = () => {
        let base = `brightness(${brightness}%) contrast(${contrast}%) saturate(${saturation}%)`;
        let extra = '';
        if (activeFilter !== 'none') {
            const i = filterIntensity / 100;
            switch (activeFilter) {
                case 'vibe': extra = ` sepia(${50 * i}%) hue-rotate(${150 * i}deg)`; break;
                case 'sunset': extra = ` sepia(${30 * i}%) saturate(${150 * i}%) hue-rotate(-15deg)`; break;
                case 'bw': extra = ` grayscale(${100 * i}%)`; break;
                case 'vintage': extra = ` sepia(${80 * i}%) contrast(${120 * i}%)`; break;
            }
        }
        return { filter: `${base}${extra}` };
    };

    // ==========================================================
    // TEXTO — ADICIONAR / EDITAR / DELETAR
    // ==========================================================
    const addText = () => {
        const newText = {
            content: 'Digite algo',
            x: 50,
            y: 50,
            size: 32,
            color: '#ffffff',
            fontFamily: 'Arial',
            fontWeight: 'bold',
            background: 'transparent',
            stroke: false,
            strokeColor: '#000000'
        };
        const newTexts = [...texts, newText];
        setTexts(newTexts);
        setEditingTextIndex(newTexts.length - 1);
        setCurrentText(newText);
        pushHistory({ texts: newTexts, drawStrokes });
    };

    const saveCurrentText = () => {
        if (editingTextIndex === null) return;
        const newTexts = [...texts];
        newTexts[editingTextIndex] = currentText;
        setTexts(newTexts);
        setEditingTextIndex(null);
        setSelectedTextIndex(null);
        pushHistory({ texts: newTexts, drawStrokes });
    };

    const deleteText = (index) => {
        const newTexts = texts.filter((_, i) => i !== index);
        setTexts(newTexts);
        setSelectedTextIndex(null);
        pushHistory({ texts: newTexts, drawStrokes });
    };

    const editText = (index) => {
        setCurrentText(texts[index]);
        setEditingTextIndex(index);
    };

    // ==========================================================
    // DRAG DO TEXTO
    // ==========================================================
    const handleTextDragStart = (index, e) => {
        e.stopPropagation();
        const container = e.currentTarget.closest('[data-media-container]');
        if (!container) return;
        const rect = container.getBoundingClientRect();
        
        const onMove = (ev) => {
            const clientX = ev.touches ? ev.touches[0].clientX : ev.clientX;
            const clientY = ev.touches ? ev.touches[0].clientY : ev.clientY;
            const x = ((clientX - rect.left) / rect.width) * 100;
            const y = ((clientY - rect.top) / rect.height) * 100;
            const newTexts = [...texts];
            newTexts[index] = { ...newTexts[index], x: Math.max(0, Math.min(100, x)), y: Math.max(0, Math.min(100, y)) };
            setTexts(newTexts);
        };

        const onUp = () => {
            document.removeEventListener('mousemove', onMove);
            document.removeEventListener('mouseup', onUp);
            document.removeEventListener('touchmove', onMove);
            document.removeEventListener('touchend', onUp);
            pushHistory({ texts, drawStrokes });
        };

        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onUp);
        document.addEventListener('touchmove', onMove);
        document.addEventListener('touchend', onUp);
    };

    // ==========================================================
    // DESENHO
    // ==========================================================
    const startDraw = (e) => {
        if (activeMode !== 'draw') return;
        const canvas = overlayCanvasRef.current;
        if (!canvas) return;
        const rect = canvas.getBoundingClientRect();
        const x = ((e.clientX || e.touches?.[0]?.clientX) - rect.left) / rect.width;
        const y = ((e.clientY || e.touches?.[0]?.clientY) - rect.top) / rect.height;
        currentStrokeRef.current = [{ x, y }];
        setIsDrawing(true);
    };

    const drawMove = (e) => {
        if (!isDrawing) return;
        const canvas = overlayCanvasRef.current;
        if (!canvas) return;
        const rect = canvas.getBoundingClientRect();
        const x = ((e.clientX || e.touches?.[0]?.clientX) - rect.left) / rect.width;
        const y = ((e.clientY || e.touches?.[0]?.clientY) - rect.top) / rect.height;
        currentStrokeRef.current.push({ x, y });
        drawAllStrokes();
    };

    const endDraw = () => {
        if (!isDrawing) return;
        setIsDrawing(false);
        const newStrokes = [...drawStrokes, { points: currentStrokeRef.current, color: drawColor, size: drawSize }];
        setDrawStrokes(newStrokes);
        currentStrokeRef.current = [];
        pushHistory({ texts, drawStrokes: newStrokes });
    };

    const drawAllStrokes = () => {
        const canvas = overlayCanvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        const allStrokes = [...drawStrokes];
        if (isDrawing && currentStrokeRef.current.length > 0) {
            allStrokes.push({ points: currentStrokeRef.current, color: drawColor, size: drawSize });
        }
        
        allStrokes.forEach(stroke => {
            if (stroke.points.length < 2) return;
            ctx.strokeStyle = stroke.color;
            ctx.lineWidth = stroke.size;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            ctx.beginPath();
            stroke.points.forEach((p, i) => {
                const x = p.x * canvas.width;
                const y = p.y * canvas.height;
                if (i === 0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
            });
            ctx.stroke();
        });
    };

    React.useEffect(() => {
        drawAllStrokes();
    }, [drawStrokes]);

    // ==========================================================
    // UNDO / REDO
    // ==========================================================
    const pushHistory = (state) => {
        const newHistory = history.slice(0, historyIndex + 1);
        newHistory.push(JSON.parse(JSON.stringify(state)));
        setHistory(newHistory);
        setHistoryIndex(newHistory.length - 1);
    };

    const undo = () => {
        if (historyIndex <= 0) return;
        const newIndex = historyIndex - 1;
        setHistoryIndex(newIndex);
        const state = history[newIndex];
        setTexts(state.texts || []);
        setDrawStrokes(state.drawStrokes || []);
    };

    const redo = () => {
        if (historyIndex >= history.length - 1) return;
        const newIndex = historyIndex + 1;
        setHistoryIndex(newIndex);
        const state = history[newIndex];
        setTexts(state.texts || []);
        setDrawStrokes(state.drawStrokes || []);
    };

    // ==========================================================
    // PROCESSAR IMAGEM
    // ==========================================================
    const processImage = () => {
        return new Promise((resolve) => {
            const img = new Image();
            img.crossOrigin = 'anonymous';
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const MAX_WIDTH = 1080;
                let width = img.width, height = img.height;
                if (width > MAX_WIDTH) { height = height * (MAX_WIDTH / width); width = MAX_WIDTH; }
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');

                ctx.filter = getFilterStyle().filter;
                ctx.drawImage(img, 0, 0, width, height);
                ctx.filter = 'none';

                // Desenha strokes
                drawStrokes.forEach(stroke => {
                    if (stroke.points.length < 2) return;
                    ctx.strokeStyle = stroke.color;
                    ctx.lineWidth = stroke.size * (width / 500);
                    ctx.lineCap = 'round';
                    ctx.lineJoin = 'round';
                    ctx.beginPath();
                    stroke.points.forEach((p, i) => {
                        const x = p.x * width, y = p.y * height;
                        if (i === 0) ctx.moveTo(x, y);
                        else ctx.lineTo(x, y);
                    });
                    ctx.stroke();
                });

                // Desenha textos
                texts.forEach(t => {
                    if (!t.content.trim()) return;
                    const fontSize = (t.size / 500) * width;
                    ctx.font = `${t.fontWeight} ${fontSize}px ${t.fontFamily}`;
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    const x = (t.x / 100) * width;
                    const y = (t.y / 100) * height;

                    if (t.background !== 'transparent') {
                        const metrics = ctx.measureText(t.content);
                        const pad = fontSize * 0.3;
                        ctx.fillStyle = t.background;
                        ctx.fillRect(x - metrics.width/2 - pad, y - fontSize/2 - pad, metrics.width + pad*2, fontSize + pad*2);
                    }

                    if (t.stroke) {
                        ctx.strokeStyle = t.strokeColor;
                        ctx.lineWidth = fontSize * 0.1;
                        ctx.strokeText(t.content, x, y);
                    }
                    ctx.fillStyle = t.color;
                    ctx.fillText(t.content, x, y);
                });

                canvas.toBlob((blob) => {
                    if (blob) resolve(new File([blob], `image_${Date.now()}.jpg`, { type: 'image/jpeg' }));
                    else resolve(null);
                }, 'image/jpeg', 0.9);
            };
            img.onerror = () => resolve(null);
            img.src = media.url;
        });
    };

    // ==========================================================
    // PROCESSAR VÍDEO
    // ==========================================================
    const processVideo = () => {
        return new Promise(async (resolve) => {
            try {
                const video = document.createElement('video');
                video.src = media.url;
                video.crossOrigin = 'anonymous';
                video.playsInline = true;
                await new Promise(r => { video.onloadedmetadata = r; video.onerror = r; });

                const canvas = document.createElement('canvas');
                canvas.width = video.videoWidth || 720;
                canvas.height = video.videoHeight || 1280;
                const ctx = canvas.getContext('2d');

                const canvasStream = canvas.captureStream(30);

                let audioTracks = [];
                const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
                const dest = audioCtx.createMediaStreamDestination();

                try {
                    const origSource = audioCtx.createMediaElementSource(video);
                    const origGain = audioCtx.createGain();
                    origGain.gain.value = volume / 100;
                    origSource.connect(origGain);
                    origGain.connect(dest);
                } catch (e) {}

                if (selectedAudio && selectedAudio.mediaUrl) {
                    const audioEl = new Audio(selectedAudio.mediaUrl);
                    audioEl.crossOrigin = 'anonymous';
                    audioEl.loop = true;
                    try {
                        const musicSource = audioCtx.createMediaElementSource(audioEl);
                        const musicGain = audioCtx.createGain();
                        musicGain.gain.value = 0.6;
                        musicSource.connect(musicGain);
                        musicGain.connect(dest);
                        audioEl.play();
                    } catch (e) {}
                }

                dest.stream.getAudioTracks().forEach(t => audioTracks.push(t));

                const finalStream = new MediaStream([
                    ...canvasStream.getVideoTracks(),
                    ...audioTracks
                ]);

                let mimeType = 'video/webm;codecs=vp9,opus';
                if (!MediaRecorder.isTypeSupported(mimeType)) mimeType = 'video/webm';
                if (!MediaRecorder.isTypeSupported(mimeType)) mimeType = 'video/mp4';

                const recorder = new MediaRecorder(finalStream, {
                    mimeType, videoBitsPerSecond: 3000000, audioBitsPerSecond: 128000
                });

                const chunks = [];
                recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };
                recorder.onstop = () => {
                    const cleanMime = mimeType.split(';')[0].trim();
                    const blob = new Blob(chunks, { type: cleanMime });
                    const ext = cleanMime.includes('mp4') ? 'mp4' : 'webm';
                    const file = new File([blob], `video_${Date.now()}.${ext}`, { type: cleanMime });
                    audioCtx.close();
                    resolve(file);
                };

                video.currentTime = 0;
                video.play();
                recorder.start(100);

                const renderFrame = () => {
                    if (video.paused || video.ended) return;
                    
                    ctx.filter = getFilterStyle().filter;
                    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                    ctx.filter = 'none';

                    // Desenha strokes
                    drawStrokes.forEach(stroke => {
                        if (stroke.points.length < 2) return;
                        ctx.strokeStyle = stroke.color;
                        ctx.lineWidth = stroke.size * (canvas.width / 500);
                        ctx.lineCap = 'round';
                        ctx.lineJoin = 'round';
                        ctx.beginPath();
                        stroke.points.forEach((p, i) => {
                            const x = p.x * canvas.width, y = p.y * canvas.height;
                            if (i === 0) ctx.moveTo(x, y);
                            else ctx.lineTo(x, y);
                        });
                        ctx.stroke();
                    });

                    // Desenha textos
                    texts.forEach(t => {
                        if (!t.content.trim()) return;
                        const fontSize = (t.size / 500) * canvas.width;
                        ctx.font = `${t.fontWeight} ${fontSize}px ${t.fontFamily}`;
                        ctx.textAlign = 'center';
                        ctx.textBaseline = 'middle';
                        const x = (t.x / 100) * canvas.width;
                        const y = (t.y / 100) * canvas.height;

                        if (t.background !== 'transparent') {
                            const metrics = ctx.measureText(t.content);
                            const pad = fontSize * 0.3;
                            ctx.fillStyle = t.background;
                            ctx.fillRect(x - metrics.width/2 - pad, y - fontSize/2 - pad, metrics.width + pad*2, fontSize + pad*2);
                        }

                        if (t.stroke) {
                            ctx.strokeStyle = t.strokeColor;
                            ctx.lineWidth = fontSize * 0.1;
                            ctx.strokeText(t.content, x, y);
                        }
                        ctx.fillStyle = t.color;
                        ctx.fillText(t.content, x, y);
                    });

                    setProcessingProgress(Math.round((video.currentTime / video.duration) * 100));
                    requestAnimationFrame(renderFrame);
                };

                video.onplay = () => requestAnimationFrame(renderFrame);
                video.onended = () => setTimeout(() => { if (recorder.state !== 'inactive') recorder.stop(); }, 200);
                setTimeout(() => { if (recorder.state !== 'inactive') { video.pause(); recorder.stop(); } }, 120000);
            } catch (e) {
                console.error(e);
                resolve(null);
            }
        });
    };

    const handleSend = async () => {
        setIsProcessing(true);
        setProcessingProgress(0);
        try {
            let file = isVideo ? await processVideo() : await processImage();
            if (file) {
                onSend(file, isVideo ? 'video' : 'image', selectedAudio, texts.map(t => t.content).join(' '));
            } else {
                const type = media.type === 'image' ? 'image/jpeg' : (media.mimeType || 'video/mp4');
                const ext = media.type === 'image' ? 'jpg' : 'mp4';
                const fallbackFile = new File([media.blob], `media_${Date.now()}.${ext}`, { type });
                onSend(fallbackFile, media.type, selectedAudio, '');
            }
        } catch (e) {
            const type = media.type === 'image' ? 'image/jpeg' : (media.mimeType || 'video/mp4');
            const ext = media.type === 'image' ? 'jpg' : 'mp4';
            const fallbackFile = new File([media.blob], `media_${Date.now()}.${ext}`, { type });
            onSend(fallbackFile, media.type, selectedAudio, '');
        } finally {
            setIsProcessing(false);
        }
    };

    const CustomSlider = ({ value, onChange, min = 0, max = 200, label }) => (
        <div className="w-full">
            <div className="flex justify-between text-white text-xs mb-2">
                <span>{label}</span><span>{value}</span>
            </div>
            <input type="range" min={min} max={max} value={value} onChange={(e) => onChange(parseInt(e.target.value))}
                className="w-full h-1 bg-gray-700 rounded-lg appearance-none outline-none cursor-pointer"
                style={{ background: `linear-gradient(to right, #a855f7 0%, #a855f7 ${(value - min) / (max - min) * 100}%, #404040 ${(value - min) / (max - min) * 100}%, #404040 100%)` }}
            />
        </div>
    );

    return (
        <div className="fixed inset-0 bg-black z-[110] flex flex-col font-sans select-none overflow-hidden" data-name="media-editor">
            {/* Top Bar */}
            <div className="absolute top-0 left-0 right-0 p-4 flex justify-between items-start z-30 pointer-events-none">
                <div className="flex gap-2 pointer-events-auto">
                    <button onClick={onCancel} className="w-11 h-11 rounded-full bg-black/40 backdrop-blur-xl flex items-center justify-center border border-white/10 text-white active:scale-95">
                        <div className="icon-x text-xl"></div>
                    </button>
                    <button onClick={undo} disabled={historyIndex <= 0} className="w-11 h-11 rounded-full bg-black/40 backdrop-blur-xl flex items-center justify-center border border-white/10 text-white active:scale-95 disabled:opacity-30">
                        <div className="icon-undo text-lg"></div>
                    </button>
                    <button onClick={redo} disabled={historyIndex >= history.length - 1} className="w-11 h-11 rounded-full bg-black/40 backdrop-blur-xl flex items-center justify-center border border-white/10 text-white active:scale-95 disabled:opacity-30">
                        <div className="icon-redo text-lg"></div>
                    </button>
                </div>

                <button onClick={handleSend} disabled={isProcessing} className="pointer-events-auto h-11 px-6 rounded-full bg-brand-600 backdrop-blur-xl flex items-center justify-center border border-white/10 text-white font-semibold active:scale-95 disabled:opacity-50">
                    Avançar
                </button>
            </div>

            {/* Media Preview + Texts + Canvas */}
            <div data-media-container className="flex-1 w-full h-full relative flex items-center justify-center bg-[#0a0a0f] pb-24 overflow-hidden"
                onMouseDown={startDraw}
                onMouseMove={drawMove}
                onMouseUp={endDraw}
                onMouseLeave={endDraw}
                onTouchStart={startDraw}
                onTouchMove={drawMove}
                onTouchEnd={endDraw}
            >
                {!isVideo ? (
                    <img src={media.url} className="w-full h-full object-contain pointer-events-none" style={getFilterStyle()} />
                ) : (
                    <video ref={videoRef} src={media.url} autoPlay loop playsInline className="w-full h-full object-contain pointer-events-none" style={getFilterStyle()} />
                )}

                {/* Canvas de desenho */}
                <canvas
                    ref={overlayCanvasRef}
                    width={720}
                    height={1280}
                    className="absolute inset-0 w-full h-full pointer-events-none z-10"
                    style={{ objectFit: 'contain' }}
                />

                {/* Textos renderizados */}
                {texts.map((t, i) => (
                    <div
                        key={i}
                        className="absolute z-20 select-none cursor-move"
                        style={{
                            left: `${t.x}%`,
                            top: `${t.y}%`,
                            transform: 'translate(-50%, -50%)',
                            fontSize: `${t.size}px`,
                            color: t.color,
                            fontFamily: t.fontFamily,
                            fontWeight: t.fontWeight,
                            background: t.background,
                            WebkitTextStroke: t.stroke ? `2px ${t.strokeColor}` : 'none',
                            textShadow: '0 0 8px rgba(0,0,0,0.8)',
                            padding: t.background !== 'transparent' ? '8px 16px' : '0',
                            borderRadius: t.background !== 'transparent' ? '8px' : '0',
                            pointerEvents: activeMode === 'draw' ? 'none' : 'auto'
                        }}
                        onMouseDown={(e) => handleTextDragStart(i, e)}
                        onTouchStart={(e) => handleTextDragStart(i, e)}
                        onClick={(e) => {
                            e.stopPropagation();
                            setSelectedTextIndex(i);
                        }}
                    >
                        {t.content}

                        {/* Botões X e Lápis quando selecionado */}
                        {selectedTextIndex === i && (
                            <>
                                <button
                                    onClick={(e) => { e.stopPropagation(); deleteText(i); }}
                                    className="absolute -top-3 -right-3 w-7 h-7 rounded-full bg-red-500 flex items-center justify-center border-2 border-white shadow-lg"
                                >
                                    <div className="icon-x text-white text-xs"></div>
                                </button>
                                <button
                                    onClick={(e) => { e.stopPropagation(); editText(i); }}
                                    className="absolute -top-3 -left-3 w-7 h-7 rounded-full bg-blue-500 flex items-center justify-center border-2 border-white shadow-lg"
                                >
                                    <div className="icon-pencil text-white text-xs"></div>
                                </button>
                            </>
                        )}
                    </div>
                ))}
            </div>

            {/* Text Editor Overlay — Interfacezinha SÓ para texto */}
            {editingTextIndex !== null && (
                <div className="absolute inset-0 z-50 flex flex-col bg-black/95 backdrop-blur-2xl animate-fade-in">
                    <div className="flex justify-between items-center p-4 border-b border-white/10">
                        <button onClick={() => setEditingTextIndex(null)} className="text-white/70 hover:text-white px-4 py-2 font-medium">
                            Cancelar
                        </button>
                        <h3 className="text-white font-bold">Editar Texto</h3>
                        <button onClick={saveCurrentText} className="bg-white text-black px-5 py-2 rounded-full font-semibold hover:bg-gray-200">
                            OK
                        </button>
                    </div>

                    <div className="flex-1 flex items-center justify-center p-6">
                        <textarea
                            value={currentText.content}
                            onChange={(e) => setCurrentText({ ...currentText, content: e.target.value })}
                            placeholder="Digite..."
                            style={{
                                fontSize: `${currentText.size}px`,
                                color: currentText.color,
                                fontFamily: currentText.fontFamily,
                                fontWeight: currentText.fontWeight,
                                textAlign: 'center',
                                background: 'transparent',
                                WebkitTextStroke: currentText.stroke ? `2px ${currentText.strokeColor}` : 'none',
                                textShadow: '0 0 8px rgba(0,0,0,0.8)'
                            }}
                            className="w-full bg-transparent outline-none resize-none overflow-hidden placeholder-white/30"
                            rows={4}
                            autoFocus
                        />
                    </div>

                    <div className="p-4 bg-black/80 border-t border-white/10 space-y-4">
                        {/* Cores */}
                        <div>
                            <p className="text-white/60 text-xs mb-2">Cor</p>
                            <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                                {['#ffffff', '#000000', '#ff0000', '#00ff00', '#0000ff', '#ffff00', '#ff00ff', '#00ffff', '#ffa500', '#ff69b4'].map(c => (
                                    <button
                                        key={c}
                                        onClick={() => setCurrentText({ ...currentText, color: c })}
                                        className={`w-8 h-8 rounded-full border-2 flex-shrink-0 ${currentText.color === c ? 'border-white' : 'border-white/20'}`}
                                        style={{ background: c }}
                                    />
                                ))}
                            </div>
                        </div>

                        {/* Fonte */}
                        <div>
                            <p className="text-white/60 text-xs mb-2">Fonte</p>
                            <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                                {['Arial', 'Georgia', 'Courier New', 'Impact', 'Comic Sans MS', 'Verdana'].map(f => (
                                    <button
                                        key={f}
                                        onClick={() => setCurrentText({ ...currentText, fontFamily: f })}
                                        className={`px-3 py-1.5 rounded-full text-xs whitespace-nowrap ${currentText.fontFamily === f ? 'bg-white text-black' : 'bg-white/10 text-white'}`}
                                        style={{ fontFamily: f }}
                                    >
                                        {f}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Tamanho */}
                        <CustomSlider label="Tamanho" value={currentText.size} onChange={(v) => setCurrentText({ ...currentText, size: v })} min={12} max={120} />

                        {/* Fundo */}
                        <div>
                            <p className="text-white/60 text-xs mb-2">Fundo</p>
                            <div className="flex gap-2">
                                {['transparent', 'rgba(0,0,0,0.5)', '#000000', '#ffffff', '#ff0000', '#0000ff'].map(bg => (
                                    <button
                                        key={bg}
                                        onClick={() => setCurrentText({ ...currentText, background: bg })}
                                        className={`w-8 h-8 rounded-md border-2 ${currentText.background === bg ? 'border-white' : 'border-white/20'}`}
                                        style={{ background: bg === 'transparent' ? 'repeating-conic-gradient(#666 0% 25%, #999 0% 50%) 50% / 10px 10px' : bg }}
                                    />
                                ))}
                            </div>
                        </div>

                        {/* Borda */}
                        <div className="flex items-center gap-3">
                            <button
                                onClick={() => setCurrentText({ ...currentText, stroke: !currentText.stroke })}
                                className={`px-4 py-2 rounded-full text-sm font-bold ${currentText.stroke ? 'bg-purple-600 text-white' : 'bg-white/10 text-white'}`}
                            >
                                {currentText.stroke ? '✓ Contorno' : 'Contorno'}
                            </button>
                            {currentText.stroke && (
                                <input type="color" value={currentText.strokeColor} onChange={(e) => setCurrentText({ ...currentText, strokeColor: e.target.value })} className="w-10 h-10 rounded" />
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Editing Panels — Ajustes / Filtros / Som / Desenho */}
            {(activeMode === 'adjust' || activeMode === 'filter' || activeMode === 'sound' || activeMode === 'draw') && (
                <div className="absolute bottom-[80px] left-0 right-0 bg-black/90 backdrop-blur-xl border-t border-white/10 p-5 z-30 rounded-t-3xl">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="text-white font-semibold text-base capitalize">
                            {activeMode === 'adjust' ? 'Ajustes' : activeMode === 'filter' ? 'Filtros' : activeMode === 'sound' ? 'Som' : 'Desenho'}
                        </h3>
                        <button onClick={() => setActiveMode('none')} className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center">
                            <div className="icon-check text-white text-sm"></div>
                        </button>
                    </div>

                    {activeMode === 'adjust' && (
                        <div className="space-y-4">
                            <CustomSlider label="Brilho" value={brightness} onChange={setBrightness} min={0} max={200} />
                            <CustomSlider label="Contraste" value={contrast} onChange={setContrast} min={0} max={200} />
                            <CustomSlider label="Saturação" value={saturation} onChange={setSaturation} min={0} max={200} />
                        </div>
                    )}

                    {activeMode === 'filter' && (
                        <div className="space-y-4">
                            <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
                                {['none', 'vibe', 'sunset', 'bw', 'vintage'].map(f => (
                                    <div key={f} className="flex flex-col items-center gap-1 cursor-pointer flex-shrink-0" onClick={() => setActiveFilter(f)}>
                                        <div className={`w-14 h-14 rounded-xl border-2 overflow-hidden ${activeFilter === f ? 'border-purple-500' : 'border-transparent'}`}>
                                            <div className="w-full h-full bg-gray-800" style={{
                                                backgroundImage: `url(${media.url})`,
                                                backgroundSize: 'cover',
                                                backgroundPosition: 'center',
                                                filter: f === 'vibe' ? 'sepia(50%) hue-rotate(150deg)' : f === 'sunset' ? 'sepia(30%) saturate(150%) hue-rotate(-15deg)' : f === 'bw' ? 'grayscale(100%)' : f === 'vintage' ? 'sepia(80%) contrast(120%)' : 'none'
                                            }}></div>
                                        </div>
                                        <span className="text-[10px] text-white/70">{f === 'none' ? 'Normal' : f}</span>
                                    </div>
                                ))}
                            </div>
                            {activeFilter !== 'none' && <CustomSlider label="Intensidade" value={filterIntensity} onChange={setFilterIntensity} min={0} max={100} />}
                        </div>
                    )}

                    {activeMode === 'sound' && isVideo && (
                        <CustomSlider label="Volume do Vídeo" value={volume} onChange={setVolume} min={0} max={100} />
                    )}

                    {activeMode === 'draw' && (
                        <div className="space-y-4">
                            <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                                {['#ff0000', '#ffffff', '#000000', '#ffff00', '#00ff00', '#00ffff', '#ff00ff'].map(c => (
                                    <button key={c} onClick={() => setDrawColor(c)} className={`w-8 h-8 rounded-full border-2 flex-shrink-0 ${drawColor === c ? 'border-white' : 'border-white/20'}`} style={{ background: c }} />
                                ))}
                            </div>
                            <CustomSlider label="Tamanho do traço" value={drawSize} onChange={setDrawSize} min={1} max={30} />
                            <button onClick={() => { setDrawStrokes([]); pushHistory({ texts, drawStrokes: [] }); }} className="w-full py-2 bg-red-500/20 text-red-400 rounded-lg font-bold">
                                Limpar desenhos
                            </button>
                        </div>
                    )}
                </div>
            )}

            {/* Bottom Bar */}
            <div className="absolute bottom-0 left-0 right-0 h-[80px] bg-black border-t border-white/10 flex justify-around items-center px-3 z-40 overflow-x-auto scrollbar-hide">
                <button onClick={() => { setActiveMode('none'); addText(); }} className="flex flex-col items-center gap-1 p-2 text-white/60 hover:text-white min-w-[60px]">
                    <div className="icon-type text-xl"></div>
                    <span className="text-[10px]">Texto</span>
                </button>
                <button onClick={() => setActiveMode(activeMode === 'draw' ? 'none' : 'draw')} className={`flex flex-col items-center gap-1 p-2 min-w-[60px] ${activeMode === 'draw' ? 'text-purple-400' : 'text-white/60 hover:text-white'}`}>
                    <div className="icon-pencil text-xl"></div>
                    <span className="text-[10px]">Desenhar</span>
                </button>
                <button onClick={() => setActiveMode(activeMode === 'filter' ? 'none' : 'filter')} className={`flex flex-col items-center gap-1 p-2 min-w-[60px] ${activeMode === 'filter' ? 'text-purple-400' : 'text-white/60 hover:text-white'}`}>
                    <div className="icon-sparkles text-xl"></div>
                    <span className="text-[10px]">Filtros</span>
                </button>
                <button onClick={() => setActiveMode(activeMode === 'adjust' ? 'none' : 'adjust')} className={`flex flex-col items-center gap-1 p-2 min-w-[60px] ${activeMode === 'adjust' ? 'text-purple-400' : 'text-white/60 hover:text-white'}`}>
                    <div className="icon-sliders text-xl"></div>
                    <span className="text-[10px]">Ajustar</span>
                </button>
                {isVideo && (
                    <button onClick={() => setActiveMode(activeMode === 'sound' ? 'none' : 'sound')} className={`flex flex-col items-center gap-1 p-2 min-w-[60px] ${activeMode === 'sound' ? 'text-purple-400' : 'text-white/60 hover:text-white'}`}>
                        <div className="icon-volume-2 text-xl"></div>
                        <span className="text-[10px]">Som</span>
                    </button>
                )}
            </div>

            {/* Processing Overlay */}
            {isProcessing && (
                <div className="absolute inset-0 bg-black/90 backdrop-blur-xl z-[100] flex flex-col items-center justify-center">
                    <div className="relative w-24 h-24 mb-8">
                        <div className="absolute inset-0 border-4 border-purple-500/30 rounded-full"></div>
                        <div className="absolute inset-0 border-4 border-purple-500 rounded-full border-t-transparent animate-spin"></div>
                    </div>
                    <span className="text-white font-bold text-2xl">Preparando...</span>
                    <span className="text-white/50 text-sm mt-3">{isVideo && processingProgress > 0 ? `${processingProgress}%` : 'Processando...'}</span>
                </div>
            )}

            <style jsx>{`
                .scrollbar-hide::-webkit-scrollbar { display: none; }
                .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
                input[type=range]::-webkit-slider-thumb {
                    -webkit-appearance: none; width: 16px; height: 16px; border-radius: 50%;
                    background: white; border: 2px solid #a855f7; cursor: pointer;
                }
            `}</style>
        </div>
    );
}

window.MediaEditor = MediaEditor;