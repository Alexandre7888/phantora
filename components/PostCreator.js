function PostCreator({ user, onClose, onUploadComplete, initialAudioId = null }) {
    const [audioId, setAudioId] = React.useState(initialAudioId);
    const [isUploading, setIsUploading] = React.useState(false);
    const [uploadStatus, setUploadStatus] = React.useState('');
    const [toast, setToast] = React.useState(null);

    React.useEffect(() => {
        document.body.style.overflow = 'hidden';
        return () => { document.body.style.overflow = ''; };
    }, []);

    const showToast = (msg) => {
        setToast(msg);
        setTimeout(() => setToast(null), 3000);
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

    return (
        <div className="fixed inset-0 bg-black z-[200] flex flex-col overflow-hidden text-white" data-name="post-creator-fullscreen">
            {toast && <div className="fixed top-10 left-1/2 -translate-x-1/2 bg-gray-800 px-4 py-2 rounded-full z-[250] shadow-lg border border-gray-700">{toast}</div>}

            {/* Top Bar - Apenas status de upload (sem botão X) */}
            <div className="absolute top-0 left-0 right-0 z-[210] p-4 flex justify-end items-center bg-gradient-to-b from-black/60 to-transparent pointer-events-none">
                {isUploading && (
                    <div className="bg-indigo-600 px-6 py-2 rounded-full font-bold shadow-lg flex items-center gap-2 pointer-events-auto">
                        <div className="icon-loader animate-spin"></div>
                        {uploadStatus}
                    </div>
                )}
            </div>

            {/* Audio Indicator (if any) */}
            {audioId && (
                <div className="absolute top-20 left-4 z-[210] bg-black/50 backdrop-blur-md px-3 py-1.5 rounded-full flex items-center gap-2 border border-white/10">
                    <div className="icon-music text-indigo-400"></div>
                    <span className="text-sm font-medium">Áudio Vinculado</span>
                </div>
            )}

            {/* Camera Fullscreen */}
            <div className="flex-1 w-full h-full relative">
                {window.CameraCapture && (
                    <window.CameraCapture 
                        onCapture={handleCameraCapture} 
                        onClose={onClose} 
                        embedded={true}
                    />
                )}
            </div>
        </div>
    );
}

window.PostCreator = PostCreator;
