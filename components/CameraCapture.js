function CameraCapture({ onCapture, onClose, photoOnly = false }) {
    const videoRef = React.useRef(null);
    const canvasRef = React.useRef(null);
    const arCanvasRef = React.useRef(null);
    const streamRef = React.useRef(null);
    const mediaRecorderRef = React.useRef(null);
    const recordedChunksRef = React.useRef([]);
    const holdTimerRef = React.useRef(null);
    const recordingDurationRef = React.useRef(null);
    const animationFrameRef = React.useRef(null);
    const faceLandmarkerRef = React.useRef(null);
    const lastVideoTimeRef = React.useRef(-1);
    const audioPlayerRef = React.useRef(null);
    const filterImageRef = React.useRef(new Image());
    const searchInputRef = React.useRef(null);

    const [hasPermission, setHasPermission] = React.useState(null);
    const [audios, setAudios] = React.useState([]);
    const [isLoadingAudios, setIsLoadingAudios] = React.useState(true);
    const [showAudioMenu, setShowAudioMenu] = React.useState(false);
    const [selectedAudio, setSelectedAudio] = React.useState(null);
    const [facingMode, setFacingMode] = React.useState('user');
    const [isRecording, setIsRecording] = React.useState(false);
    const [recordingTime, setRecordingTime] = React.useState(0);
    const [previewMedia, setPreviewMedia] = React.useState(null);
    const [showFlash, setShowFlash] = React.useState(false);
    const [gridVisible, setGridVisible] = React.useState(false);
    const [zoom, setZoom] = React.useState(1);
    const [capabilities, setCapabilities] = React.useState(null);
    const [arEnabled, setArEnabled] = React.useState(false);
    const [showFilterMenu, setShowFilterMenu] = React.useState(false);
    const [selectedFilter, setSelectedFilter] = React.useState('none');
    const [originalVolume, setOriginalVolume] = React.useState(0.8);
    const [musicVolume, setMusicVolume] = React.useState(0.6);
    const [showVolumeControls, setShowVolumeControls] = React.useState(false);
    const [searchQuery, setSearchQuery] = React.useState('');
    const [filteredAudios, setFilteredAudios] = React.useState([]);
    
    // Audio Context refs for mixing
    const audioContextRef = React.useRef(null);
    const micGainRef = React.useRef(null);
    const musicGainRef = React.useRef(null);
    const destRef = React.useRef(null);
    const mixedStreamRef = React.useRef(null);
    const sourceNodeRef = React.useRef(null);
    const micSourceRef = React.useRef(null);
    const finalStreamRef = React.useRef(null);
    const [filters, setFilters] = React.useState([
        { id: 'none', name: 'Nenhum', type: 'none', url: '' },
        { id: 'glasses_thug', name: 'Óculos Thug', type: 'eyes', url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/e8/Sunglasses_icon.svg/512px-Sunglasses_icon.svg.png' },
        { id: 'mask_anon', name: 'Máscara', type: 'face', url: 'https://cdn-icons-png.flaticon.com/512/2821/2821035.png' },
        { id: 'hat_crown', name: 'Coroa', type: 'head', url: 'https://cdn-icons-png.flaticon.com/512/1004/1004733.png' }
    ]);

    // Filtrar áudios baseado na pesquisa
    React.useEffect(() => {
        if (searchQuery.trim() === '') {
            setFilteredAudios(audios);
        } else {
            const query = searchQuery.toLowerCase().trim();
            const filtered = audios.filter(audio => 
                audio.name.toLowerCase().includes(query) || 
                audio.artistName.toLowerCase().includes(query)
            );
            setFilteredAudios(filtered);
        }
    }, [searchQuery, audios]);

    // Focar no campo de pesquisa quando o menu abrir
    React.useEffect(() => {
        if (showAudioMenu && searchInputRef.current) {
            setTimeout(() => {
                searchInputRef.current.focus();
            }, 100);
        }
    }, [showAudioMenu]);

    React.useEffect(() => {
        if (typeof firebase !== 'undefined') {
            const db = firebase.database();
            const musicRef = db.ref('studio_musics');
            
            const handleData = (snap) => {
                if (snap.exists()) {
                    const data = snap.val();
                    const audioList = Object.keys(data).map(k => {
                        const item = data[k];
                        return {
                            id: k,
                            name: item.title || 'Música sem título',
                            artistName: item.artistName || item.description || 'Desconhecido',
                            coverUrl: item.bannerUrl || '',
                            mediaUrl: item.audioUrl || ''
                        };
                    });
                    setAudios(audioList.reverse());
                    setFilteredAudios(audioList.reverse());
                } else {
                    setAudios([]);
                    setFilteredAudios([]);
                }
                setIsLoadingAudios(false);
            };

            musicRef.on('value', handleData);

            return () => {
                musicRef.off('value', handleData);
            };
        }
    }, []);

    const setupAudioMixer = () => {
        if (!streamRef.current || !audioPlayerRef.current) return;
        
        try {
            if (!audioContextRef.current) {
                audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
                
                const ctx = audioContextRef.current;
                destRef.current = ctx.createMediaStreamDestination();
                
                micSourceRef.current = ctx.createMediaStreamSource(streamRef.current);
                micGainRef.current = ctx.createGain();
                micGainRef.current.gain.value = originalVolume;
                micSourceRef.current.connect(micGainRef.current);
                micGainRef.current.connect(destRef.current);

                sourceNodeRef.current = ctx.createMediaElementSource(audioPlayerRef.current);
                musicGainRef.current = ctx.createGain();
                musicGainRef.current.gain.value = musicVolume;
                sourceNodeRef.current.connect(musicGainRef.current);
                musicGainRef.current.connect(destRef.current);
                musicGainRef.current.connect(ctx.destination);
                
                finalStreamRef.current = new MediaStream();
                streamRef.current.getVideoTracks().forEach(track => {
                    finalStreamRef.current.addTrack(track);
                });
                destRef.current.stream.getAudioTracks().forEach(track => {
                    finalStreamRef.current.addTrack(track);
                });
            } else if (finalStreamRef.current) {
                if (sourceNodeRef.current) sourceNodeRef.current.disconnect();
                sourceNodeRef.current = audioContextRef.current.createMediaElementSource(audioPlayerRef.current);
                sourceNodeRef.current.connect(musicGainRef.current);
            }
        } catch (e) {
            console.error("Error setting up audio mixer:", e);
        }
    };

    React.useEffect(() => {
        if (micGainRef.current) micGainRef.current.gain.value = originalVolume;
        if (musicGainRef.current) musicGainRef.current.gain.value = musicVolume;
    }, [originalVolume, musicVolume]);

    React.useEffect(() => {
        if (audioPlayerRef.current && selectedAudio) {
            setupAudioMixer();
        }
    }, [selectedAudio]);

    React.useEffect(() => {
        let isMounted = true;
        const initAR = async () => {
            try {
                if (!window.FaceLandmarker) {
                    const module = await import("https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14");
                    window.FaceLandmarker = module.FaceLandmarker;
                    window.FilesetResolver = module.FilesetResolver;
                }
                const vision = await window.FilesetResolver.forVisionTasks(
                    "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm"
                );
                const landmarker = await window.FaceLandmarker.createFromOptions(
                    vision,
                    {
                        baseOptions: {
                            modelAssetPath: "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/latest/face_landmarker.task",
                            delegate: "GPU"
                        },
                        runningMode: "VIDEO",
                        numFaces: 1
                    }
                );
                if (isMounted) {
                    faceLandmarkerRef.current = landmarker;
                    setArEnabled(true);
                }
            } catch (e) {
                console.error("Error initializing AR:", e);
            }
        };

        initAR();

        return () => { 
            isMounted = false; 
            if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
            if (faceLandmarkerRef.current) faceLandmarkerRef.current.close();
        };
    }, []);

    React.useEffect(() => {
        const filter = filters.find(f => f.id === selectedFilter);
        if (filter && filter.url) {
            filterImageRef.current.src = filter.url;
            filterImageRef.current.crossOrigin = "anonymous";
        }
    }, [selectedFilter, filters]);

    const startCamera = async () => {
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop());
        }

        try {
            const constraints = {
                video: {
                    facingMode,
                    width: { ideal: 1280, max: 1920 },
                    height: { ideal: 720, max: 1080 },
                    frameRate: { ideal: 30, max: 60 }
                },
                audio: true
            };
            
            const stream = await navigator.mediaDevices.getUserMedia(constraints);
            streamRef.current = stream;
            
            if (videoRef.current) {
                videoRef.current.srcObject = stream;
                setHasPermission(true);
                
                videoRef.current.onloadedmetadata = () => {
                    videoRef.current.play().catch(e => console.error("Erro ao iniciar vídeo:", e));
                };
            }

            const track = stream.getVideoTracks()[0];
            if (track.getCapabilities) {
                setCapabilities(track.getCapabilities());
            }
        } catch (err) {
            console.error("Camera access denied or error:", err);
            setHasPermission(false);
        }
    };

    React.useEffect(() => {
        startCamera();
        return () => {
            if (streamRef.current) {
                streamRef.current.getTracks().forEach(track => track.stop());
            }
            clearInterval(recordingDurationRef.current);
        };
    }, [facingMode]);

    const predictWebcam = () => {
        if (!isPredictingRef.current) return;
        const video = videoRef.current;
        const arCanvas = arCanvasRef.current;
        if (!video || !arCanvas || !faceLandmarkerRef.current) return;

        const filter = filters.find(f => f.id === selectedFilter);
        
        arCanvas.width = video.videoWidth;
        arCanvas.height = video.videoHeight;
        
        const ctx = arCanvas.getContext("2d");
        ctx.clearRect(0, 0, arCanvas.width, arCanvas.height);

        if (facingMode === 'user') {
            ctx.translate(arCanvas.width, 0);
            ctx.scale(-1, 1);
        }

        if (filter.id !== 'none' && video.currentTime !== lastVideoTimeRef.current) {
            lastVideoTimeRef.current = video.currentTime;
            
            try {
                const startTimeMs = performance.now();
                const results = faceLandmarkerRef.current.detectForVideo(video, startTimeMs);

                if (results.faceLandmarks && results.faceLandmarks.length > 0) {
                    const face = results.faceLandmarks[0];
                    const img = filterImageRef.current;

                    if (img.complete && img.naturalHeight !== 0) {
                        if (filter.type === 'eyes') {
                            const leftEye = face[33];
                            const rightEye = face[263];
                            const x1 = leftEye.x * arCanvas.width;
                            const y1 = leftEye.y * arCanvas.height;
                            const x2 = rightEye.x * arCanvas.width;
                            const y2 = rightEye.y * arCanvas.height;
                            
                            const centerX = (x1 + x2) / 2;
                            const centerY = (y1 + y2) / 2;
                            const eyeDistance = Math.hypot(x2 - x1, y2 - y1);
                            const angle = Math.atan2(y2 - y1, x2 - x1);
                            
                            const width = eyeDistance * 2.2;
                            const height = width * 0.55;

                            ctx.save();
                            ctx.translate(centerX, centerY);
                            ctx.rotate(angle);
                            ctx.drawImage(img, -width / 2, -height / 2, width, height);
                            ctx.restore();
                        } else if (filter.type === 'face' || filter.type === 'head') {
                            const left = face[234];
                            const right = face[454];

                            const faceWidth = Math.abs((right.x - left.x) * arCanvas.width);
                            const centerX = face[1].x * arCanvas.width;
                            const centerY = (filter.type === 'head' ? face[10].y : face[1].y) * arCanvas.height;
                            
                            const width = faceWidth * 1.5;
                            const height = width * (img.naturalHeight / img.naturalWidth);
                            
                            let finalY = centerY - height / 2;
                            if(filter.type === 'head') {
                                finalY -= height / 2;
                            }

                            ctx.save();
                            ctx.translate(centerX, finalY + height/2);
                            ctx.drawImage(img, -width / 2, -height / 2, width, height);
                            ctx.restore();
                        }
                    }
                }
            } catch (e) {
                console.error("Error detecting face", e);
            }
        }

        if (isPredictingRef.current) {
            animationFrameRef.current = requestAnimationFrame(predictWebcam);
        }
    };

    const isPredictingRef = React.useRef(false);

    React.useEffect(() => {
        if (hasPermission && selectedFilter !== 'none') {
            isPredictingRef.current = true;
            predictWebcam();
        } else {
            isPredictingRef.current = false;
        }
        return () => {
            isPredictingRef.current = false;
            if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
        };
    }, [hasPermission, selectedFilter, facingMode]);

    const handleZoomChange = (e) => {
        const newZoom = parseFloat(e.target.value);
        setZoom(newZoom);
        const track = streamRef.current?.getVideoTracks()[0];
        if (track && capabilities?.zoom) {
            track.applyConstraints({ advanced: [{ zoom: newZoom }] }).catch(console.error);
        }
    };

    const takePhoto = () => {
        if (!videoRef.current || !canvasRef.current) return;
        
        setShowFlash(true);
        setTimeout(() => setShowFlash(false), 200);

        const video = videoRef.current;
        const canvas = canvasRef.current;
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        
        const ctx = canvas.getContext('2d');
        if (facingMode === 'user') {
            ctx.translate(canvas.width, 0);
            ctx.scale(-1, 1);
        }
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

        if (arCanvasRef.current && selectedFilter !== 'none') {
            ctx.save();
            if (facingMode === 'user') {
                 ctx.scale(-1, 1);
                 ctx.translate(-canvas.width, 0);
            }
            ctx.drawImage(arCanvasRef.current, 0, 0);
            ctx.restore();
        }
        
        try {
            canvas.toBlob((blob) => {
                if(blob) {
                    const url = URL.createObjectURL(blob);
                    setPreviewMedia({ type: 'image', url, blob });
                } else {
                    console.error("Failed to create blob from canvas");
                }
            }, 'image/jpeg', 0.9);
        } catch (e) {
            console.error("Error converting canvas to blob:", e);
        }
    };

    const startRecording = () => {
        if (!streamRef.current) return;
        
        recordedChunksRef.current = [];
        
        let mimeType = '';
        if (MediaRecorder.isTypeSupported('video/webm; codecs=vp9')) {
            mimeType = 'video/webm; codecs=vp9';
        } else if (MediaRecorder.isTypeSupported('video/webm')) {
            mimeType = 'video/webm';
        } else if (MediaRecorder.isTypeSupported('video/mp4')) {
            mimeType = 'video/mp4';
        }
        
        let streamToRecord = streamRef.current;
        
        if (selectedAudio && finalStreamRef.current) {
            streamToRecord = finalStreamRef.current;
        }

        const options = mimeType ? { mimeType, videoBitsPerSecond: 2500000, audioBitsPerSecond: 128000 } : { videoBitsPerSecond: 2500000, audioBitsPerSecond: 128000 };
        
        try {
            mediaRecorderRef.current = new MediaRecorder(streamToRecord, options);
        } catch (e) {
            mediaRecorderRef.current = new MediaRecorder(streamToRecord, { videoBitsPerSecond: 2500000, audioBitsPerSecond: 128000 });
        }

        mediaRecorderRef.current.ondataavailable = (e) => {
            if (e.data.size > 0) recordedChunksRef.current.push(e.data);
        };

        mediaRecorderRef.current.onstop = () => {
            clearInterval(recordingDurationRef.current);
            const actualMimeType = mediaRecorderRef.current.mimeType || mimeType || 'video/mp4';
            const cleanMimeType = actualMimeType.split(';')[0].trim();
            const blob = new Blob(recordedChunksRef.current, { type: cleanMimeType });
            const url = URL.createObjectURL(blob);
            setPreviewMedia({ type: 'video', url, blob, mimeType: cleanMimeType });
            setIsRecording(false);
            setRecordingTime(0);
        };

        if (selectedAudio && audioPlayerRef.current && audioContextRef.current) {
            audioContextRef.current.resume();
            audioPlayerRef.current.currentTime = 0;
            audioPlayerRef.current.play().catch(console.error);
        }

        mediaRecorderRef.current.start();
        setIsRecording(true);
        
        recordingDurationRef.current = setInterval(() => {
            setRecordingTime(prev => {
                if (prev >= 59) {
                    stopRecording();
                    return 60;
                }
                return prev + 1;
            });
        }, 1000);
    };

    const stopRecording = () => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
            mediaRecorderRef.current.stop();
        }
        if (selectedAudio && audioPlayerRef.current) {
            audioPlayerRef.current.pause();
        }
    };

    const pressTimeRef = React.useRef(0);

    const handleButtonPress = () => {
        if (photoOnly) return;
        
        pressTimeRef.current = Date.now();

        if (selectedAudio) {
            if (isRecording) {
                stopRecording();
            } else {
                startRecording();
            }
            return;
        }

        holdTimerRef.current = setTimeout(() => {
            startRecording();
        }, 400);
    };

    const handleButtonRelease = () => {
        if (photoOnly) return;
        
        if (selectedAudio) {
            if (isRecording && Date.now() - pressTimeRef.current > 500) {
                stopRecording();
            }
            return;
        }

        if (holdTimerRef.current) {
            clearTimeout(holdTimerRef.current);
        }
        
        if (isRecording) {
            stopRecording();
        } else {
            takePhoto();
        }
    };

    if (hasPermission === false) {
        return (
            <div className="fixed inset-0 bg-gradient-to-br from-gray-900 via-black to-gray-900 z-[100] flex flex-col items-center justify-center text-white" data-name="camera-denied" data-file="components/CameraCapture.js">
                <div className="w-24 h-24 rounded-full bg-red-500/10 flex items-center justify-center mb-6">
                    <div className="icon-camera-off text-5xl text-red-400"></div>
                </div>
                <h2 className="text-2xl font-bold mb-2 bg-gradient-to-r from-red-400 to-pink-400 bg-clip-text text-transparent">Acesso Negado</h2>
                <p className="text-gray-400 mb-8">Permita o acesso à câmera para continuar</p>
                <button onClick={onClose} className="px-8 py-3 bg-gray-800/50 backdrop-blur-sm rounded-2xl hover:bg-gray-700/50 transition-all duration-300 border border-gray-700/50">Fechar</button>
            </div>
        );
    }

    return (
        <div className="fixed inset-0 bg-black z-[100] flex flex-col select-none" data-name="camera-capture" data-file="components/CameraCapture.js">
            {/* Top Bar - Glass morphism */}
            <div className={`absolute top-0 left-0 right-0 z-20 ${previewMedia ? 'hidden' : ''}`}>
                <div className="mx-4 mt-4">
                    <div className="backdrop-blur-xl bg-black/30 rounded-3xl border border-white/10 px-4 py-3 flex items-center justify-between shadow-2xl">
                        <button onClick={onClose} className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-all duration-300 backdrop-blur-sm">
                            <div className="icon-x text-white text-lg"></div>
                        </button>
                        
                        <button 
                            onClick={() => setShowAudioMenu(true)} 
                            className={`flex items-center gap-2 px-4 py-2 rounded-full transition-all duration-300 backdrop-blur-sm ${
                                selectedAudio 
                                    ? 'bg-gradient-to-r from-purple-500/20 to-pink-500/20 border border-purple-400/30' 
                                    : 'bg-white/10 hover:bg-white/20 border border-white/10'
                            }`}
                        >
                            <div className={`icon-music text-sm ${selectedAudio ? 'text-purple-400' : 'text-white'}`}></div>
                            <span className="text-xs font-medium truncate max-w-[100px]">
                                {selectedAudio ? selectedAudio.name : 'Adicionar Som'}
                            </span>
                            {selectedAudio && (
                                <div className="w-5 h-5 rounded-full bg-purple-400/20 flex items-center justify-center">
                                    <div className="icon-check text-[10px] text-purple-400"></div>
                                </div>
                            )}
                        </button>

                        <div className="flex gap-2">
                            <button 
                                onClick={() => setGridVisible(!gridVisible)} 
                                className={`w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300 backdrop-blur-sm ${
                                    gridVisible ? 'bg-yellow-400/20 text-yellow-400 border border-yellow-400/30' : 'bg-white/10 hover:bg-white/20 text-white border border-white/10'
                                }`}
                            >
                                <div className="icon-grid-3x3 text-lg"></div>
                            </button>
                            <button 
                                onClick={() => setFacingMode(prev => prev === 'user' ? 'environment' : 'user')} 
                                className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-all duration-300 backdrop-blur-sm border border-white/10"
                            >
                                <div className="icon-camera text-white text-lg"></div>
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Video View */}
            <div className={`flex-1 relative overflow-hidden bg-black flex items-center justify-center ${previewMedia ? 'hidden' : ''}`}>
                {!hasPermission && (
                    <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-gray-900 via-black to-gray-900">
                        <div className="flex flex-col items-center gap-4">
                            <div className="w-16 h-16 rounded-full border-2 border-t-white border-white/20 animate-spin"></div>
                            <p className="text-white/60 text-sm">Iniciando câmera...</p>
                        </div>
                    </div>
                )}
                
                <div className="relative w-full h-full">
                    <video 
                        ref={videoRef} 
                        autoPlay 
                        playsInline 
                        muted 
                        className={`absolute w-full h-full object-cover ${facingMode === 'user' ? '-scale-x-100' : ''}`}
                    />
                    
                    <canvas 
                        ref={arCanvasRef} 
                        className="absolute w-full h-full object-cover pointer-events-none z-10" 
                    />

                    <canvas ref={canvasRef} className="hidden" />
                </div>

                {/* Grid Overlay */}
                {gridVisible && (
                    <div className="absolute inset-0 pointer-events-none flex flex-col justify-between z-10">
                        <div className="w-full h-1/3 border-b border-white/20"></div>
                        <div className="w-full h-1/3 border-b border-white/20"></div>
                        <div className="absolute inset-0 flex justify-between">
                            <div className="h-full w-1/3 border-r border-white/20"></div>
                            <div className="h-full w-1/3 border-r border-white/20"></div>
                        </div>
                    </div>
                )}

                {/* Flash Animation */}
                {showFlash && (
                    <div className="absolute inset-0 bg-white z-30 animate-flash-out"></div>
                )}
                
                {/* Recording Timer */}
                {!photoOnly && isRecording && (
                    <div className="absolute top-24 left-1/2 -translate-x-1/2 z-20">
                        <div className="backdrop-blur-xl bg-red-500/20 px-5 py-2 rounded-full border border-red-500/30 flex items-center gap-3 shadow-2xl">
                            <div className="relative">
                                <div className="w-2.5 h-2.5 rounded-full bg-red-500"></div>
                                <div className="absolute inset-0 w-2.5 h-2.5 rounded-full bg-red-500 animate-ping"></div>
                            </div>
                            <span className="text-white font-mono font-bold tracking-wider text-sm">
                                00:{recordingTime.toString().padStart(2, '0')}
                            </span>
                        </div>
                    </div>
                )}

                {/* Volume Controls */}
                {selectedAudio && !previewMedia && (
                    <button 
                        onClick={() => setShowVolumeControls(!showVolumeControls)}
                        className="absolute right-4 top-24 z-20 w-10 h-10 rounded-full bg-black/30 backdrop-blur-sm flex items-center justify-center border border-white/10"
                    >
                        <div className="icon-volume-2 text-white text-lg"></div>
                    </button>
                )}

                {showVolumeControls && selectedAudio && !previewMedia && (
                    <div className="absolute right-4 top-36 z-20 animate-slide-in-right">
                        <div className="backdrop-blur-xl bg-black/40 rounded-2xl p-4 border border-white/10 shadow-2xl">
                            <div className="flex gap-6">
                                <div className="flex flex-col items-center gap-3">
                                    <div className="icon-mic text-white/60 text-sm"></div>
                                    <input 
                                        type="range" 
                                        min="0" 
                                        max="1" 
                                        step="0.1" 
                                        value={originalVolume} 
                                        onChange={(e) => setOriginalVolume(parseFloat(e.target.value))}
                                        className="h-24 w-1.5 appearance-none bg-white/20 rounded-full outline-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:shadow-lg"
                                        style={{ WebkitAppearance: 'slider-vertical' }}
                                    />
                                    <span className="text-white/60 text-[10px] font-medium">Mic</span>
                                </div>
                                <div className="flex flex-col items-center gap-3">
                                    <div className="icon-music text-purple-400 text-sm"></div>
                                    <input 
                                        type="range" 
                                        min="0" 
                                        max="1" 
                                        step="0.1" 
                                        value={musicVolume} 
                                        onChange={(e) => setMusicVolume(parseFloat(e.target.value))}
                                        className="h-24 w-1.5 appearance-none bg-purple-500/20 rounded-full outline-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:bg-purple-400 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:shadow-lg"
                                        style={{ WebkitAppearance: 'slider-vertical' }}
                                    />
                                    <span className="text-white/60 text-[10px] font-medium">Music</span>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Zoom Slider */}
                {capabilities?.zoom && (
                    <div className="absolute left-4 top-1/2 -translate-y-1/2 h-48 z-20">
                        <div className="backdrop-blur-xl bg-black/30 rounded-full py-4 px-2 border border-white/10">
                            <input 
                                type="range" 
                                min={capabilities.zoom.min} 
                                max={capabilities.zoom.max} 
                                step={capabilities.zoom.step || 0.1}
                                value={zoom}
                                onChange={handleZoomChange}
                                className="h-40 w-1 appearance-none bg-white/20 rounded-full outline-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:shadow-lg"
                                style={{ WebkitAppearance: 'slider-vertical' }}
                            />
                        </div>
                    </div>
                )}
            </div>

            {/* Audio Menu - Modal with Search */}
            {showAudioMenu && (
                <div className="absolute inset-0 bg-black/95 backdrop-blur-xl z-50 flex flex-col text-white">
                    {/* Header */}
                    <div className="p-4 border-b border-white/10">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="font-bold text-xl bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">Músicas Disponíveis</h2>
                            <button 
                                onClick={() => {
                                    setShowAudioMenu(false);
                                    setSearchQuery('');
                                }}
                                className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-all duration-300"
                            >
                                <div className="icon-x text-xl"></div>
                            </button>
                        </div>
                        
                        {/* Search Bar */}
                        <div className="relative">
                            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                <div className="icon-search text-white/40 text-lg"></div>
                            </div>
                            <input
                                ref={searchInputRef}
                                type="text"
                                placeholder="Pesquisar músicas..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full pl-12 pr-12 py-3.5 bg-white/5 border border-white/10 rounded-2xl text-white placeholder-white/30 outline-none focus:border-purple-400/50 focus:bg-white/10 transition-all duration-300 text-sm"
                            />
                            {searchQuery && (
                                <button
                                    onClick={() => setSearchQuery('')}
                                    className="absolute inset-y-0 right-0 pr-4 flex items-center"
                                >
                                    <div className="icon-x-circle text-white/40 text-lg hover:text-white/60 transition-colors"></div>
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Content */}
                    <div className="flex-1 overflow-y-auto p-4 space-y-3">
                        {/* Option "Nenhum som" */}
                        <div 
                            className={`flex items-center gap-3 p-4 rounded-2xl cursor-pointer transition-all duration-300 ${
                                !selectedAudio 
                                    ? 'bg-gradient-to-r from-purple-500/20 to-pink-500/20 border border-purple-400/30' 
                                    : 'bg-white/5 hover:bg-white/10 border border-white/5'
                            }`}
                            onClick={() => { 
                                setSelectedAudio(null); 
                                setShowAudioMenu(false); 
                                setSearchQuery('');
                            }}
                        >
                            <div className="w-14 h-14 bg-white/5 rounded-2xl flex items-center justify-center border border-white/10">
                                <div className="icon-volume-x text-2xl text-white/40"></div>
                            </div>
                            <div className="flex-1">
                                <h3 className="font-semibold text-base">Nenhum som</h3>
                                <p className="text-sm text-white/40">Usar apenas áudio do microfone</p>
                            </div>
                            {!selectedAudio && (
                                <div className="w-6 h-6 rounded-full bg-purple-400 flex items-center justify-center">
                                    <div className="icon-check text-xs text-white"></div>
                                </div>
                            )}
                        </div>

                        {/* Loading State */}
                        {isLoadingAudios ? (
                            <div className="flex flex-col items-center justify-center py-12 text-white/40">
                                <div className="w-12 h-12 rounded-full border-2 border-t-purple-400 border-purple-400/20 animate-spin mb-4"></div>
                                <p className="text-sm">Carregando músicas...</p>
                            </div>
                        ) : filteredAudios.length === 0 ? (
                            /* Empty State */
                            <div className="text-center py-12">
                                <div className="w-20 h-20 rounded-full bg-white/5 flex items-center justify-center mx-auto mb-4 border border-white/10">
                                    <div className="icon-music text-3xl text-white/20"></div>
                                </div>
                                {searchQuery ? (
                                    <>
                                        <p className="text-white/40 font-medium mb-1">Nenhuma música encontrada</p>
                                        <p className="text-white/20 text-sm">Tente buscar por outro termo</p>
                                    </>
                                ) : (
                                    <p className="text-white/40">Nenhuma música disponível no momento</p>
                                )}
                            </div>
                        ) : (
                            /* Results count */
                            <>
                                {searchQuery && (
                                    <div className="px-1 py-1">
                                        <p className="text-xs text-white/30">
                                            {filteredAudios.length} {filteredAudios.length === 1 ? 'música encontrada' : 'músicas encontradas'}
                                        </p>
                                    </div>
                                )}
                                
                                {/* Audio List */}
                                {filteredAudios.map(audio => (
                                    <div 
                                        key={audio.id} 
                                        className={`flex items-center gap-3 p-4 rounded-2xl cursor-pointer transition-all duration-300 ${
                                            selectedAudio?.id === audio.id 
                                                ? 'bg-gradient-to-r from-purple-500/20 to-pink-500/20 border border-purple-400/30' 
                                                : 'bg-white/5 hover:bg-white/10 border border-white/5'
                                        }`}
                                        onClick={() => { 
                                            setSelectedAudio(audio); 
                                            setShowAudioMenu(false); 
                                            setSearchQuery('');
                                        }}
                                    >
                                        <div className="w-14 h-14 rounded-2xl overflow-hidden border border-white/10 flex-shrink-0">
                                            <img 
                                                src={audio.coverUrl || 'https://via.placeholder.com/150'} 
                                                className="w-full h-full object-cover"
                                                alt={audio.name}
                                                onError={(e) => {
                                                    e.target.src = 'https://via.placeholder.com/150';
                                                }}
                                            />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <h3 className="font-semibold text-base truncate">{audio.name}</h3>
                                            <p className="text-sm text-white/40 truncate">{audio.artistName}</p>
                                        </div>
                                        {selectedAudio?.id === audio.id && (
                                            <div className="w-6 h-6 rounded-full bg-purple-400 flex items-center justify-center flex-shrink-0">
                                                <div className="icon-check text-xs text-white"></div>
                                            </div>
                                        )}
                                        {selectedAudio?.id !== audio.id && (
                                            <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <div className="icon-play text-sm text-white/60"></div>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </>
                        )}
                    </div>
                </div>
            )}

            {selectedAudio && (
                <audio ref={audioPlayerRef} src={selectedAudio.mediaUrl} preload="auto" loop crossOrigin="anonymous" />
            )}

            {/* Bottom Controls */}
            <div className={`pb-8 bg-gradient-to-t from-black via-black to-transparent pt-8 z-20 ${previewMedia ? 'hidden' : ''}`}>
                <div className="flex items-center justify-center">
                    <div 
                        className="relative cursor-pointer group"
                        onMouseDown={handleButtonPress}
                        onMouseUp={handleButtonRelease}
                        onMouseLeave={handleButtonRelease}
                        onTouchStart={handleButtonPress}
                        onTouchEnd={handleButtonRelease}
                    >
                        {/* Outer glow */}
                        <div className={`absolute inset-0 rounded-full blur-xl transition-all duration-300 ${
                            isRecording 
                                ? 'bg-red-500/30 scale-110' 
                                : 'bg-white/20 scale-100 group-hover:scale-105'
                        }`}></div>
                        
                        {/* Outer Ring */}
                        <div className={`relative w-[90px] h-[90px] rounded-full flex items-center justify-center transition-all duration-300 ${
                            isRecording 
                                ? 'border-[4px] border-red-500 scale-110' 
                                : 'border-[4px] border-white group-hover:scale-105'
                        }`}>
                            {/* Inner Button */}
                            <div className={`rounded-full transition-all duration-300 shadow-2xl ${
                                isRecording 
                                    ? 'w-9 h-9 bg-red-500 rounded-xl' 
                                    : 'w-[74px] h-[74px] bg-white group-hover:scale-95'
                            }`}></div>
                        </div>
                        
                        {/* Recording Progress Ring */}
                        {!photoOnly && isRecording && (
                            <svg className="absolute inset-0 w-[90px] h-[90px] -rotate-90 pointer-events-none">
                                <circle 
                                    cx="45" 
                                    cy="45" 
                                    r="41" 
                                    fill="none" 
                                    stroke="url(#gradient)" 
                                    strokeWidth="4" 
                                    strokeLinecap="round"
                                    strokeDasharray="257" 
                                    strokeDashoffset={257 - (recordingTime / 60) * 257}
                                    className="transition-all duration-1000 ease-linear"
                                />
                                <defs>
                                    <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="0%">
                                        <stop offset="0%" stopColor="#ff6b6b" />
                                        <stop offset="100%" stopColor="#ee5a24" />
                                    </linearGradient>
                                </defs>
                            </svg>
                        )}
                    </div>
                </div>
            </div>

            {/* Preview Media Editor */}
            {previewMedia && (
                <MediaEditor 
                    media={previewMedia}
                    selectedAudio={selectedAudio}
                    onCancel={() => setPreviewMedia(null)}
                    onSend={(file, type, audio, text) => onCapture(file, type, audio, text)}
                />
            )}

            <style jsx>{`
                @keyframes flash-out {
                    0% { opacity: 1; }
                    100% { opacity: 0; }
                }
                .animate-flash-out {
                    animation: flash-out 0.3s ease-out forwards;
                }
                
                @keyframes slide-in-right {
                    0% { 
                        opacity: 0;
                        transform: translateX(20px);
                    }
                    100% { 
                        opacity: 1;
                        transform: translateX(0);
                    }
                }
                .animate-slide-in-right {
                    animation: slide-in-right 0.3s ease-out;
                }
            `}</style>
        </div>
    );
}

window.CameraCapture = CameraCapture;