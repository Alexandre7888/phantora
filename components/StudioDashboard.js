function StudioDashboard({ user }) {
    const [uploadType, setUploadType] = React.useState(null);
    const [myContents, setMyContents] = React.useState([]);
    const [loading, setLoading] = React.useState(true);
    const [isLoadingMore, setIsLoadingMore] = React.useState(false);
    const [lastPostTimestamp, setLastPostTimestamp] = React.useState(null);
    const [hasMorePosts, setHasMorePosts] = React.useState(true);
    const [analytics, setAnalytics] = React.useState({ totalWatchTime: 0, views: 0, linkClicks: 0 });
    const PAGE_SIZE = 10;
    const [searchQuery, setSearchQuery] = React.useState('');
    const [editingPost, setEditingPost] = React.useState(null);
    const [showPostCreator, setShowPostCreator] = React.useState(false);
    const [editingContent, setEditingContent] = React.useState(null);
    const [editTitle, setEditTitle] = React.useState('');
    const [editDescription, setEditDescription] = React.useState('');
    const [showEditModal, setShowEditModal] = React.useState(false);
    const [showUploadSelect, setShowUploadSelect] = React.useState(false);
    const [showSettings, setShowSettings] = React.useState(false);
    const [communityEnabled, setCommunityEnabled] = React.useState(false);

    const contentTypes = [
        { id: 'photo', label: 'Fotos', desc: 'Imagens de alta qualidade', accept: '.jpg,.png,.gif,.webp', acceptRegex: /image\/.*/, maxSize: '10MB', icon: 'image', color: 'bg-blue-500' },
        { id: 'video', label: 'Vídeos', desc: 'Conteúdo em movimento', accept: '.mp4,.mov,.avi', acceptRegex: /video\/.*/, maxSize: '500MB', icon: 'video', color: 'bg-purple-500' },
        { id: 'audio', label: 'Áudios', desc: 'Músicas e podcasts', accept: '.mp3,.wav', acceptRegex: /audio\/.*/, maxSize: '50MB', icon: 'music', color: 'bg-green-500' },
        { id: 'document', label: 'Documentos', desc: 'PDF, DOC, e mais', accept: '.pdf,.doc,.docx', acceptRegex: /application\/.*/, maxSize: '20MB', icon: 'file-text', color: 'bg-orange-500' },
        { id: 'story', label: 'Stories', desc: 'Conteúdo efêmero (60s)', accept: '.jpg,.png,.mp4', acceptRegex: /(image|video)\/.*/, maxSize: '50MB', icon: 'clock', color: 'bg-pink-500' },
    ];

    const calculateAnalytics = (aData) => {
        let watchMs = 0;
        let viewCount = 0;
        let clicks = 0;
        
        if (aData) {
            Object.keys(aData).forEach(vidId => {
                if (vidId.endsWith('_clicks')) {
                    clicks += Object.keys(aData[vidId]).length;
                } else {
                    const views = aData[vidId];
                    Object.keys(views).forEach(vKey => {
                        viewCount++;
                        watchMs += (views[vKey].watchTimeMs || 0);
                    });
                }
            });
        }
        
        return { totalWatchTime: watchMs, views: viewCount, linkClicks: clicks };
    };

    React.useEffect(() => {
        if(!user || (!user.uid && !user.id)) return;
        const uid = user.uid || user.id;
        
        const db = window.firebaseDB || window.firebase.database();
        setLoading(true);

        const fetchUserPosts = async (isLoadMore = false) => {
            try {
                if (!isLoadMore) {
                    setLoading(true);
                } else {
                    setIsLoadingMore(true);
                }

                // Passo 1: Buscar referências paginadas ordenadas por timestamp
                let query = db.ref(`users/${uid}/user_posts`).orderByChild('timestamp');
                
                if (isLoadMore && lastPostTimestamp) {
                    query = query.endBefore(lastPostTimestamp).limitToLast(PAGE_SIZE);
                } else {
                    query = query.limitToLast(PAGE_SIZE);
                }

                const snap = await query.once('value');
                
                if (!snap.exists()) {
                    setHasMorePosts(false);
                    if (!isLoadMore) setMyContents([]);
                    setLoading(false);
                    setIsLoadingMore(false);
                    return;
                }

                const userPostsData = snap.val();
                
                // Mapeia o JSON que você mostrou: {"ID": {"timestamp": 123, "type": "video"}}
                const postEntries = Object.keys(userPostsData).map(key => ({
                    id: key,
                    timestamp: userPostsData[key].timestamp || 0,
                    type: userPostsData[key].type || 'unknown'
                })).sort((a, b) => b.timestamp - a.timestamp);

                if (postEntries.length < PAGE_SIZE) {
                    setHasMorePosts(false);
                } else {
                    setHasMorePosts(true);
                }
                
                if (postEntries.length > 0) {
                    setLastPostTimestamp(postEntries[postEntries.length - 1].timestamp);
                }

                // Passo 2: Busca os dados completos usando Fan-out (apenas os 10 IDs baixados)
                const postPromises = postEntries.map(entry => db.ref(`posts/${entry.id}`).once('value'));
                const postSnaps = await Promise.all(postPromises);
                
                const newPosts = postSnaps
                    .filter(s => s.exists())
                    .map((s, index) => ({ 
                        id: s.key, 
                        ...s.val(),
                        timestamp: s.val().timestamp || postEntries[index].timestamp
                    }));

                if (isLoadMore) {
                    setMyContents(prev => {
                        const existingIds = new Set(prev.map(p => p.id));
                        const uniqueNewPosts = newPosts.filter(p => !existingIds.has(p.id));
                        return [...prev, ...uniqueNewPosts];
                    });
                } else {
                    setMyContents(newPosts);
                }
            } catch (err) {
                console.error("[Phantora Studio] fetchUserPosts: ❌", err);
            } finally {
                setLoading(false);
                setIsLoadingMore(false);
            }
        };

        // Guarda a função no window caso precise ser chamada de fora
        window.fetchStudioPosts = fetchUserPosts;
        fetchUserPosts();
        
        // Fetch User Settings
        db.ref(`users/${uid}/communityEnabled`).once('value').then(snap => {
            if(snap.exists()) setCommunityEnabled(snap.val());
        });

        // Listeners for analytics
        const analyticsRef = db.ref(`video_analytics/${uid}`);
        analyticsRef.on('value', (anaSnap) => {
            setAnalytics(calculateAnalytics(anaSnap.val()));
        });

        return () => {
            analyticsRef.off();
        };
    }, [user]);

    const formatTime = (ts) => {
        if(!ts) return 'Desconhecido';
        const d = new Date(ts);
        return d.toLocaleDateString('pt-BR') + ' ' + d.toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'});
    };

    const getIconForType = (type) => {
        if(type === 'video') return 'video';
        if(type === 'photo' || type === 'image') return 'image';
        if(type === 'audio') return 'music';
        if(type === 'poll') return 'chart-bar';
        return 'file';
    };

    const filteredContents = myContents.filter(item => {
        if(!searchQuery) return true;
        const q = searchQuery.toLowerCase();
        return (item.title && item.title.toLowerCase().includes(q)) || 
               (item.question && item.question.toLowerCase().includes(q)) ||
               (item.content && item.content.toLowerCase().includes(q));
    });

    const deletePostCompletely = async (post) => {
        if(!confirm('Deseja excluir este item permanentemente?')) return;
        
        try {
            console.log(`[Phantora Studio] deletePostCompletely: Deleting ${post.id}`);
            
            // Delete from CDN API
            if (post.mediaUrl) {
                const filename = post.mediaUrl.split('/').pop().split('?')[0];
                await fetch('https://cdn-phantora-api.puter.work/manage', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        key: "phantora-secret-key-123",
                        action: "delete",
                        filename: filename
                    })
                }).catch(e => console.warn("Failed to delete from CDN:", e));
            }

            const db = window.firebaseDB || window.firebase.database();
            const uid = user.uid || user.id;

            // Dual-Pathing delete
            await Promise.allSettled([
                db.ref(`posts/${post.id}`).remove(),
                db.ref(`users/${uid}/user_posts/${post.id}`).remove()
            ]);
            
            setMyContents(prev => prev.filter(p => p.id !== post.id));
        } catch (error) {
            console.error(`[Phantora Studio] deletePostCompletely: ❌`, error.message);
            alert(`Erro ao deletar: ${error.message}`);
        }
    };

    return (
        <div className="flex flex-col h-full bg-[var(--dark-bg)] text-white overflow-hidden p-4 md:p-8 relative" data-name="studio-dashboard">
            
            {/* Top Bar */}
            <div className="flex flex-col gap-4 mb-8">
                <div className="flex justify-between items-center w-full">
                    <h1 className="text-2xl font-bold flex items-center gap-2"><div className="icon-layout-dashboard text-indigo-500"></div> Painel</h1>
                    <button onClick={() => setShowSettings(true)} className="p-2 rounded-full bg-gray-800 hover:bg-gray-700 transition">
                        <div className="icon-menu text-xl"></div>
                    </button>
                </div>
                
                <div className="w-full max-w-2xl mx-auto">
                    <button onClick={() => setShowPostCreator(true)} className="w-full flex items-center gap-3 pl-4 pr-4 py-4 rounded-xl border border-[var(--dark-border)] bg-[var(--dark-surface)] text-gray-400 hover:border-indigo-500 transition-colors shadow-lg">
                        <div className="icon-plus text-indigo-500 text-xl"></div>
                        <span className="font-semibold text-gray-300">Criar nova publicação...</span>
                    </button>
                </div>
            </div>

            {/* Content Management Sections */}
            <div className="flex-1 flex flex-col min-h-0 bg-[var(--dark-surface)] border border-[var(--dark-border)] rounded-2xl overflow-y-auto">
                <div className="p-4 md:p-6 space-y-8">
                    
                    {/* Analytics Section */}
                    <div className="space-y-4">
                        <h2 className="text-xl font-bold flex items-center gap-2 text-white"><div className="icon-chart-line text-indigo-400"></div> Monitorização do Canal</h2>
                        
                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                            <div className="bg-gray-800/50 border border-[var(--dark-border)] rounded-xl p-4">
                                <div className="text-gray-400 text-xs mb-1 flex items-center gap-2"><div className="icon-clock"></div> Tempo Total Assistido</div>
                                <div className="text-xl font-bold text-white">{(analytics.totalWatchTime / 3600000).toFixed(1)} <span className="text-sm text-gray-500">horas</span></div>
                            </div>
                            <div className="bg-gray-800/50 border border-[var(--dark-border)] rounded-xl p-4">
                                <div className="text-gray-400 text-xs mb-1 flex items-center gap-2"><div className="icon-eye"></div> Visualizações Únicas</div>
                                <div className="text-xl font-bold text-white">{analytics.views}</div>
                            </div>
                            <div className="bg-gray-800/50 border border-[var(--dark-border)] rounded-xl p-4">
                                <div className="text-gray-400 text-xs mb-1 flex items-center gap-2"><div className="icon-timer"></div> Tempo Médio</div>
                                <div className="text-xl font-bold text-white">{analytics.views > 0 ? (analytics.totalWatchTime / analytics.views / 1000).toFixed(1) : 0} <span className="text-sm text-gray-500">seg/view</span></div>
                            </div>
                            <div className="bg-gray-800/50 border border-[var(--dark-border)] rounded-xl p-4">
                                <div className="text-gray-400 text-xs mb-1 flex items-center gap-2"><div className="icon-link"></div> Cliques em Links</div>
                                <div className="text-xl font-bold text-white">{analytics.linkClicks}</div>
                            </div>
                        </div>
                    </div>
                    

                </div>
            </div>

            {/* Modals */}
            {showUploadSelect && (
                <div className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-4 animate-fade-in-up">
                    <div className="bg-gray-900 rounded-2xl max-w-lg w-full border border-gray-700 p-6 shadow-2xl">
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-xl font-bold text-white">O que você deseja enviar?</h2>
                            <button onClick={() => setShowUploadSelect(false)} className="text-gray-400 hover:text-white p-1 rounded-full hover:bg-gray-800 transition-colors">
                                <div className="icon-x text-2xl"></div>
                            </button>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            {contentTypes.map(type => (
                                <button key={type.id} onClick={() => {
                                    setShowUploadSelect(false);
                                    setShowPostCreator(true);
                                }} className="bg-gray-800 hover:bg-gray-700 p-4 rounded-xl text-left border border-[var(--dark-border)] transition-all transform hover:-translate-y-1 hover:shadow-lg">
                                    <div className={`w-12 h-12 rounded-lg ${type.color} text-white flex items-center justify-center mb-3 shadow-inner`}>
                                        <div className={`icon-${type.icon} text-2xl`}></div>
                                    </div>
                                    <h3 className="font-bold text-white">{type.label}</h3>
                                    <p className="text-xs text-gray-400 mt-1 line-clamp-2">{type.desc}</p>
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            )}
            
            {/* Settings Modal */}
            {showSettings && (
                <div className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-4 animate-fade-in-up">
                    <div className="bg-gray-900 rounded-2xl max-w-sm w-full border border-gray-700 p-6 shadow-2xl">
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-xl font-bold text-white">Configurações</h2>
                            <button onClick={() => setShowSettings(false)} className="text-gray-400 hover:text-white p-1">
                                <div className="icon-x text-2xl"></div>
                            </button>
                        </div>
                        <div className="space-y-6">
                            <div className="flex items-center justify-between">
                                <div>
                                    <h3 className="font-bold text-white">Ativar Comunidade</h3>
                                    <p className="text-xs text-gray-400">Permitir que seguidores enviem fotos e vídeos na sua aba Comunidade.</p>
                                </div>
                                <label className="relative inline-flex items-center cursor-pointer">
                                    <input type="checkbox" className="sr-only peer" checked={communityEnabled} onChange={async (e) => {
                                        const val = e.target.checked;
                                        setCommunityEnabled(val);
                                        if(window.firebaseDB) await window.firebaseDB.ref(`users/${user.uid || user.id}/communityEnabled`).set(val);
                                    }} />
                                    <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                                </label>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {uploadType && <GenericUpload user={user} contentType={uploadType.id} config={uploadType} onClose={() => setUploadType(null)} onUploadComplete={() => setUploadType(null)} />}
            {showPostCreator && <PostCreator user={user} editingPost={editingPost} onClose={() => {setShowPostCreator(false); setEditingPost(null);}} onUploadComplete={() => {setShowPostCreator(false); setEditingPost(null);}} />}
        </div>
    );
}

window.StudioDashboard = StudioDashboard;