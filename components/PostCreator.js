function PostCreator({ user, onClose, onUploadComplete }) {
    const [step, setStep] = React.useState('select'); // select, edit, upload
    const [postType, setPostType] = React.useState(''); // text, media, poll, audio
    
    // Media states
    const [files, setFiles] = React.useState([]); // For carousel or single video
    const [previewUrls, setPreviewUrls] = React.useState([]);
    
    // Text states
    const [textBody, setTextBody] = React.useState('');
    
    // Poll states
    const [pollQuestion, setPollQuestion] = React.useState('');
    const [pollOptions, setPollOptions] = React.useState(['', '']);
    
    const [showCamera, setShowCamera] = React.useState(false);
    const [showMediaEditor, setShowMediaEditor] = React.useState(false);
    const [mediaToEdit, setMediaToEdit] = React.useState(null);
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

    // Common states
    const [title, setTitle] = React.useState('');
    const [description, setDescription] = React.useState('');
    const [isUploading, setIsUploading] = React.useState(false);
    const [uploadStatus, setUploadStatus] = React.useState('');
    const [toast, setToast] = React.useState(null);

    const showToast = (msg) => {
        setToast(msg);
        setTimeout(() => setToast(null), 3000);
    };

    const handleFileChange = (e) => {
        const selectedFiles = Array.from(e.target.files);
        if (selectedFiles.length === 0) return;
        
        const file = selectedFiles[0];
        
        if (file.type.startsWith('video/')) {
            const video = document.createElement('video');
            video.preload = 'metadata';
            video.onloadedmetadata = () => {
                window.URL.revokeObjectURL(video.src);
                if (video.videoHeight > video.videoWidth) {
                    setMediaToEdit({
                        type: 'video',
                        url: URL.createObjectURL(file),
                        blob: file,
                        mimeType: file.type
                    });
                    setShowMediaEditor(true);
                } else {
                    setFiles(selectedFiles);
                    setPreviewUrls(selectedFiles.map(f => URL.createObjectURL(f)));
                    setPostType('video');
                    setStep('edit');
                }
            };
            video.src = URL.createObjectURL(file);
        } else {
            setFiles(selectedFiles);
            setPreviewUrls(selectedFiles.map(f => URL.createObjectURL(f)));
            setPostType('carousel');
            setStep('edit');
        }
    };

    const uploadTextToCDN = async (text) => {
        const uid = user?.id || user?.uid || localStorage.getItem('token_user_id');
        const blob = new Blob([text], { type: 'text/plain' });
        const file = new File([blob], `text_${Date.now()}.txt`, { type: 'text/plain' });
        return await window.api.uploadToCDN(file, uid, 'textos');
    };

    const uploadToBackend = async () => {
        setIsUploading(true);
        setUploadStatus('Processando...');

        try {
            let mediaUrls = [];
            let textCdnUrl = null;
            let pollCdnUrl = null;

            const uid = user?.id || user?.uid || localStorage.getItem('token_user_id') || 'anonymous';
            
            if (uid === 'anonymous') {
                throw new Error("Usuário não identificado. Por favor, faça login novamente.");
            }

            // Upload Files
            if (files.length > 0) {
                setUploadStatus('Enviando mídias...');
                for (let i = 0; i < files.length; i++) {
                    const url = await window.api.uploadToCDN(files[i], uid, 'midia');
                    mediaUrls.push(url);
                }
            }

            // Upload Text to CDN if strictly text post
            if (postType === 'text' && textBody) {
                setUploadStatus('Enviando texto...');
                textCdnUrl = await uploadTextToCDN(textBody);
            }

            // Upload Poll to CDN
            let finalPollData = null;
            if (postType === 'poll') {
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
                const uid = user.id || user.uid;
                const postFinalType = postType === 'carousel' ? 'carousel' : postType === 'video' ? 'video' : postType === 'poll' ? 'poll' : 'text';
                const newPost = {
                    authorId: uid,
                    type: postFinalType,
                    title: title.trim(),
                    content: description.trim(),
                    mediaUrls: mediaUrls.length > 0 ? mediaUrls : null,
                    textCdnUrl: textCdnUrl,
                    textContent: textBody, // Also keep plain text for search
                    pollCdnUrl: pollCdnUrl,
                    pollData: finalPollData,
                    question: finalPollData ? finalPollData.question : null,
                    options: finalPollData ? finalPollData.options : null,
                    timestamp: Date.now(),
                    views: 0
                };
                
                const newPostRef = await db.ref('posts').push(newPost);
                
                // Salvar a referência do post no perfil do usuário
                await db.ref(`users/${uid}/user_posts/${newPostRef.key}`).set({
                    timestamp: Date.now(),
                    type: postFinalType
                });
            }

            setUploadStatus('Concluído!');
            showToast("Publicado com sucesso!");
            setTimeout(() => onUploadComplete(), 1500);

        } catch (error) {
            console.error("Upload Error:", error);
            setUploadStatus('Erro: ' + (error.message || 'Erro desconhecido'));
            showToast("Falha: " + (error.message || "Tente novamente."));
            setIsUploading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/90 z-[100] flex items-center justify-center p-4 text-white" data-name="post-creator">
            {toast && <div className="fixed top-10 left-1/2 -translate-x-1/2 bg-gray-800 px-4 py-2 rounded-full z-[110]">{toast}</div>}
            
            <div className="bg-gray-900 w-full max-w-2xl rounded-2xl border border-gray-700 overflow-hidden flex flex-col max-h-[90vh]">
                <div className="p-4 border-b border-gray-800 flex justify-between items-center">
                    <h2 className="font-bold text-xl">Criar Publicação</h2>
                    <button onClick={onClose}><div className="icon-x text-2xl text-gray-400 hover:text-white"></div></button>
                </div>

                <div className="p-6 overflow-y-auto flex-1 custom-scrollbar">
                    {step === 'select' && (
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                            {isMobile && (
                                <button onClick={() => setShowCamera(true)} className="bg-gray-800 p-6 rounded-xl flex flex-col items-center gap-3 hover:bg-gray-700 transition">
                                    <div className="icon-camera text-3xl text-pink-400"></div>
                                    <span className="font-bold">Câmera</span>
                                </button>
                            )}

                            <button onClick={() => document.getElementById('media-upload').click()} className="bg-gray-800 p-6 rounded-xl flex flex-col items-center gap-3 hover:bg-gray-700 transition">
                                <div className="icon-image text-3xl text-blue-400"></div>
                                <span className="font-bold">Galeria</span>
                                <input id="media-upload" type="file" multiple accept="image/*,video/*" className="hidden" onChange={handleFileChange} />
                            </button>
                            
                            <button onClick={() => { setPostType('text'); setStep('edit'); }} className="bg-gray-800 p-6 rounded-xl flex flex-col items-center gap-3 hover:bg-gray-700 transition">
                                <div className="icon-type text-3xl text-green-400"></div>
                                <span className="font-bold">Texto</span>
                            </button>
                            
                            <button onClick={() => { setPostType('poll'); setStep('edit'); }} className="bg-gray-800 p-6 rounded-xl flex flex-col items-center gap-3 hover:bg-gray-700 transition">
                                <div className="icon-chart-bar text-3xl text-purple-400"></div>
                                <span className="font-bold">Enquete</span>
                            </button>
                        </div>
                    )}

                    {step === 'edit' && (
                        <div className="space-y-6">
                            {/* Preview Area */}
                            {previewUrls.length > 0 && (
                                <div className="flex gap-2 overflow-x-auto pb-2 custom-scrollbar">
                                    {previewUrls.map((url, i) => (
                                        <div key={i} className="w-32 h-32 flex-shrink-0 bg-black rounded-lg overflow-hidden border border-gray-700 relative">
                                            {files[i].type.startsWith('video/') ? (
                                                <video src={url} className="w-full h-full object-cover" />
                                            ) : (
                                                <img src={url} className="w-full h-full object-cover" />
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}

                            {postType === 'text' && (
                                <div>
                                    <label className="block text-sm text-gray-400 mb-2">Seu texto (salvo em CDN)</label>
                                    <textarea value={textBody} onChange={e => setTextBody(e.target.value)} className="w-full bg-gray-800 border border-gray-700 rounded-xl p-4 min-h-[150px] outline-none focus:border-indigo-500" placeholder="Escreva algo longo..."></textarea>
                                </div>
                            )}

                            {postType === 'image' && previewUrls.length === 0 && (
                                <div className="space-y-4">
                                    <label className="block text-sm text-gray-400">URL da Imagem ou Vídeo</label>
                                    <input 
                                        type="url" 
                                        placeholder="Cole o link aqui..." 
                                        className="w-full bg-gray-800 border border-gray-700 rounded-xl p-3 outline-none focus:border-indigo-500"
                                        onChange={(e) => {
                                            const url = e.target.value;
                                            if (url) {
                                                const isVid = url.match(/\.(mp4|webm|ogg|mov)$/i) || url.includes('video') || url.includes('mp4');
                                                setPostType(isVid ? 'video' : 'carousel'); // using carousel type for external image link
                                                setPreviewUrls([url]);
                                                
                                                // Create a fake file to bypass the check later if needed, or handle URL upload directly
                                                fetch(url).then(r => r.blob()).then(blob => {
                                                    const ext = isVid ? 'mp4' : 'jpg';
                                                    const file = new File([blob], `media_${Date.now()}.${ext}`, { type: blob.type });
                                                    setFiles([file]);
                                                }).catch(() => {
                                                    showToast("Link carregado como referência externa.");
                                                });
                                            }
                                        }}
                                    />
                                </div>
                            )}

                            {postType === 'poll' && (
                                <div className="space-y-4">
                                    <input type="text" placeholder="Pergunta da enquete..." value={pollQuestion} onChange={e => setPollQuestion(e.target.value)} className="w-full bg-gray-800 border border-gray-700 rounded-xl p-3 outline-none" />
                                    {pollOptions.map((opt, i) => (
                                        <div key={i} className="flex gap-2">
                                            <input type="text" placeholder={`Opção ${i+1}`} value={opt} onChange={e => {
                                                const newOpts = [...pollOptions];
                                                newOpts[i] = e.target.value;
                                                setPollOptions(newOpts);
                                            }} className="flex-1 bg-gray-800 border border-gray-700 rounded-xl p-3 outline-none" />
                                        </div>
                                    ))}
                                    {pollOptions.length < 5 && (
                                        <button onClick={() => setPollOptions([...pollOptions, ''])} className="text-indigo-400 text-sm font-bold">+ Adicionar opção</button>
                                    )}
                                </div>
                            )}

                            <div className="border-t border-gray-800 pt-6">
                                <label className="block text-sm text-gray-400 mb-2">Título (opcional)</label>
                                <input type="text" value={title} onChange={e => setTitle(e.target.value)} placeholder="Título da publicação" className="w-full bg-gray-800 border border-gray-700 rounded-xl p-3 outline-none focus:border-indigo-500 mb-4" />
                                
                                <label className="block text-sm text-gray-400 mb-2">Descrição / Hashtags</label>
                                <textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Descrição..." className="w-full bg-gray-800 border border-gray-700 rounded-xl p-3 outline-none focus:border-indigo-500 h-24 resize-none" />
                            </div>
                        </div>
                    )}
                </div>

                {step === 'edit' && (
                    <div className="p-4 border-t border-gray-800 flex justify-end gap-3">
                        <button onClick={() => {setStep('select'); setFiles([]); setPreviewUrls([]);}} className="px-6 py-2 rounded-xl font-bold text-gray-400 hover:text-white">Voltar</button>
                        <button onClick={uploadToBackend} disabled={isUploading} className="bg-indigo-600 text-white px-8 py-2 rounded-xl font-bold hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-2">
                            {isUploading ? <><div className="icon-loader animate-spin"></div> {uploadStatus}</> : 'Publicar'}
                        </button>
                    </div>
                )}
            </div>
            
            {showCamera && window.CameraCapture && (
                <window.CameraCapture 
                    onCapture={(file, type) => {
                        setShowCamera(false);
                        if (type === 'video') {
                            const video = document.createElement('video');
                            video.preload = 'metadata';
                            video.onloadedmetadata = () => {
                                window.URL.revokeObjectURL(video.src);
                                if (video.videoHeight > video.videoWidth) {
                                    setMediaToEdit({
                                        type: 'video',
                                        url: URL.createObjectURL(file),
                                        blob: file,
                                        mimeType: file.type
                                    });
                                    setShowMediaEditor(true);
                                } else {
                                    setFiles([file]);
                                    setPreviewUrls([URL.createObjectURL(file)]);
                                    setPostType('video');
                                    setStep('edit');
                                }
                            };
                            video.src = URL.createObjectURL(file);
                        } else {
                            setFiles([file]);
                            setPreviewUrls([URL.createObjectURL(file)]);
                            setPostType('carousel');
                            setStep('edit');
                        }
                    }}
                    onClose={() => setShowCamera(false)}
                />
            )}

            {showMediaEditor && mediaToEdit && window.MediaEditor && (
                <window.MediaEditor 
                    media={mediaToEdit}
                    onCancel={() => {
                        setShowMediaEditor(false);
                        setMediaToEdit(null);
                        setStep('select');
                        setFiles([]);
                        setPreviewUrls([]);
                    }}
                    onSend={(file, type, selectedAudio, text) => {
                        setShowMediaEditor(false);
                        setMediaToEdit(null);
                        setFiles([file]);
                        setPreviewUrls([URL.createObjectURL(file)]);
                        setPostType(type === 'video' ? 'video' : 'carousel');
                        if(text) setDescription(prev => prev ? prev + '\n' + text : text);
                        setStep('edit');
                    }}
                />
            )}
        </div>
    );
}

window.PostCreator = PostCreator;