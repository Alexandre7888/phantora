function GenericUpload({ user, contentType, config, onClose, onUploadComplete }) {
    const STATES = { IDLE: 'idle', SELECTING: 'selecting', UPLOADING: 'uploading', SUCCESS: 'success', ERROR: 'error' };
    
    const [currentState, setCurrentState] = React.useState(STATES.IDLE);
    const [file, setFile] = React.useState(null);
    const [previewUrl, setPreviewUrl] = React.useState('');
    const [title, setTitle] = React.useState('');
    const [description, setDescription] = React.useState('');
    const [uploadProgress, setUploadProgress] = React.useState(0);
    const [uploadStatus, setUploadStatus] = React.useState('');
    const [toast, setToast] = React.useState(null);

    React.useEffect(() => {
        document.body.style.overflow = 'hidden';
        return () => { document.body.style.overflow = ''; };
    }, []);

    const showToast = (msg, type = 'info') => {
        setToast({ msg, type });
        setTimeout(() => setToast(null), 3000);
    };

    const handleFileChange = (e) => {
        const selected = e.target.files[0];
        if (!selected) return;
        
        // Basic validation
        if (config.accept && !selected.type.match(config.acceptRegex)) {
            showToast(`Por favor, selecione um arquivo válido (${config.accept}).`);
            return;
        }
        
        setFile(selected);
        setPreviewUrl(URL.createObjectURL(selected));
        setCurrentState(STATES.SELECTING);
    };

    const uploadToBackend = async () => {
        if (!file) return showToast("Selecione um arquivo primeiro.", 'error');
        if (!title.trim()) return showToast("O título é obrigatório.", 'error');

        setCurrentState(STATES.UPLOADING);
        setUploadStatus('Iniciando upload...');
        setUploadProgress(10);

        try {
            setUploadStatus('Enviando para o servidor...');
            setUploadProgress(40);
            
            let folderType = 'fotos';
            if (contentType === 'video') folderType = 'video';
            if (contentType === 'audio') folderType = 'áudio';
            
            const mediaUrl = await window.api.uploadToCDN(file, user.id, folderType);
            
            setUploadProgress(80);
            setUploadStatus('Salvando publicação...');

            const db = window.firebaseDB || window.firebase.database();
            if (db) {
                const uid = user?.id || user?.uid || localStorage.getItem('token_user_id') || 'anonymous';
                if (uid === 'anonymous') {
                    throw new Error("Usuário não identificado. Por favor, faça login novamente.");
                }

                const newPost = {
                    authorId: uid,
                    authorName: user?.name || user?.displayName || 'Usuário',
                    authorAvatar: user.avatar || '',
                    type: contentType,
                    title: title.trim(),
                    content: description.trim(),
                    mediaUrl: mediaUrl,
                    timestamp: Date.now(),
                    views: 0,
                    hashtags: []
                };
                
                // Dual-Pathing
                const newPostRef = db.ref('posts').push();
                const postId = newPostRef.key;
                
                await Promise.allSettled([
                    db.ref(`posts/${postId}`).set(newPost),
                    db.ref(`users/${uid}/posts/${postId}`).set(newPost)
                ]);
            }

            setUploadProgress(100);
            setUploadStatus('Concluído!');
            setCurrentState(STATES.SUCCESS);
            showToast("Conteúdo publicado com sucesso!", 'success');
            
            setTimeout(() => {
                onUploadComplete();
            }, 1500);

        } catch (error) {
            console.error(error);
            setCurrentState(STATES.ERROR);
            setUploadStatus('Erro no upload.');
            showToast("Falha ao publicar o conteúdo.", 'error');
        }
    };

    const renderPreview = () => {
        if (!previewUrl) return null;
        if (contentType === 'video' || contentType === 'story') {
            return <video src={previewUrl} className="w-full h-full object-cover rounded-xl" controls />;
        }
        if (contentType === 'photo') {
            return <img src={previewUrl} className="w-full h-full object-cover rounded-xl" />;
        }
        if (contentType === 'audio') {
            return (
                <div className="w-full h-full bg-gray-800 flex items-center justify-center rounded-xl p-4">
                    <audio src={previewUrl} controls className="w-full" />
                </div>
            );
        }
        return (
            <div className="w-full h-full bg-gray-800 flex flex-col items-center justify-center rounded-xl text-indigo-400">
                <div className={`icon-${config.icon} text-6xl mb-2`}></div>
                <span>{file?.name}</span>
            </div>
        );
    };

    return (
        <div className="fixed inset-0 z-[1000] bg-black/85 backdrop-blur-md flex items-center justify-center p-4 overflow-hidden" data-name="generic-upload">
            {toast && (
                <div className={`fixed bottom-4 right-4 z-[1100] px-4 py-3 rounded-lg shadow-lg text-sm flex items-center gap-2 text-white border-l-4 animate-slide-up ${toast.type === 'error' ? 'bg-red-900 border-red-500' : toast.type === 'success' ? 'bg-green-900 border-green-500' : 'bg-gray-800 border-indigo-500'}`}>
                    <div className={`icon-${toast.type === 'error' ? 'circle-alert' : toast.type === 'success' ? 'circle-check' : 'info'}`}></div>
                    {toast.msg}
                </div>
            )}
            
            <div className="bg-[#13131a] border border-[#252530] rounded-[16px] shadow-[0_8px_24px_rgba(0,0,0,0.6)] w-full max-w-4xl flex flex-col max-h-[90vh] overflow-y-auto z-[1001] p-6 relative animate-fade-in-up">
                <div className="flex items-center justify-between mb-6 border-b border-[#252530] pb-4">
                    <h1 className="text-2xl font-bold flex items-center gap-2">
                        <div className={`icon-${config.icon}`}></div> Upload de {config.label}
                    </h1>
                    <button onClick={onClose} className="p-2 hover:bg-gray-800 rounded-full"><div className="icon-x text-2xl"></div></button>
                </div>

                <div className="max-w-4xl mx-auto w-full flex gap-8">
                    <div className="flex-1 space-y-6">
                        {!previewUrl ? (
                            <div 
                                className="border-2 border-dashed border-gray-600 rounded-2xl p-10 flex flex-col items-center justify-center bg-gray-800/50 hover:bg-gray-800 transition cursor-pointer"
                                onClick={() => document.getElementById('generic-input-desktop').click()}
                            >
                                <div className={`icon-${config.icon} text-6xl text-gray-400 mb-4`}></div>
                                <h3 className="text-xl font-bold mb-2">Clique para selecionar</h3>
                                <p className="text-gray-500 text-sm text-center">Formatos: {config.accept}. Máx {config.maxSize}.</p>
                                <input id="generic-input-desktop" type="file" accept={config.accept} className="hidden" onChange={handleFileChange} />
                                
                                <button className="mt-6 bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2 rounded-xl font-bold transition">
                                    Selecionar Arquivo
                                </button>
                            </div>
                        ) : (
                            <div className="aspect-video bg-black rounded-xl overflow-hidden shadow-lg border border-gray-800 flex items-center justify-center">
                                {renderPreview()}
                            </div>
                        )}
                        
                        {previewUrl && (
                            <button onClick={() => { setFile(null); setPreviewUrl(''); }} className="text-red-400 text-sm hover:underline flex items-center gap-1">
                                <div className="icon-trash"></div> Remover Arquivo
                            </button>
                        )}
                    </div>

                    <div className="w-96 space-y-6">
                        <div>
                            <label className="block text-sm font-medium text-gray-400 mb-1">Título *</label>
                            <input 
                                type="text" 
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                placeholder="Digite um título..." 
                                className="w-full bg-gray-800 border border-gray-700 rounded-xl p-3 outline-none focus:border-indigo-500 transition"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-400 mb-1">Descrição</label>
                            <textarea 
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                placeholder="Adicione mais detalhes..." 
                                className="w-full bg-gray-800 border border-gray-700 rounded-xl p-3 outline-none focus:border-indigo-500 transition h-32 resize-none"
                            />
                        </div>

                        {previewUrl && (
                            <button 
                                onClick={uploadToBackend}
                                disabled={currentState === STATES.UPLOADING}
                                className={`w-full text-white p-4 rounded-xl font-bold transition flex justify-center items-center gap-2 mt-4 ${currentState === STATES.UPLOADING ? 'bg-indigo-800 cursor-not-allowed' : currentState === STATES.SUCCESS ? 'bg-green-600' : currentState === STATES.ERROR ? 'bg-red-600 hover:bg-red-700' : 'bg-indigo-600 hover:bg-indigo-700 active:scale-95'}`}
                            >
                                {currentState === STATES.UPLOADING ? (
                                    <><div className="icon-loader animate-spin"></div> {uploadStatus} {uploadProgress}%</>
                                ) : currentState === STATES.SUCCESS ? (
                                    <><div className="icon-circle-check"></div> Concluído</>
                                ) : currentState === STATES.ERROR ? (
                                    <><div className="icon-rotate-cw"></div> Tentar Novamente</>
                                ) : (
                                    <><div className="icon-upload"></div> Publicar {config.label}</>
                                )}
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

window.GenericUpload = GenericUpload;