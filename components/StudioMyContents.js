function StudioMyContents({ user }) {
    const [contents, setContents] = React.useState([]);
    const [loading, setLoading] = React.useState(true);

    React.useEffect(() => {
        const uid = user?.uid || user?.id || localStorage.getItem('token_user_id');
        if (!uid || uid === 'anonymous') {
            setLoading(false);
            return;
        }

        const db = window.firebaseDB || window.firebase.database();

        const fetchUserContents = async () => {
            setLoading(true);
            try {
                // Passo 1: Buscar referências no perfil do usuário
                const snap = await db.ref(`users/${uid}/user_posts`).once('value');
                
                if (!snap.exists()) {
                    setContents([]);
                    setLoading(false);
                    return;
                }

                const userPostsData = snap.val();
                const postIds = Object.keys(userPostsData);

                // Passo 2: Buscar os dados completos usando os IDs
                const postPromises = postIds.map(id => db.ref(`posts/${id}`).once('value'));
                const postSnaps = await Promise.all(postPromises);
                
                const fetchedContents = postSnaps
                    .filter(s => s.exists())
                    .map(s => ({ 
                        id: s.key, 
                        ...s.val(),
                        timestamp: s.val().timestamp || userPostsData[s.key]?.timestamp || 0
                    }))
                    .sort((a, b) => b.timestamp - a.timestamp);

                setContents(fetchedContents);
            } catch (err) {
                console.error("[Phantora Studio] Erro ao buscar conteúdos:", err);
            } finally {
                setLoading(false);
            }
        };

        fetchUserContents();
    }, [user]);

    const formatTime = (ts) => {
        if (!ts) return 'Desconhecido';
        const d = new Date(ts);
        return d.toLocaleDateString('pt-BR') + ' ' + d.toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'});
    };

    const getIconForType = (type) => {
        if (type === 'video') return 'video';
        if (type === 'photo' || type === 'image') return 'image';
        if (type === 'audio') return 'music';
        if (type === 'poll') return 'chart-bar';
        return 'file-text';
    };

    return (
        <div className="flex flex-col h-full bg-[var(--dark-bg)] text-white overflow-hidden p-4 md:p-8 relative">
            <div className="flex flex-col gap-4 mb-6">
                <h1 className="text-2xl font-bold flex items-center gap-2">
                    <div className="icon-folder-open text-indigo-500"></div> 
                    Seus Conteúdos
                </h1>
                <p className="text-gray-400 text-sm">
                    Gerencie todos os posts, vídeos e fotos que você já publicou.
                </p>
            </div>

            <div className="flex-1 min-h-0 bg-[var(--dark-surface)] border border-[var(--dark-border)] rounded-2xl overflow-y-auto p-4 md:p-6">
                {loading ? (
                    <div className="flex flex-col items-center justify-center h-40 text-gray-400 gap-3">
                        <div className="icon-loader animate-spin text-3xl"></div>
                        <p>Carregando seus conteúdos...</p>
                    </div>
                ) : contents.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-40 text-gray-500 gap-3">
                        <div className="icon-inbox text-4xl opacity-50"></div>
                        <p>Você ainda não tem nenhum conteúdo publicado.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {contents.map(item => (
                            <div key={item.id} className="bg-gray-800/50 border border-[var(--dark-border)] rounded-xl p-4 flex flex-col gap-3 hover:border-indigo-500/50 transition-colors">
                                <div className="flex items-start justify-between">
                                    <div className="flex items-center gap-2">
                                        <div className={`p-2 rounded-lg bg-gray-900 text-indigo-400`}>
                                            <div className={`icon-${getIconForType(item.type)}`}></div>
                                        </div>
                                        <div>
                                            <h3 className="font-semibold text-white line-clamp-1">{item.title || item.question || 'Sem título'}</h3>
                                            <p className="text-xs text-gray-400">{formatTime(item.timestamp)}</p>
                                        </div>
                                    </div>
                                </div>
                                {item.mediaUrl && (
                                    <div className="w-full h-32 bg-black rounded-lg overflow-hidden relative">
                                        {item.type === 'video' ? (
                                            <video src={item.mediaUrl} className="w-full h-full object-cover opacity-70" />
                                        ) : (
                                            <img src={item.mediaUrl} className="w-full h-full object-cover opacity-70" alt="Preview" />
                                        )}
                                    </div>
                                )}
                                <div className="text-sm text-gray-300 line-clamp-2">
                                    {item.content || item.description || ''}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

window.StudioMyContents = StudioMyContents;