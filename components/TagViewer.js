function TagViewer({ tagId, onClose, onOpenVideo, currentUser }) {
    const [tag, setTag] = React.useState(null);
    const [senderData, setSenderData] = React.useState(null);
    const [videoPost, setVideoPost] = React.useState(null);
    const [videoUrl, setVideoUrl] = React.useState(null);
    const [isLoading, setIsLoading] = React.useState(true);
    const [isFollowing, setIsFollowing] = React.useState(false);
    const [isFollowingLoading, setIsFollowingLoading] = React.useState(false);
    const [error, setError] = React.useState(null);
    const [idToken, setIdToken] = React.useState(null);

    React.useEffect(() => {
        const fetchToken = async () => {
            try {
                let token = null;
                if (window.api && typeof window.api.getAuthToken === 'function') {
                    token = await window.api.getAuthToken();
                }
                if (!token && window.firebaseAuth?.currentUser) {
                    token = await window.firebaseAuth.currentUser.getIdToken(true);
                }
                if (token) setIdToken(token);
            } catch (e) {}
        };
        fetchToken();
    }, []);

    const cdnUrl = (url) => {
        if (!url || typeof url !== 'string') return '';
        if (!url.includes('cdn-phantora') && !url.includes('puter.work')) return url;
        if (!idToken) return url;
        if (url.includes('auth=')) return url;
        const sep = url.includes('?') ? '&' : '?';
        return `${url}${sep}auth=${encodeURIComponent(idToken)}`;
    };

    const extractUrl = (item) => {
        if (!item) return '';
        if (typeof item === 'string') return item;
        if (typeof item === 'object') return item.url || item.src || item.file || '';
        return '';
    };

    const isVideoUrl = (url) => {
        if (!url || typeof url !== 'string') return false;
        const lower = url.toLowerCase();
        if (lower.match(/\.(jpg|jpeg|png|gif|webp|bmp|svg)(\?|$)/i)) return false;
        if (lower.match(/\.(mp4|webm|ogg|mov|m4v|avi|mkv)(\?|$)/i)) return true;
        if (lower.includes('-mp4')) return true;
        if (lower.includes('.mp4')) return true;
        if (lower.includes('/video')) return true;
        return false;
    };

    React.useEffect(() => {
        const db = window.firebaseDB;
        if (!db || !tagId) return;

        const loadTag = async () => {
            try {
                const snap = await db.ref(`tags/${tagId}`).once('value');
                const data = snap.val();

                if (!data) {
                    setError("Tag não encontrada ou já foi usada.");
                    setIsLoading(false);
                    return;
                }

                const now = Date.now();
                if (data.expiresAt && now > data.expiresAt) {
                    setError("Esta tag expirou (válida por 24h).");
                    setIsLoading(false);
                    try { await db.ref(`tags/${tagId}`).remove(); } catch (e) {}
                    return;
                }

                setTag(data);

                // Buscar o post/vídeo da tag
                if (data.videoId) {
                    const postSnap = await db.ref(`posts/${data.videoId}`).once('value').catch(() => null);
                    if (postSnap && postSnap.exists()) {
                        const post = postSnap.val();
                        setVideoPost({ id: data.videoId, ...post });
                        
                        const raw = extractUrl(post.mediaUrl) || (post.mediaUrls && extractUrl(post.mediaUrls[0]));
                        if (raw) {
                            setVideoUrl(cdnUrl(raw));
                        }
                    }
                }

                // Busca dados do remetente
                if (data.senderId) {
                    const [photoSnap, userSnap] = await Promise.all([
                        db.ref(`users/${data.senderId}/profilePicture`).once('value').catch(() => null),
                        db.ref(`users/${data.senderId}`).once('value').catch(() => null)
                    ]);
                    const profilePicture = photoSnap ? photoSnap.val() : null;
                    const uData = userSnap && userSnap.exists() ? userSnap.val() : {};
                    setSenderData({
                        id: data.senderId,
                        name: uData.name || 'Usuário',
                        username: uData.username || 'usuario',
                        avatar: profilePicture || 'assets/default-avatar.svg',
                        isVerified: !!uData.isVerified
                    });

                    if (currentUser?.id || currentUser?.uid || currentUser?.privateId) {
                        const uid = currentUser.id || currentUser.uid || currentUser.privateId;
                        if (uid !== data.senderId) {
                            const followSnap = await db.ref(`follows/${uid}/${data.senderId}`).once('value');
                            setIsFollowing(!!followSnap.val());
                        }
                    }
                }

                setIsLoading(false);
            } catch (e) {
                console.error("Erro ao carregar tag:", e);
                setError("Erro ao carregar tag.");
                setIsLoading(false);
            }
        };

        loadTag();
    }, [tagId, idToken]);

    const handleFollow = async () => {
        if (!currentUser || !tag?.senderId) return;
        const db = window.firebaseDB;
        const uid = currentUser.id || currentUser.uid || currentUser.privateId;
        if (uid === tag.senderId) return;
        setIsFollowingLoading(true);
        try {
            if (isFollowing) {
                await db.ref(`follows/${uid}/${tag.senderId}`).remove();
                setIsFollowing(false);
            } else {
                await db.ref(`follows/${uid}/${tag.senderId}`).set(true);
                setIsFollowing(true);
            }
        } catch (e) {
            console.error("Erro ao seguir:", e);
        } finally {
            setIsFollowingLoading(false);
        }
    };

    const handleOpenVideo = () => {
        if (tag?.videoId) onOpenVideo(tag.videoId, tag.startTime || 0);
        if (onClose) onClose();
    };

    const isDark = true; // Sempre escuro por causa do vídeo de fundo
    const textMuted = 'text-white/60';

    if (isLoading) {
        return (
            <div className="fixed inset-0 z-[200] bg-black flex flex-col items-center justify-center">
                <div className="icon-loader animate-spin text-white text-4xl mb-4"></div>
                <p className="text-white/60 text-sm">Carregando tag...</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="fixed inset-0 z-[200] bg-black flex flex-col items-center justify-center p-6">
                <div className="w-20 h-20 rounded-full bg-red-500/10 flex items-center justify-center mb-4">
                    <div className="icon-alert-circle text-red-400 text-4xl"></div>
                </div>
                <h2 className="text-white text-xl font-bold mb-2">Tag indisponível</h2>
                <p className="text-white/60 text-sm text-center mb-6">{error}</p>
                <button onClick={onClose} className="px-6 py-3 bg-white/10 hover:bg-white/20 text-white rounded-xl font-bold transition">Fechar</button>
            </div>
        );
    }

    const isOwnTag = currentUser && (currentUser.id || currentUser.uid || currentUser.privateId) === tag?.senderId;

    return (
        <div className="fixed inset-0 z-[200] bg-black overflow-hidden">

            {/* ⬇️ VÍDEO DE FUNDO DESFOCADO */}
            {videoUrl && (
                <div className="absolute inset-0 z-0">
                    <video 
                        src={videoUrl}
                        autoPlay
                        loop
                        muted
                        playsInline
                        className="w-full h-full object-cover"
                        style={{ filter: 'blur(40px) brightness(0.5) saturate(1.3)', transform: 'scale(1.2)' }}
                    />
                    {/* Overlay escuro */}
                    <div className="absolute inset-0 bg-black/60"></div>
                </div>
            )}

            {/* Se não tiver vídeo, fundo preto */}
            {!videoUrl && <div className="absolute inset-0 bg-gradient-to-br from-purple-900 to-black z-0"></div>}

            {/* Close button */}
            <div className="absolute top-4 right-4 z-20">
                <button 
                    onClick={onClose} 
                    className="w-10 h-10 rounded-full bg-black/50 backdrop-blur-md flex items-center justify-center text-white border border-white/20 hover:bg-white/20 transition"
                >
                    <div className="icon-x text-xl"></div>
                </button>
            </div>

            {/* CARD CENTRAL */}
            <div className="relative z-10 flex items-center justify-center min-h-screen p-4">
                <div className="w-full max-w-sm backdrop-blur-2xl bg-black/40 border border-white/10 rounded-3xl overflow-hidden shadow-2xl">

                    {/* Header colorido tipo banner */}
                    <div className="h-24 bg-gradient-to-br from-purple-500 via-pink-500 to-indigo-600 relative">
                        <div className="absolute inset-0 bg-black/20"></div>
                    </div>

                    <div className="px-6 pb-6 -mt-12 text-center">
                        <div className="flex justify-center mb-4">
                            <div className="relative">
                                <img 
                                    src={senderData?.avatar || 'assets/default-avatar.svg'} 
                                    onError={(e) => { e.target.src = 'assets/default-avatar.svg'; }}
                                    className="w-24 h-24 rounded-full object-cover border-4 border-black/60 shadow-lg"
                                />
                                <div className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center border-2 border-black/60">
                                    <div className="icon-share-2 text-white text-xs"></div>
                                </div>
                            </div>
                        </div>

                        <div className="mb-2">
                            <h2 className="text-white text-xl font-bold flex items-center justify-center gap-1">
                                {senderData?.name || 'Usuário'}
                                {senderData?.isVerified && (
                                    <div className="icon-badge-check text-blue-400 text-sm"></div>
                                )}
                            </h2>
                            <p className="text-sm text-white/50">@{senderData?.username || 'usuario'}</p>
                        </div>

                        <p className="text-white text-[15px] font-medium mb-1 mt-4">
                            te enviou um vídeo 🎬
                        </p>
                        <p className="text-xs text-white/50 mb-6">
                            {tag?.startTime > 0 ? `Começa em ${Math.floor(tag.startTime)}s` : 'Assista agora'}
                        </p>

                        {!isOwnTag && (
                            <button 
                                onClick={handleFollow}
                                disabled={isFollowingLoading}
                                className={`w-full py-3 rounded-xl font-bold transition-all active:scale-[0.98] mb-3 ${
                                    isFollowing 
                                        ? 'bg-white/10 text-white/60 border border-white/20' 
                                        : 'bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-lg'
                                } disabled:opacity-50`}
                            >
                                {isFollowingLoading ? (
                                    <div className="flex items-center justify-center gap-2">
                                        <div className="icon-loader animate-spin"></div>
                                        <span>...</span>
                                    </div>
                                ) : isFollowing ? (
                                    <div className="flex items-center justify-center gap-2">
                                        <div className="icon-check text-lg"></div>
                                        <span>Seguindo</span>
                                    </div>
                                ) : (
                                    <div className="flex items-center justify-center gap-2">
                                        <div className="icon-user-plus text-lg"></div>
                                        <span>Seguir</span>
                                    </div>
                                )}
                            </button>
                        )}

                        <button 
                            onClick={handleOpenVideo}
                            className="w-full py-4 bg-white text-black rounded-xl font-bold shadow-lg hover:bg-gray-200 transition-all active:scale-[0.98] flex items-center justify-center gap-2"
                        >
                            <div className="icon-play text-xl"></div>
                            <span>Assistir agora</span>
                        </button>

                        <p className="text-[11px] text-white/40 mt-4 flex items-center justify-center gap-1">
                            <div className="icon-clock text-xs"></div>
                            Esta tag expira em 24h
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}

window.TagViewer = TagViewer;