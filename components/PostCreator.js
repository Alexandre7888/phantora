function PostCreator({ user, onClose, onUploadComplete, initialAudioId = null }) {
    const [activeIndex, setActiveIndex] = React.useState(0);
    const [startX, setStartX] = React.useState(null);
    const [currentTranslate, setCurrentTranslate] = React.useState(0);
    const isSwiping = React.useRef(false);
    
    // Audio Context
    const [audioId, setAudioId] = React.useState(initialAudioId);

    // Text states
    const [textBody, setTextBody] = React.useState('');
    const [title, setTitle] = React.useState('');
    
    // Poll states
    const [pollQuestion, setPollQuestion] = React.useState('');
    const [pollOptions, setPollOptions] = React.useState(['', '']);
    
    // Gallery states
    const [galleryFile, setGalleryFile] = React.useState(null);
    const [galleryPreview, setGalleryPreview] = React.useState(null);
    const [galleryText, setGalleryText] = React.useState('');
    const galleryInputRef = React.useRef(null);

    const [isUploading, setIsUploading] = React.useState(false);
    const [uploadStatus, setUploadStatus] = React.useState('');
    const [toast, setToast] = React.useState(null);

    const tabs = ['Câmera', 'Texto', 'Enquete'];

    React.useEffect(() => {
        document.body.style.overflow = 'hidden';
        return () => { document.body.style.overflow = ''; };
    }, []);

    const showToast = (msg) => {
        setToast(msg);
        setTimeout(() => setToast(null), 3000);
    };

    const handleTouchStart = (e) => {
        setStartX(e.touches[0].clientX);
        isSwiping.current = true;
    };

    const handleTouchMove = (e) => {
        if (!isSwiping.current || startX === null) return;
        const currentX = e.touches[0].clientX;
        const diff = currentX - startX;
        setCurrentTranslate(diff);
    };

    const handleTouchEnd = () => {
        if (!isSwiping.current) return;
        isSwiping.current = false;
        
        if (currentTranslate < -50 && activeIndex < tabs.length - 1) {
            setActiveIndex(prev => prev + 1);
        } else if (currentTranslate > 50 && activeIndex > 0) {
            setActiveIndex(prev => prev - 1);
        }
        setCurrentTranslate(0);
        setStartX(null);
    };

    // IndexedDB for Drafts
    const saveToIndexedDB = (key, data) => {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open('PhantoraDrafts', 1);
            request.onupgradeneeded = (e) => {
                const db = e.target.result;
                if (!db.objectStoreNames.contains('drafts')) {
                    db.createObjectStore('drafts');
                }
            };
            request.onsuccess = (e) => {
                const db = e.target.result;
                const tx = db.transaction('drafts', 'readwrite');
                const store = tx.objectStore('drafts');
                store.put(data, key);
                tx.oncomplete = () => resolve();
                tx.onerror = () => reject(tx.error);
            };
            request.onerror = () => reject(request.error);
        });
    };

    const handleGallerySelect = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        setGalleryFile(file);
        const url = URL.createObjectURL(file);
        setGalleryPreview({ url, type: file.type.startsWith('video/') ? 'video' : 'image' });

        // Save to IndexedDB as Base64 Draft
        const reader = new FileReader();
        reader.onloadend = async () => {
            try {
                await saveToIndexedDB('gallery_draft', {
                    base64: reader.result,
                    type: file.type,
                    name: file.name,
                    timestamp: Date.now()
                });
                showToast("Salvo no rascunho local.");
            } catch (err) {
                console.error("Erro ao salvar no IndexedDB:", err);
            }
        };
        reader.readAsDataURL(file);
    };

    const uploadTextToCDN = async (text) => {
        const uid = user?.id || user?.uid || localStorage.getItem('token_user_id');
        const blob = new Blob([text], { type: 'text/plain' });
        const file = new File([blob], `text_${Date.now()}.txt`, { type: 'text/plain' });
        return await window.api.uploadToCDN(file, uid, 'textos');
    };

    const handleGenericUpload = async (type) => {
        setIsUploading(true);
        setUploadStatus('Processando...');

        try {
            const uid = user?.id || user?.uid || localStorage.getItem('token_user_id') || 'anonymous';
            if (uid === 'anonymous') throw new Error("Usuário não identificado.");

            let textCdnUrl = null;
            let pollCdnUrl = null;
            let mediaUrls = [];
            let finalPollData = null;
            let finalType = type;
            let finalContent = '';

            if (type === 'text') {
                if (!textBody.trim()) {
                    showToast("Escreva algo antes de publicar.");
                    setIsUploading(false);
                    return;
                }
                setUploadStatus('Enviando texto...');
                textCdnUrl = await uploadTextToCDN(textBody);
                finalContent = textBody;
            } else if (type === 'poll') {
                if (!pollQuestion.trim() || pollOptions.filter(o => o.trim()).length < 2) {
                    showToast("Preencha a pergunta e pelo menos 2 opções.");
                    setIsUploading(false);
                    return;
                }
                setUploadStatus('Salvando enquete...');
                finalPollData = {
                    question: pollQuestion,
                    options: pollOptions.filter(o => o.trim()).map((o, idx) => ({ id: idx.toString(), text: o }))
                };
                const blob = new Blob([JSON.stringify(finalPollData)], { type: 'application/json' });
                const file = new File([blob], `poll_${Date.now()}.json`, { type: 'application/json' });
                pollCdnUrl = await window.api.uploadToCDN(file, uid, 'enquetes');
            }

            setUploadStatus('Salvando publicação...');
            const db = window.firebaseDB;
            if (db) {
                const newPost = {
                    authorId: uid,
                    type: finalType,
                    title: title.trim(),
                    content: finalContent,
                    textCdnUrl: textCdnUrl,
                    textContent: finalType === 'text' ? finalContent : '',
                    pollCdnUrl: pollCdnUrl,
                    pollData: finalPollData,
                    question: finalPollData ? finalPollData.question : null,
                    options: finalPollData ? finalPollData.options : null,
                    mediaUrls: mediaUrls,
                    audioId: audioId || null,
                    timestamp: Date.now(),
                    views: 0
                };
                
                const newPostRef = await db.ref('posts').push(newPost);
                await db.ref(`users/${uid}/user_posts/${newPostRef.key}`).set({
                    timestamp: Date.now(),
                    type: finalType
                });
            }

            setUploadStatus('Concluído!');
            showToast("Publicado com sucesso!");
            
            // Clear draft if gallery
            if (type === 'gallery') {
                const request = indexedDB.open('PhantoraDrafts', 1);
                request.onsuccess = (e) => {
                    const db = e.target.result;
                    const tx = db.transaction('drafts', 'readwrite');
                    tx.objectStore('drafts').delete('gallery_draft');
                };
            }

            setTimeout(() => onUploadComplete(), 1500);

        } catch (error) {
            console.error("Upload Error:", error);
            setUploadStatus('Erro: ' + (error.message || 'Erro desconhecido'));
            showToast("Falha: " + (error.message || "Tente novamente."));
            setIsUploading(false);
        }
    };

    const handleCameraCapture = async (file, type, audio, text) => {
        setIsUploading(true);
        setUploadStatus('Processando mídia...');
        
        try {
            const uid = user?.id || user?.uid || localStorage.getItem('token_user_id') || 'anonymous';
            const mediaUrl = await window.api.uploadToCDN(file, uid, 'midia');
            
            const db = window.firebaseDB;
            if (db) {
                const newPost = {
                    authorId: uid,
                    type: type === 'video' ? 'video' : 'carousel',
                    title: '',
                    content: text || '',
                    mediaUrls: [mediaUrl],
                    audioId: audioId || null,
                    timestamp: Date.now(),
                    views: 0
                };
                
                const newPostRef = await db.ref('posts').push(newPost);
                await db.ref(`users/${uid}/user_posts/${newPostRef.key}`).set({
                    timestamp: Date.now(),
                    type: newPost.type
                });
            }
            
            showToast("Publicado com sucesso!");
            setTimeout(() => onUploadComplete(), 1500);
            
        } catch (err) {
            console.error(err);
            showToast("Erro ao publicar mídia.");
            setIsUploading(false);
        }
    };

    const handlePublishClick = () => {
        if (activeIndex === 1) handleGenericUpload('text');
        else if (activeIndex === 2) handleGenericUpload('poll');
    };

    return (
        <div className="fixed inset-0 bg-black z-[200] flex flex-col overflow-hidden text-white" data-name="post-creator-fullscreen">
            {toast && <div className="fixed top-10 left-1/2 -translate-x-1/2 bg-gray-800 px-4 py-2 rounded-full z-[250] shadow-lg border border-gray-700">{toast}</div>}
            
            {/* Top Bar */}
            <div className="absolute top-0 left-0 right-0 z-[210] p-4 flex justify-between items-center bg-gradient-to-b from-black/60 to-transparent">
                <button onClick={onClose} className="w-10 h-10 rounded-full bg-black/40 backdrop-blur-md flex items-center justify-center border border-white/10 text-white hover:bg-white/20 transition">
                    <div className="icon-x text-xl"></div>
                </button>
                {activeIndex !== 0 && (
                    <button 
                        onClick={handlePublishClick}
                        disabled={isUploading}
                        className="bg-indigo-600 px-6 py-2 rounded-full font-bold shadow-lg hover:bg-indigo-700 transition flex items-center gap-2"
                    >
                        {isUploading ? <><div className="icon-loader animate-spin"></div> {uploadStatus}</> : 'Publicar'}
                    </button>
                )}
            </div>

            {/* Audio Indicator (if any) */}
            {audioId && (
                <div className="absolute top-20 left-4 z-[210] bg-black/50 backdrop-blur-md px-3 py-1.5 rounded-full flex items-center gap-2 border border-white/10">
                    <div className="icon-music text-indigo-400"></div>
                    <span className="text-sm font-medium">Áudio Vinculado</span>
                </div>
            )}

            {/* Swipeable Container */}
            <div 
                className="flex-1 w-full h-full flex transition-transform duration-300 ease-out relative"
                style={{ transform: `translateX(calc(-${activeIndex * 100}vw + ${currentTranslate}px))` }}
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
            >
                {/* 0: Camera */}
                <div className="w-screen h-full flex-shrink-0 relative pb-24">
                    {window.CameraCapture && (
                        <window.CameraCapture 
                            onCapture={handleCameraCapture} 
                            onClose={onClose} 
                            embedded={true}
                        />
                    )}
                </div>

                {/* 1: Text */}
                <div className="w-screen h-full flex-shrink-0 flex items-center justify-center p-6 bg-gradient-to-br from-indigo-900/40 to-purple-900/40">
                    <div className="w-full max-w-md bg-black/40 backdrop-blur-xl border border-white/10 rounded-3xl p-6 shadow-2xl flex flex-col">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="w-12 h-12 rounded-full bg-indigo-500/20 flex items-center justify-center text-indigo-400">
                                <div className="icon-type text-2xl"></div>
                            </div>
                            <div>
                                <h3 className="text-xl font-bold">Criar Texto</h3>
                                <p className="text-white/50 text-sm">Compartilhe um pensamento longo</p>
                            </div>
                        </div>
                        <input 
                            type="text" 
                            value={title} 
                            onChange={e => setTitle(e.target.value)} 
                            placeholder="Título (opcional)" 
                            className="w-full bg-white/5 border border-white/10 rounded-xl p-4 outline-none focus:border-indigo-500 mb-4 transition-colors font-semibold" 
                        />
                        <textarea 
                            value={textBody} 
                            onChange={e => setTextBody(e.target.value)} 
                            placeholder="O que está acontecendo?" 
                            className="w-full bg-white/5 border border-white/10 rounded-xl p-4 min-h-[200px] outline-none focus:border-indigo-500 resize-none transition-colors" 
                        ></textarea>
                    </div>
                </div>

                {/* 2: Poll */}
                <div className="w-screen h-full flex-shrink-0 flex items-center justify-center p-6 bg-gradient-to-br from-purple-900/40 to-pink-900/40">
                    <div className="w-full max-w-md bg-black/40 backdrop-blur-xl border border-white/10 rounded-3xl p-6 shadow-2xl flex flex-col">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="w-12 h-12 rounded-full bg-pink-500/20 flex items-center justify-center text-pink-400">
                                <div className="icon-chart-bar text-2xl"></div>
                            </div>
                            <div>
                                <h3 className="text-xl font-bold">Criar Enquete</h3>
                                <p className="text-white/50 text-sm">Faça uma pergunta ao seu público</p>
                            </div>
                        </div>
                        
                        <input 
                            type="text" 
                            placeholder="Faça uma pergunta..." 
                            value={pollQuestion} 
                            onChange={e => setPollQuestion(e.target.value)} 
                            className="w-full bg-white/10 border border-white/20 rounded-xl p-4 outline-none focus:border-pink-500 mb-6 font-bold text-lg transition-colors placeholder:text-white/40" 
                        />
                        
                        <div className="space-y-3 mb-4 max-h-[40vh] overflow-y-auto pr-2 custom-scrollbar">
                            {pollOptions.map((opt, i) => (
                                <div key={i} className="flex gap-2">
                                    <div className="w-12 h-12 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-white/50 font-bold shrink-0">
                                        {String.fromCharCode(65 + i)}
                                    </div>
                                    <input 
                                        type="text" 
                                        placeholder={`Opção ${i+1}`} 
                                        value={opt} 
                                        onChange={e => {
                                            const newOpts = [...pollOptions];
                                            newOpts[i] = e.target.value;
                                            setPollOptions(newOpts);
                                        }} 
                                        className="flex-1 bg-white/5 border border-white/10 rounded-xl p-3 outline-none focus:border-pink-500 transition-colors" 
                                    />
                                    {pollOptions.length > 2 && (
                                        <button 
                                            onClick={() => setPollOptions(pollOptions.filter((_, idx) => idx !== i))}
                                            className="w-12 h-12 rounded-xl bg-red-500/20 text-red-400 flex items-center justify-center hover:bg-red-500/30 transition-colors"
                                        >
                                            <div className="icon-trash"></div>
                                        </button>
                                    )}
                                </div>
                            ))}
                        </div>
                        
                        {pollOptions.length < 5 && (
                            <button 
                                onClick={() => setPollOptions([...pollOptions, ''])} 
                                className="w-full py-3 rounded-xl border border-dashed border-white/30 text-white/70 hover:bg-white/5 hover:text-white transition-colors flex items-center justify-center gap-2 font-bold"
                            >
                                <div className="icon-plus"></div> Adicionar opção
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* Bottom Navigation */}
            <div className="absolute bottom-6 left-0 right-0 z-[210] flex justify-center pointer-events-none">
                <div className="bg-black/50 backdrop-blur-xl border border-white/10 rounded-full flex items-center px-2 py-2 pointer-events-auto">
                    {tabs.map((tab, idx) => (
                        <button
                            key={idx}
                            onClick={() => setActiveIndex(idx)}
                            className={`px-4 py-2 rounded-full font-semibold transition-all duration-300 text-sm whitespace-nowrap ${activeIndex === idx ? 'bg-white text-black shadow-lg' : 'text-white/60 hover:text-white'}`}
                        >
                            {tab}
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );
}

window.PostCreator = PostCreator;