function TagViewer({ tagId, onClose, onOpenVideo, currentUser }) {
    const [tag, setTag] = React.useState(null);
    const [senderData, setSenderData] = React.useState(null);
    const [isLoading, setIsLoading] = React.useState(true);
    const [isFollowing, setIsFollowing] = React.useState(false);
    const [error, setError] = React.useState(null);

    React.useEffect(() => {
        const db = window.firebaseDB;
        if (!db || !tagId) return;

        const loadTag = async () => {
            try {
                const snap = await db.ref(`tags/${tagId}`).once('value');
                const data = snap.val();

                if (!data) {
                    setError("Tag não encontrada ou expirada.");
                    setIsLoading(false);
                    return;
                }

                // Verifica se expirou (24h)
                const now = Date.now();
                if (data.expiresAt && now > data.expiresAt) {
                    setError("Esta tag expirou (válida por 24h).");
                    setIsLoading(false);
                    // Remove tag expirada
                    db.ref(`tags/${tagId}`).remove().catch(() => {});
                    return;
                }

                setTag(data);

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
                        avatar: profilePicture || 'assets/default-avatar.svg'
                    });

                    // Verifica se já segue
                    if (currentUser?.id || currentUser?.uid) {
                        const uid = currentUser.id || currentUser.uid;
                        const followSnap = await db.ref(`follows/${uid}/${data.senderId}`).once('value');
                        setIsFollowing(!!followSnap.val());
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
    }, [tagId]);

    const handleFollow = async () => {
        if (!currentUser || !tag?.senderId) return;
        const db = window.firebaseDB;
        const uid = currentUser.id || currentUser.uid;
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
        }
    };

    const handleOpenVideo = () => {
        if (tag?.videoId) {
            onOpenVideo(tag.videoId, tag.startTime || 0);
        }
        if (onClose) onClose();
    };

    if (isLoading) {
        return (
            <div className="fixed inset-0 z-[200] bg-black/95 backdrop-blur-xl flex flex-col items-center justify-center">
                <div className="icon-loader animate-spin text-white text-4xl mb-4"></div>
                <p className="text-white/60 text-sm">Carregando tag...</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="fixed inset-0 z-[200] bg-black/95 backdrop-blur-xl flex flex-col items-center justify-center p-6">
                <div className="w-20 h-20 rounded-full bg-red-500/20 flex items-center justify-center mb-4">
                    <div className="icon-alert-circle text-red-400 text-4xl"></div>
                </div>
                <h2 className="text-white text-xl font-bold mb-2">Tag indisponível</h2>
                <p className="text-white/60 text-sm text-center mb-6">{error}</p>
                <button onClick={onClose} className="px-6 py-3 bg-white/10 hover:bg-white/20 text-white rounded-xl font-bold transition">
                    Fechar
                </button>
            </div>
        );
    }

    return (
        <div className="fixed inset-0 z-[200] bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-900 flex flex-col items-center justify-center p-6 animate-fade-in">
            <div className="absolute top-4 right-4">
                <button onClick={onClose} className="w-10 h-10 rounded-full bg-black/30 backdrop-blur-md flex items-center justify-center text-white border border-white/10">
                    <div className="icon-x text-xl"></div>
                </button>
            </div>

            <div className="w-full max-w-sm bg-black/40 backdrop-blur-xl border border-white/10 rounded-3xl p-6 shadow-2xl text-center">
                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-yellow-400 to-pink-500 flex items-center justify-center mx-auto mb-4 shadow-lg">
                    <div className="icon-share-2 text-white text-3xl"></div>
                </div>

                <h2 className="text-white text-2xl font-bold mb-2">Você recebeu um vídeo!</h2>
                <p className="text-white/60 text-sm mb-6">Alguém compartilhou este vídeo com você</p>

                {senderData && (
                    <div className="flex items-center gap-3 bg-white/5 border border-white/10 rounded-2xl p-3 mb-6">
                        <img 
                            src={senderData.avatar} 
                            onError={(e) => { e.target.src = 'assets/default-avatar.svg'; }}
                            className="w-14 h-14 rounded-full object-cover border-2 border-purple-400/50"
                        />
                        <div className="flex-1 text-left">
                            <p className="text-white/40 text-xs">Enviado por</p>
                            <p className="text-white font-bold text-base">{senderData.name}</p>
                        </div>
                        {currentUser && senderData.id !== (currentUser.id || currentUser.uid) && (
                            <button 
                                onClick={handleFollow}
                                className={`px-4 py-2 rounded-full text-xs font-bold transition ${isFollowing ? 'bg-white/10 text-white/60 hover:bg-white/20' : 'bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-lg'}`}
                            >
                                {isFollowing ? 'Seguindo' : 'Seguir'}
                            </button>
                        )}
                    </div>
                )}

                {tag?.startTime > 0 && (
                    <p className="text-white/40 text-xs mb-4">
                        ⏱ Começa em {Math.floor(tag.startTime)}s
                    </p>
                )}

                <button 
                    onClick={handleOpenVideo}
                    className="w-full py-4 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-2xl font-bold shadow-lg hover:shadow-xl transition active:scale-95 flex items-center justify-center gap-2"
                >
                    <div className="icon-play text-xl"></div>
                    Assistir agora
                </button>

                <p className="text-white/30 text-xs mt-4">
                    Esta tag expira em 24h
                </p>
            </div>
        </div>
    );
}

window.TagViewer = TagViewer;