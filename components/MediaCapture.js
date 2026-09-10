function MediaCapture({ onCapture, onClose, photoOnly = false, embedded = false }) {
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
    const [showGallery, setShowGallery] = React.useState(false);
    const [galleryMedia, setGalleryMedia] = React.useState([]);
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
    const [torchOn, setTorchOn] = React.useState(false);
    const [mainMode, setMainMode] = React.useState('photo');
    const [textTitle, setTextTitle] = React.useState('');
    const [textBody, setTextBody] = React.useState('');
    const [pollQuestion, setPollQuestion] = React.useState('');
    const [pollOptions, setPollOptions] = React.useState(['', '']);
    const [toast, setToast] = React.useState(null);
    const [isPublishing, setIsPublishing] = React.useState(false);

    const audioContextRef = React.useRef(null);
    const micGainRef = React.useRef(null);
    const musicGainRef = React.useRef(null);
    const destRef = React.useRef(null);
    const sourceNodeRef = React.useRef(null);
    const micSourceRef = React.useRef(null);
    const finalStreamRef = React.useRef(null);
    const [filters] = React.useState([
        { id: 'none', name: 'Nenhum', type: 'none', url: '' },
        { id: 'glasses_thug', name: 'Óculos Thug', type: 'eyes', url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/e8/Sunglasses_icon.svg/512px-Sunglasses_icon.svg.png' },
        { id: 'mask_anon', name: 'Máscara', type: 'face', url: 'https://cdn-icons-png.flaticon.com/512/2821/2821035.png' },
        { id: 'hat_crown', name: 'Coroa', type: 'head', url: 'https://cdn-icons-png.flaticon.com/512/1004/1004733.png' }
    ]);

    const isCameraMode = mainMode === 'photo' || mainMode === 'video';
    const isTextMode = mainMode === 'text';
    const isPollMode = mainMode === 'poll';

    const showToast = (msg) => {
        setToast(msg);
        setTimeout(() => setToast(null), 3000);
    };

    React.useEffect(() => {
        const initDB = () => {
            const request = indexedDB.open('PhantoraGallery', 1);
            request.onupgradeneeded = (e) => {
                const db = e.target.result;
                if (!db.objectStoreNames.contains('media')) {
                    db.createObjectStore('media', { keyPath: 'id', autoIncrement: true });
                }
            };
            request.onsuccess = (e) => {
                const db = e.target.result;
                loadGalleryMedia(db);
            };
        };
        initDB();
    }, []);

    const loadGalleryMedia = (db) => {
        const transaction = db.transaction(['media'], 'readonly');
        const store = transaction.objectStore('media');
        const request = store.getAll();
        request.onsuccess = () => {
            setGalleryMedia(request.result.reverse());
        };
    };

    const saveMediaToGallery = async (file) => {
        const db = await new Promise((resolve, reject) => {
            const request = indexedDB.open('PhantoraGallery', 1);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });

        const transaction = db.transaction(['media'], 'readwrite');
        const store = transaction.objectStore('media');
        
        const mediaObj = {
            blob: file,
            type: file.type.startsWith('video/') ? 'video' : 'image',
            url: URL.createObjectURL(file),
            timestamp: Date.now()
        };

        store.add(mediaObj);
        transaction.oncomplete = () => {
            loadGalleryMedia(db);
        };
    };

    const handleFileUpload = (e) => {
        const files = e.target.files;
        if (files && files.length > 0) {
            for (let i = 0; i < files.length; i++) {
                saveMediaToGallery(files[i]);
            }
        }
    };

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

    React.useEffect(() => {
        if (showAudioMenu && searchInputRef.current) {
            setTimeout(() => searchInputRef.current.focus(), 100);
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
            return () => musicRef.off('value', handleData);
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
                streamRef.current.getVideoTracks().forEach(track => finalStreamRef.current.addTrack(track));
                destRef.current.stream.getAudioTracks().forEach(track => finalStreamRef.current.addTrack(track));
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
        if (audioPlayerRef.current && selectedAudio) setupAudioMixer();
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
                const vision = await window.FilesetResolver.forVisionTasks("https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm");
                const landmarker = await window.FaceLandmarker.createFromOptions(vision, {
                    baseOptions: {
                        modelAssetPath: "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/latest/face_landmarker.task",
                        delegate: "GPU"
                    },
                    runningMode: "VIDEO",
                    numFaces: 1
                });
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
                video: { facingMode, width: { ideal: 1280, max: 1920 }, height: { ideal: 720, max: 1080 }, frameRate: { ideal: 30, max: 60 } },
                audio: true
            };
            const stream = await navigator.mediaDevices.getUserMedia(constraints);
            streamRef.current = stream;
            if (videoRef.current) {
                videoRef.current.srcObject = stream;
                setHasPermission(true);
                videoRef.current.onloadedmetadata = () => videoRef.current.play().catch(e => console.error(e));
            }
            const track = stream.getVideoTracks()[0];
            if (track.getCapabilities) setCapabilities(track.getCapabilities());
        } catch (err) {
            console.error("Camera access denied or error:", err);
            setHasPermission(false);
        }
    };

    React.useEffect(() => {
        if (isCameraMode) {
            setTorchOn(false);
            startCamera();
        } else {
            if (streamRef.current) {
                streamRef.current.getTracks().forEach(track => track.stop());
                streamRef.current = null;
            }
        }
        return () => {
            if (streamRef.current) streamRef.current.getTracks().forEach(track => track.stop());
            clearInterval(recordingDurationRef.current);
        };
    }, [facingMode, mainMode]);

    const isPredictingRef = React.useRef(false);

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
                const results = faceLandmarkerRef.current.detectForVideo(video, performance.now());
                if (results.faceLandmarks && results.faceLandmarks.length > 0) {
                    const face = results.faceLandmarks[0];
                    const img = filterImageRef.current;
                    if (img.complete && img.naturalHeight !== 0) {
                        if (filter.type === 'eyes') {
                            const leftEye = face[33], rightEye = face[263];
                            const x1 = leftEye.x * arCanvas.width, y1 = leftEye.y * arCanvas.height;
                            const x2 = rightEye.x * arCanvas.width, y2 = rightEye.y * arCanvas.height;
                            const centerX = (x1 + x2) / 2, centerY = (y1 + y2) / 2;
                            const eyeDistance = Math.hypot(x2 - x1, y2 - y1);
                            const angle = Math.atan2(y2 - y1, x2 - x1);
                            const width = eyeDistance * 2.2, height = width * 0.55;
                            ctx.save();
                            ctx.translate(centerX, centerY);
                            ctx.rotate(angle);
                            ctx.drawImage(img, -width / 2, -height / 2, width, height);
                            ctx.restore();
                        } else if (filter.type === 'face' || filter.type === 'head') {
                            const left = face[234], right = face[454];
                            const faceWidth = Math.abs((right.x - left.x) * arCanvas.width);
                            const centerX = face[1].x * arCanvas.width;
                            const centerY = (filter.type === 'head' ? face[10].y : face[1].y) * arCanvas.height;
                            const width = faceWidth * 1.5;
                            const height = width * (img.naturalHeight / img.naturalWidth);
                            let finalY = centerY - height / 2;
                            if (filter.type === 'head') finalY -= height / 2;
                            ctx.save();
                            ctx.translate(centerX, finalY + height / 2);
                            ctx.drawImage(img, -width / 2, -height / 2, width, height);
                            ctx.restore();
                        }
                    }
                }
            } catch (e) { console.error("Error detecting face", e); }
        }
        if (isPredictingRef.current) animationFrameRef.current = requestAnimationFrame(predictWebcam);
    };

    React.useEffect(() => {
        if (hasPermission && selectedFilter !== 'none' && isCameraMode) {
            isPredictingRef.current = true;
            predictWebcam();
        } else {
            isPredictingRef.current = false;
        }
        return () => {
            isPredictingRef.current = false;
            if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
        };
    }, [hasPermission, selectedFilter, facingMode, mainMode]);

    const handleZoomChange = (e) => {
        const newZoom = parseFloat(e.target.value);
        setZoom(newZoom);
        const track = streamRef.current?.getVideoTracks()[0];
        if (track && capabilities?.zoom) track.applyConstraints({ advanced: [{ zoom: newZoom }] }).catch(console.error);
    };

    const toggleTorch = () => {
        const track = streamRef.current?.getVideoTracks()[0];
        if (!track || !capabilities?.torch) {
            showToast("Flash não disponível neste dispositivo");
            return;
        }
        const newVal = !torchOn;
        track.applyConstraints({ advanced: [{ torch: newVal }] })
            .then(() => setTorchOn(newVal))
            .catch(console.error);
    };

    const toggleGrid = () => setGridVisible(!gridVisible);

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
                if (blob) {
                    const url = URL.createObjectURL(blob);
                    setPreviewMedia({ type: 'image', url, blob });
                }
            }, 'image/jpeg', 0.9);
        } catch (e) { console.error(e); }
    };

    const startRecording = () => {
        if (!streamRef.current) return;
        recordedChunksRef.current = [];
        let mimeType = '';
        if (MediaRecorder.isTypeSupported('video/webm; codecs=vp9')) mimeType = 'video/webm; codecs=vp9';
        else if (MediaRecorder.isTypeSupported('video/webm')) mimeType = 'video/webm';
        else if (MediaRecorder.isTypeSupported('video/mp4')) mimeType = 'video/mp4';
        let streamToRecord = streamRef.current;
        if (selectedAudio && finalStreamRef.current) streamToRecord = finalStreamRef.current;
        const options = mimeType ? { mimeType, videoBitsPerSecond: 2500000, audioBitsPerSecond: 128000 } : { videoBitsPerSecond: 2500000, audioBitsPerSecond: 128000 };
        try {
            mediaRecorderRef.current = new MediaRecorder(streamToRecord, options);
        } catch (e) {
            mediaRecorderRef.current = new MediaRecorder(streamToRecord, { videoBitsPerSecond: 2500000, audioBitsPerSecond: 128000 });
        }
        mediaRecorderRef.current.ondataavailable = (e) => { if (e.data.size > 0) recordedChunksRef.current.push(e.data); };
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
                if (prev >= 59) { stopRecording(); return 60; }
                return prev + 1;
            });
        }, 1000);
    };

    const stopRecording = () => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') mediaRecorderRef.current.stop();
        if (selectedAudio && audioPlayerRef.current) audioPlayerRef.current.pause();
    };

    const pressTimeRef = React.useRef(0);

    const handleButtonPress = () => {
        if (photoOnly || !isCameraMode) return;
        pressTimeRef.current = Date.now();
        if (mainMode === 'video') {
            if (isRecording) stopRecording();
            else startRecording();
            return;
        }
        holdTimerRef.current = setTimeout(() => startRecording(), 400);
    };

    const handleButtonRelease = () => {
        if (photoOnly || !isCameraMode) return;
        if (mainMode === 'video') {
            if (isRecording && Date.now() - pressTimeRef.current > 500) stopRecording();
            return;
        }
        if (holdTimerRef.current) clearTimeout(holdTimerRef.current);
        if (isRecording) stopRecording();
        else takePhoto();
    };

    const publishText = async () => {
        if (!textBody.trim()) { showToast("Escreva algo antes de publicar."); return; }
        setIsPublishing(true);
        try {
            await onCapture(
                new File([new Blob([textBody], { type: 'text/plain' })], `text_${Date.now()}.txt`, { type: 'text/plain' }),
                'text', selectedAudio, textBody
            );
        } catch (e) { console.error(e); showToast("Erro ao publicar texto"); }
        finally { setIsPublishing(false); }
    };

    const publishPoll = async () => {
        if (!pollQuestion.trim() || pollOptions.filter(o => o.trim()).length < 2) {
            showToast("Preencha a pergunta e pelo menos 2 opções.");
            return;
        }
        setIsPublishing(true);
        try {
            const pollData = {
                question: pollQuestion,
                options: pollOptions.filter(o => o.trim()).map((o, idx) => ({ id: idx.toString(), text: o }))
            };
            await onCapture(
                new File([new Blob([JSON.stringify(pollData)], { type: 'application/json' })], `poll_${Date.now()}.json`, { type: 'application/json' }),
                'poll', selectedAudio, JSON.stringify(pollData)
            );
        } catch (e) { console.error(e); showToast("Erro ao publicar enquete"); }
        finally { setIsPublishing(false); }
    };

    if (hasPermission === false && isCameraMode) {
        return (
            <div className={`${embedded ? 'absolute' : 'fixed'} inset-0 bg-gradient-to-br from-gray-900 via-black to-gray-900 z-[100] flex flex-col items-center justify-center text-white`}>
                <div className="w-24 h-24 rounded-full bg-red-500/10 flex items-center justify-center mb-6">
                    <div className="icon-camera-off text-5xl text-red-400"></div>
                </div>
                <h2 className="text-2xl font-bold mb-2 text-red-400">Acesso Negado</h2>
                <p className="text-gray-400 mb-8">Permita o acesso à câmera para continuar</p>
                <button onClick={onClose} className="px-8 py-3 bg-gray-800/50 rounded-2xl hover:bg-gray-700/50 border border-gray-700/50">Fechar</button>
            </div>
        );
    }

    return (
        <div className={`${embedded ? 'absolute' : 'fixed'} inset-0 bg-black z-[100] flex flex-col select-none overflow-hidden`} data-name="media-capture" data-file="components/MediaCapture.js">

            {!previewMedia && (
                <div className="absolute top-0 left-0 right-0 z-30 pointer-events-none">
                    <div className="mx-3 mt-4 flex items-center justify-between gap-2 pointer-events-auto">
                        {!embedded ? (
                            <button onClick={onClose} className="w-10 h-10 rounded-full bg-black/40 backdrop-blur-xl flex items-center justify-center border border-white/10 text-white hover:bg-white/20 active:scale-90">
                                <div className="icon-x text-lg"></div>
                            </button>
                        ) : (<div className="w-10 h-10"></div>)}

                        <button
                            onClick={() => setShowAudioMenu(true)}
                            className={`flex items-center gap-2 px-4 py-2 rounded-full transition-all duration-300 backdrop-blur-xl ${selectedAudio ? 'bg-gradient-to-r from-purple-500/25 to-pink-500/25 border border-purple-400/40' : 'bg-black/40 border border-white/10 hover:bg-white/20'}`}
                        >
                            <div className={`icon-music text-sm ${selectedAudio ? 'text-purple-300' : 'text-white'}`}></div>
                            <span className="text-xs font-medium truncate max-w-[110px] text-white">{selectedAudio ? selectedAudio.name : 'Adicionar Som'}</span>
                        </button>

                        <div className="flex gap-1.5">
                            <button
                                onClick={toggleTorch}
                                className={`w-10 h-10 rounded-full flex items-center justify-center transition-all active:scale-90 backdrop-blur-xl border ${torchOn ? 'bg-yellow-400 text-black border-yellow-300' : 'bg-black/40 hover:bg-white/20 text-white border-white/10'}`}
                                title="Flash"
                            >
                                <div className="icon-zap text-base"></div>
                            </button>
                            <button
                                onClick={toggleGrid}
                                className={`w-10 h-10 rounded-full flex items-center justify-center transition-all active:scale-90 backdrop-blur-xl border ${gridVisible ? 'bg-yellow-400/20 text-yellow-400 border-yellow-400/30' : 'bg-black/40 hover:bg-white/20 text-white border-white/10'}`}
                                title="Grade"
                            >
                                <div className="icon-grid-3x3 text-base"></div>
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <div className="flex-1 relative overflow-hidden bg-black">
                {isCameraMode && (
                    <div className="absolute inset-0">
                        {!hasPermission && (
                            <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-gray-900 via-black to-gray-900">
                                <div className="flex flex-col items-center gap-4">
                                    <div className="w-16 h-16 rounded-full border-2 border-t-white border-white/20 animate-spin"></div>
                                    <p className="text-white/60 text-sm">Iniciando câmera...</p>
                                </div>
                            </div>
                        )}
                        <div className="relative w-full h-full">
                            <video ref={videoRef} autoPlay playsInline muted className={`absolute w-full h-full object-cover ${facingMode === 'user' ? '-scale-x-100' : ''}`} />
                            <canvas ref={arCanvasRef} className="absolute w-full h-full object-cover pointer-events-none z-10" />
                            <canvas ref={canvasRef} className="hidden" />
                        </div>

                        {gridVisible && (
                            <div className="absolute inset-0 pointer-events-none z-10">
                                <div className="absolute top-0 bottom-0 left-1/3 w-px bg-white/40"></div>
                                <div className="absolute top-0 bottom-0 left-2/3 w-px bg-white/40"></div>
                                <div className="absolute left-0 right-0 top-1/3 h-px bg-white/40"></div>
                                <div className="absolute left-0 right-0 top-2/3 h-px bg-white/40"></div>
                            </div>
                        )}

                        {showFlash && <div className="absolute inset-0 bg-white z-30 animate-flash-out"></div>}

                        {isRecording && (
                            <div className="absolute top-24 left-1/2 -translate-x-1/2 z-20">
                                <div className="backdrop-blur-xl bg-red-500/20 px-5 py-2 rounded-full border border-red-500/30 flex items-center gap-3 shadow-2xl">
                                    <div className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse"></div>
                                    <span className="text-white font-mono font-bold text-sm">00:{recordingTime.toString().padStart(2, '0')}</span>
                                </div>
                            </div>
                        )}

                        {selectedAudio && (
                            <button onClick={() => setShowVolumeControls(!showVolumeControls)} className="absolute right-4 top-24 z-20 w-10 h-10 rounded-full bg-black/30 backdrop-blur-sm flex items-center justify-center border border-white/10">
                                <div className="icon-volume-2 text-white text-lg"></div>
                            </button>
                        )}

                        {showVolumeControls && selectedAudio && (
                            <div className="absolute right-4 top-36 z-20">
                                <div className="backdrop-blur-xl bg-black/40 rounded-2xl p-4 border border-white/10">
                                    <div className="flex gap-6">
                                        <div className="flex flex-col items-center gap-3">
                                            <div className="icon-mic text-white/60 text-sm"></div>
                                            <input type="range" min="0" max="1" step="0.1" value={originalVolume} onChange={(e) => setOriginalVolume(parseFloat(e.target.value))} className="h-24 w-1.5 bg-white/20 rounded-full" style={{ WebkitAppearance: 'slider-vertical' }} />
                                            <span className="text-white/60 text-[10px]">Mic</span>
                                        </div>
                                        <div className="flex flex-col items-center gap-3">
                                            <div className="icon-music text-purple-400 text-sm"></div>
                                            <input type="range" min="0" max="1" step="0.1" value={musicVolume} onChange={(e) => setMusicVolume(parseFloat(e.target.value))} className="h-24 w-1.5 bg-purple-500/20 rounded-full" style={{ WebkitAppearance: 'slider-vertical' }} />
                                            <span className="text-white/60 text-[10px]">Music</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {capabilities?.zoom && (
                            <div className="absolute left-4 top-1/2 -translate-y-1/2 h-48 z-20">
                                <div className="backdrop-blur-xl bg-black/30 rounded-full py-4 px-2 border border-white/10">
                                    <input type="range" min={capabilities.zoom.min} max={capabilities.zoom.max} step={capabilities.zoom.step || 0.1} value={zoom} onChange={handleZoomChange} className="h-40 w-1 bg-white/20 rounded-full" style={{ WebkitAppearance: 'slider-vertical' }} />
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {isTextMode && (
                    <div className="absolute inset-0 flex items-center justify-center p-6 bg-gradient-to-br from-indigo-900/40 to-purple-900/40 pt-24">
                        <div className="w-full max-w-md bg-black/40 backdrop-blur-xl border border-white/10 rounded-3xl p-6 flex flex-col">
                            <div className="flex items-center gap-3 mb-6">
                                <div className="w-12 h-12 rounded-full bg-indigo-500/20 flex items-center justify-center text-indigo-400">
                                    <div className="icon-type text-2xl"></div>
                                </div>
                                <div>
                                    <h3 className="text-xl font-bold text-white">Criar Texto</h3>
                                    <p className="text-white/50 text-sm">Compartilhe um pensamento</p>
                                </div>
                            </div>
                            <input type="text" value={textTitle} onChange={e => setTextTitle(e.target.value)} placeholder="Título (opcional)" className="w-full bg-white/5 border border-white/10 rounded-xl p-4 outline-none focus:border-indigo-500 mb-4 text-white" />
                            <textarea value={textBody} onChange={e => setTextBody(e.target.value)} placeholder="O que está acontecendo?" className="w-full bg-white/5 border border-white/10 rounded-xl p-4 min-h-[200px] outline-none focus:border-indigo-500 resize-none text-white"></textarea>
                        </div>
                    </div>
                )}

                {isPollMode && (
                    <div className="absolute inset-0 flex items-center justify-center p-6 bg-gradient-to-br from-purple-900/40 to-pink-900/40 pt-24 overflow-y-auto">
                        <div className="w-full max-w-md bg-black/40 backdrop-blur-xl border border-white/10 rounded-3xl p-6 flex flex-col">
                            <div className="flex items-center gap-3 mb-6">
                                <div className="w-12 h-12 rounded-full bg-pink-500/20 flex items-center justify-center text-pink-400">
                                    <div className="icon-chart-bar text-2xl"></div>
                                </div>
                                <div>
                                    <h3 className="text-xl font-bold text-white">Criar Enquete</h3>
                                    <p className="text-white/50 text-sm">Faça uma pergunta</p>
                                </div>
                            </div>
                            <input type="text" placeholder="Faça uma pergunta..." value={pollQuestion} onChange={e => setPollQuestion(e.target.value)} className="w-full bg-white/10 border border-white/20 rounded-xl p-4 outline-none focus:border-pink-500 mb-6 font-bold text-lg text-white" />
                            <div className="space-y-3 mb-4 max-h-[40vh] overflow-y-auto pr-2">
                                {pollOptions.map((opt, i) => (
                                    <div key={i} className="flex gap-2">
                                        <div className="w-12 h-12 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-white/50 font-bold shrink-0">{String.fromCharCode(65 + i)}</div>
                                        <input type="text" placeholder={`Opção ${i+1}`} value={opt} onChange={e => { const n = [...pollOptions]; n[i] = e.target.value; setPollOptions(n); }} className="flex-1 bg-white/5 border border-white/10 rounded-xl p-3 outline-none focus:border-pink-500 text-white" />
                                        {pollOptions.length > 2 && (
                                            <button onClick={() => setPollOptions(pollOptions.filter((_, idx) => idx !== i))} className="w-12 h-12 rounded-xl bg-red-500/20 text-red-400 flex items-center justify-center">
                                                <div className="icon-trash"></div>
                                            </button>
                                        )}
                                    </div>
                                ))}
                            </div>
                            {pollOptions.length < 5 && (
                                <button onClick={() => setPollOptions([...pollOptions, ''])} className="w-full py-3 rounded-xl border border-dashed border-white/30 text-white/70 flex items-center justify-center gap-2 font-bold">
                                    <div className="icon-plus"></div> Adicionar opção
                                </button>
                            )}
                        </div>
                    </div>
                )}
            </div>

            {!previewMedia && !showGallery && (
                <div className="pb-8 bg-gradient-to-t from-black via-black/95 to-transparent pt-16 z-20 absolute bottom-0 left-0 right-0">
                    {!photoOnly && !isRecording && (
                        <div className="flex justify-center mb-6">
                            <div className="flex items-center gap-1 bg-black/40 backdrop-blur-md rounded-full p-1 border border-white/10">
                                <button onClick={() => setMainMode('photo')} className={`px-4 py-1.5 rounded-full text-xs font-bold ${mainMode === 'photo' ? 'bg-white text-black' : 'text-white/60'}`}>FOTO</button>
                                <button onClick={() => setMainMode('video')} className={`px-4 py-1.5 rounded-full text-xs font-bold ${mainMode === 'video' ? 'bg-red-500 text-white' : 'text-white/60'}`}>VÍDEO</button>
                                <button onClick={() => setMainMode('text')} className={`px-4 py-1.5 rounded-full text-xs font-bold ${mainMode === 'text' ? 'bg-indigo-500 text-white' : 'text-white/60'}`}>TEXTO</button>
                                <button onClick={() => setMainMode('poll')} className={`px-4 py-1.5 rounded-full text-xs font-bold ${mainMode === 'poll' ? 'bg-pink-500 text-white' : 'text-white/60'}`}>ENQUETE</button>
                            </div>
                        </div>
                    )}

                    {isCameraMode && (
                        <div className="flex items-center justify-between px-10 max-w-md mx-auto">
                            <button onClick={() => setShowGallery(true)} className="relative w-12 h-12 rounded-2xl active:scale-90">
                                <div className="absolute -inset-[2px] rounded-2xl bg-gradient-to-br from-fuchsia-500 via-purple-500 to-cyan-400 opacity-80"></div>
                                <div className="relative w-full h-full rounded-2xl bg-black overflow-hidden flex items-center justify-center border border-black">
                                    {galleryMedia.length > 0 ? <img src={galleryMedia[0].url} className="w-full h-full object-cover" /> : <div className="icon-image text-white"></div>}
                                </div>
                            </button>

                            <div className="relative cursor-pointer select-none" onMouseDown={handleButtonPress} onMouseUp={handleButtonRelease} onMouseLeave={handleButtonRelease} onTouchStart={handleButtonPress} onTouchEnd={handleButtonRelease}>
                                <div className={`absolute inset-0 rounded-full blur-xl ${isRecording ? 'bg-red-500/40 scale-125' : mainMode === 'video' ? 'bg-red-500/20 scale-105' : 'bg-white/25 scale-100'}`}></div>
                                <div className={`relative w-[86px] h-[86px] rounded-full flex items-center justify-center ${isRecording ? 'border-[4px] border-red-500 scale-110' : mainMode === 'video' ? 'border-[4px] border-red-400/80' : 'border-[4px] border-white'}`}>
                                    <div className={`shadow-2xl ${isRecording ? 'w-8 h-8 bg-red-500 rounded-lg' : mainMode === 'video' ? 'w-[68px] h-[68px] bg-red-500 rounded-full' : 'w-[70px] h-[70px] bg-white rounded-full'}`}></div>
                                </div>
                            </div>

                            <button onClick={() => setFacingMode(prev => prev === 'user' ? 'environment' : 'user')} className="w-12 h-12 rounded-full bg-white/10 hover:bg-white/20 active:scale-90 flex items-center justify-center border border-white/15">
                                <div className="icon-refresh-cw text-white text-lg"></div>
                            </button>
                        </div>
                    )}

                    {(isTextMode || isPollMode) && (
                        <div className="flex justify-center px-6">
                            <button
                                onClick={isTextMode ? publishText : publishPoll}
                                disabled={isPublishing}
                                className={`px-10 py-3 rounded-full font-bold text-white shadow-lg active:scale-95 ${isTextMode ? 'bg-indigo-600 hover:bg-indigo-700' : 'bg-pink-600 hover:bg-pink-700'} disabled:opacity-50`}
                            >
                                {isPublishing ? <div className="flex items-center gap-2"><div className="icon-loader animate-spin"></div>Publicando...</div> : 'Publicar'}
                            </button>
                        </div>
                    )}
                </div>
            )}

            {showAudioMenu && (
                <div className="absolute inset-0 bg-black/95 backdrop-blur-xl z-50 flex flex-col text-white">
                    <div className="p-4 border-b border-white/10">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="font-bold text-xl bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">Músicas</h2>
                            <button onClick={() => { setShowAudioMenu(false); setSearchQuery(''); }} className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center">
                                <div className="icon-x text-xl"></div>
                            </button>
                        </div>
                        <div className="relative">
                            <input ref={searchInputRef} type="text" placeholder="Pesquisar músicas..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full pl-4 pr-12 py-3.5 bg-white/5 border border-white/10 rounded-2xl text-white placeholder-white/30 outline-none focus:border-purple-400/50 text-sm" />
                        </div>
                    </div>
                    <div className="flex-1 overflow-y-auto p-4 space-y-3">
                        <div className={`flex items-center gap-3 p-4 rounded-2xl cursor-pointer ${!selectedAudio ? 'bg-purple-500/20 border border-purple-400/30' : 'bg-white/5'}`} onClick={() => { setSelectedAudio(null); setShowAudioMenu(false); setSearchQuery(''); }}>
                            <div className="w-14 h-14 bg-white/5 rounded-2xl flex items-center justify-center border border-white/10"><div className="icon-volume-x text-2xl text-white/40"></div></div>
                            <div className="flex-1"><h3 className="font-semibold">Nenhum som</h3></div>
                        </div>
                        {isLoadingAudios ? (
                            <div className="text-center py-12 text-white/40"><div className="w-12 h-12 rounded-full border-2 border-t-purple-400 border-purple-400/20 animate-spin mx-auto mb-4"></div>Carregando...</div>
                        ) : filteredAudios.length === 0 ? (
                            <div className="text-center py-12 text-white/40">Nenhuma música disponível</div>
                        ) : filteredAudios.map(audio => (
                            <div key={audio.id} className={`flex items-center gap-3 p-4 rounded-2xl cursor-pointer ${selectedAudio?.id === audio.id ? 'bg-purple-500/20 border border-purple-400/30' : 'bg-white/5'}`} onClick={() => { setSelectedAudio(audio); setShowAudioMenu(false); setSearchQuery(''); }}>
                                <div className="w-14 h-14 rounded-2xl overflow-hidden border border-white/10 flex-shrink-0">
                                    <img src={audio.coverUrl || 'assets/default-avatar.svg'} onError={(e) => { e.target.src = 'assets/default-avatar.svg'; }} className="w-full h-full object-cover" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <h3 className="font-semibold truncate">{audio.name}</h3>
                                    <p className="text-sm text-white/40 truncate">{audio.artistName}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {selectedAudio && <audio ref={audioPlayerRef} src={selectedAudio.mediaUrl} preload="auto" loop crossOrigin="anonymous" />}

            {showGallery && (
                <div className="absolute inset-0 bg-black z-50 flex flex-col">
                    <div className="p-4 flex items-center justify-between border-b border-white/10 bg-gray-900/50">
                        <button onClick={() => setShowGallery(false)} className="w-10 h-10 flex items-center justify-center rounded-full bg-white/10 text-white">
                            <div className="icon-x text-xl"></div>
                        </button>
                        <h2 className="text-white font-semibold">Galeria</h2>
                        <div className="w-10"></div>
                    </div>
                    <div className="flex-1 overflow-y-auto p-2">
                        <div className="grid grid-cols-4 gap-2">
                            <label className="aspect-square bg-blue-600 rounded-lg flex flex-col items-center justify-center cursor-pointer">
                                <div className="icon-plus text-white text-3xl mb-1"></div>
                                <input type="file" onChange={handleFileUpload} accept="image/*,video/*" multiple className="hidden" />
                            </label>
                            {galleryMedia.map(media => (
                                <div key={media.id} onClick={() => { setPreviewMedia({ type: media.type, url: media.url, blob: media.blob }); setShowGallery(false); }} className="aspect-square bg-gray-800 rounded-lg overflow-hidden cursor-pointer border border-white/5">
                                    {media.type === 'video' ? <video src={media.url} className="w-full h-full object-cover" /> : <img src={media.url} className="w-full h-full object-cover" />}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {previewMedia && window.MediaEditor && (
                <window.MediaEditor 
                    media={previewMedia}
                    selectedAudio={selectedAudio}
                    onCancel={() => setPreviewMedia(null)}
                    onSend={(file, type, audio, text) => onCapture(file, type, audio, text)}
                />
            )}

            {toast && (
                <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[200] bg-black/80 text-white px-4 py-2 rounded-lg text-sm backdrop-blur-md border border-white/10">
                    {toast}
                </div>
            )}

            <style jsx>{`
                @keyframes flash-out { 0% { opacity: 1; } 100% { opacity: 0; } }
                .animate-flash-out { animation: flash-out 0.3s ease-out forwards; }
            `}</style>
        </div>
    );
}

window.MediaCapture = MediaCapture;
