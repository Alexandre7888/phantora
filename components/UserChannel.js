function UserChannel({ currentUser, channelUserId }) {
    const [channelUser, setChannelUser] = React.useState(null);
    const [posts, setPosts] = React.useState([]);
    const [followersCount, setFollowersCount] = React.useState(0);
    const [followingCount, setFollowingCount] = React.useState(0);
    const [currentUserFollowing, setCurrentUserFollowing] = React.useState(false);
    const [activeTab, setActiveTab] = React.useState('posts');
    const [loading, setLoading] = React.useState(true);
    const [userNotFound, setUserNotFound] = React.useState(false);
    const [showToast, setShowToast] = React.useState(false);
    const [showSettings, setShowSettings] = React.useState(false);
    const [showProfileEditor, setShowProfileEditor] = React.useState(false);

    React.useEffect(() => {
        const db = window.firebaseDB;
        if (!db) return;

        const loadData = async () => {
            try {
                // 1. Carregar Perfil do Usuário
                const userRef = db.ref(`users/${channelUserId}`);
                userRef.on('value', async (snapshot) => {
                    if (snapshot.exists()) {
                        const data = snapshot.val();
                        const customAvatar = data.avatar || data.profilePicture || 'https://ui-avatars.com/api/?name=U&background=random';

                        setChannelUser({
                            id: channelUserId,
                            name: data.nome || data.name || 'Usuário',
                            username: data.username || data.username_custom || data.nome?.toLowerCase().replace(/\s/g, '') || 'usuario',
                            avatar: customAvatar,
                            bio: data.bio || ''
                        });
                        setUserNotFound(false);
                    } else {
                        setUserNotFound(true);
                    }
                    setLoading(false);
                });

                // 2. Carregar Posts
                const postsRef = db.ref(`users/${channelUserId}/user_posts`);
                postsRef.on('value', async (snapshot) => {
                    if (snapshot.exists()) {
                        const postIds = Object.keys(snapshot.val());
                        const postsPromises = postIds.map(async (pid) => {
                            const pSnap = await db.ref(`posts/${pid}`).once('value');
                            if (pSnap.exists()) return { id: pid, ...pSnap.val() };
                            return null;
                        });
                        const fetchedPosts = (await Promise.all(postsPromises))
                            .filter(p => p !== null)
                            .sort((a, b) => b.timestamp - a.timestamp);
                        
                        setPosts(fetchedPosts);
                    } else {
                        setPosts([]);
                    }
                });

                // 3. Carregar Seguidores (Forma correta e performática)
                const followersRef = db.ref(`users/${channelUserId}/followers`);
                followersRef.on('value', (snapshot) => {
                    if (snapshot.exists()) {
                        const followersData = snapshot.val();
                        setFollowersCount(Object.keys(followersData).length);
                        if (currentUser && currentUser.id) {
                            setCurrentUserFollowing(!!followersData[currentUser.id]);
                        }
                    } else {
                        setFollowersCount(0);
                        setCurrentUserFollowing(false);
                    }
                });

                // 4. Carregar Seguindo
                const followingRef = db.ref(`users/${channelUserId}/following`);
                followingRef.on('value', (snapshot) => {
                    if (snapshot.exists()) {
                        setFollowingCount(Object.keys(snapshot.val()).length);
                    } else {
                        setFollowingCount(0);
                    }
                });

            } catch (err) {
                console.error("Erro ao carregar dados:", err);
                setLoading(false);
            }
        };

        loadData();

        return () => {
            db.ref(`users/${channelUserId}`).off();
            db.ref(`users/${channelUserId}/user_posts`).off();
            db.ref(`users/${channelUserId}/followers`).off();
            db.ref(`users/${channelUserId}/following`).off();
        };
    }, [channelUserId, currentUser]);

    const handleFollowToggle = async () => {
        const db = window.firebaseDB;
        if (!db || !currentUser || !currentUser.id) return;
        
        try {
            // Referências duplas para atualizar de forma consistente (quem segue e quem é seguido)
            const myFollowingRef = db.ref(`users/${currentUser.id}/following/${channelUserId}`);
            const channelFollowerRef = db.ref(`users/${channelUserId}/followers/${currentUser.id}`);

            // Atualização otimista na interface
            setCurrentUserFollowing(!currentUserFollowing);
            setFollowersCount(prev => currentUserFollowing ? Math.max(0, prev - 1) : prev + 1);

            if (currentUserFollowing) {
                // Deixar de seguir
                await myFollowingRef.remove();
                await channelFollowerRef.remove();
            } else {
                // Seguir
                await myFollowingRef.set(true);
                await channelFollowerRef.set(true);
            }
        } catch (err) {
            console.error("Erro ao tentar seguir:", err);
            // Reverter em caso de erro
            setCurrentUserFollowing(currentUserFollowing);
            setFollowersCount(prev => currentUserFollowing ? prev + 1 : Math.max(0, prev - 1));
        }
    };

    const handleShare = () => {
        const url = `${window.location.origin}/canal.html?uid=${channelUserId}`;
        navigator.clipboard.writeText(url).then(() => {
            setShowToast(true);
            setTimeout(() => setShowToast(false), 3000);
        });
    };

    if (loading) {
        return (
            <div className="flex h-screen items-center justify-center bg-primary">
                <div className="icon-loader animate-spin text-4xl text-accent"></div>
            </div>
        );
    }

    if (userNotFound || !channelUser) {
        return (
            <div className="flex h-screen flex-col items-center justify-center bg-primary text-text-primary p-4 text-center">
                <div className="icon-user-x text-6xl text-text-muted mb-4"></div>
                <h2 className="text-2xl font-bold mb-2">Usuário não encontrado</h2>
                <button onClick={() => window.history.back()} className="px-6 py-2 bg-secondary border border-border text-white rounded-lg mt-4 font-semibold">Voltar</button>
            </div>
        );
    }

    const isOwnChannel = currentUser && String(currentUser.id) === String(channelUserId);
    const standardPosts = posts.filter(p => !p.communityTargetId);
    const communityPosts = posts.filter(p => p.communityTargetId === channelUserId);

    return (
        <div className="min-h-screen bg-primary pb-20 font-sans text-text-primary">
            {showToast && (
                <div className="fixed top-20 left-1/2 transform -translate-x-1/2 bg-secondary border border-border text-text-primary px-4 py-2 rounded-full shadow-lg z-50 flex items-center gap-2 text-sm font-medium animate-fade-in-up">
                    <div className="icon-check text-success"></div> Link copiado!
                </div>
            )}
            
            {showSettings && window.SettingsMenu && (
                <window.SettingsMenu isOpen={true} onClose={() => setShowSettings(false)} initialTab="geral" />
            )}
            
            {showProfileEditor && window.ProfileEditor && (
                <window.ProfileEditor 
                    user={channelUser} 
                    onClose={() => setShowProfileEditor(false)}
                    onSave={(updated) => {
                        setChannelUser(updated);
                    }}
                />
            )}

            {window.AppNavigation && (
                <window.AppNavigation 
                    user={currentUser} 
                    currentView="channel" 
                    showSettingsMenu={() => setShowSettings(true)}
                />
            )}

            {/* Cabeçalho do Perfil (Estilo Instagram) */}
            <div className="pt-6 px-4 pb-4 mt-4">
                <div className="flex items-center justify-between mb-4">
                    {/* Avatar */}
                    <div className="relative">
                        <img 
                            src={channelUser.avatar} 
                            alt="Profile" 
                            className="w-20 h-20 md:w-24 md:h-24 rounded-full object-cover border border-border"
                            onError={(e) => { e.target.src = 'https://via.placeholder.com/150'; }}
                        />
                        {/* Indicador de Status / Story (opcional visual) */}
                        {isOwnChannel && (
                            <div className="absolute bottom-0 right-0 bg-accent text-white w-6 h-6 rounded-full flex items-center justify-center border-2 border-primary cursor-pointer">
                                <div className="icon-plus text-sm"></div>
                            </div>
                        )}
                    </div>
                    
                    {/* Estatísticas */}
                    <div className="flex gap-6 md:gap-8 flex-1 justify-center ml-4">
                        <div className="flex flex-col items-center">
                            <span className="font-bold text-lg text-text-primary">{standardPosts.length}</span>
                            <span className="text-xs md:text-sm text-text-secondary">Posts</span>
                        </div>
                        <div className="flex flex-col items-center">
                            <span className="font-bold text-lg text-text-primary">{followersCount}</span>
                            <span className="text-xs md:text-sm text-text-secondary">Seguidores</span>
                        </div>
                        <div className="flex flex-col items-center">
                            <span className="font-bold text-lg text-text-primary">{followingCount}</span>
                            <span className="text-xs md:text-sm text-text-secondary">Seguindo</span>
                        </div>
                    </div>
                </div>

                {/* Bio / Info */}
                <div className="mb-4">
                    <h2 className="font-semibold text-text-primary text-sm">{channelUser.name}</h2>
                    {channelUser.bio && (
                        <p className="text-sm text-text-primary mt-1 whitespace-pre-wrap">{channelUser.bio}</p>
                    )}
                </div>

                {/* Botões de Ação */}
                <div className="flex gap-2">
                    {isOwnChannel ? (
                        <>
                            <button onClick={() => setShowProfileEditor(true)} className="flex-1 bg-secondary hover:bg-tertiary border border-border text-text-primary font-medium py-1.5 px-4 rounded-lg text-sm transition-colors">
                                Editar Perfil
                            </button>
                            <button className="flex-1 bg-secondary hover:bg-tertiary border border-border text-text-primary font-medium py-1.5 px-4 rounded-lg text-sm transition-colors">
                                Compartilhar Perfil
                            </button>
                        </>
                    ) : (
                        <>
                            <button 
                                onClick={handleFollowToggle}
                                className={`flex-1 font-semibold py-1.5 px-4 rounded-lg text-sm transition-colors ${
                                    currentUserFollowing 
                                    ? 'bg-secondary border border-border text-text-primary hover:bg-tertiary' 
                                    : 'bg-info hover:bg-blue-600 text-white border border-transparent'
                                }`}
                            >
                                {currentUserFollowing ? 'Seguindo' : 'Seguir'}
                            </button>
                            <button className="flex-1 bg-secondary hover:bg-tertiary border border-border text-text-primary font-medium py-1.5 px-4 rounded-lg text-sm transition-colors">
                                Mensagem
                            </button>
                        </>
                    )}
                </div>
            </div>

            {/* Abas de Navegação */}
            <div className="flex border-t border-border mt-2">
                <button 
                    onClick={() => setActiveTab('posts')} 
                    className={`flex-1 flex justify-center py-3 transition-colors ${activeTab === 'posts' ? 'border-b-2 border-text-primary text-text-primary' : 'text-text-muted'}`}
                >
                    <div className="icon-grid text-xl"></div>
                </button>
                <button 
                    onClick={() => setActiveTab('community')} 
                    className={`flex-1 flex justify-center py-3 transition-colors ${activeTab === 'community' ? 'border-b-2 border-text-primary text-text-primary' : 'text-text-muted'}`}
                >
                    <div className="icon-message-square text-xl"></div>
                </button>
            </div>

            {/* Conteúdo das Abas */}
            <div className="w-full">
                {activeTab === 'posts' && (
                    <div className="grid grid-cols-3 gap-0.5">
                        {standardPosts.map(post => (
                            <a href={`index.html?v=${post.id}`} key={post.id} className="aspect-square bg-secondary relative group cursor-pointer overflow-hidden">
                                {post.mediaUrl ? (
                                    post.type === 'video' || post.mediaUrl.match(/\.(mp4|webm)$/i) ? (
                                        <>
                                            <video src={post.mediaUrl} className="w-full h-full object-cover" />
                                            <div className="absolute top-2 right-2 text-white">
                                                <div className="icon-circle-play text-sm shadow-md"></div>
                                            </div>
                                        </>
                                    ) : (
                                        <img src={post.mediaUrl} className="w-full h-full object-cover" />
                                    )
                                ) : (
                                    <div className="w-full h-full p-2 flex items-center justify-center text-xs text-text-secondary text-center bg-gradient-to-br from-secondary to-tertiary">
                                        <p className="line-clamp-4">{post.content || post.textContent}</p>
                                    </div>
                                )}
                            </a>
                        ))}
                        {standardPosts.length === 0 && (
                            <div className="col-span-3 py-16 flex flex-col items-center text-text-muted">
                                <div className="w-16 h-16 border-2 border-text-muted rounded-full flex items-center justify-center mb-3">
                                    <div className="icon-camera text-2xl"></div>
                                </div>
                                <h3 className="font-bold text-lg text-text-primary">Nenhum Post Ainda</h3>
                                <p className="text-sm">Quando houver publicações, elas aparecerão aqui.</p>
                            </div>
                        )}
                    </div>
                )}

                {activeTab === 'community' && (
                    <div className="p-4 space-y-4 max-w-xl mx-auto">
                        {communityPosts.map(post => (
                            <div key={post.id} className="bg-secondary rounded-xl p-4 border border-border">
                                <div className="flex items-center gap-3 mb-3">
                                    <img src={post.authorAvatar || 'https://via.placeholder.com/150'} className="w-10 h-10 rounded-full object-cover border border-border" />
                                    <div>
                                        <h4 className="font-bold text-sm text-text-primary">{post.authorName}</h4>
                                        <span className="text-xs text-text-secondary">
                                            {new Date(post.timestamp).toLocaleDateString('pt-BR')}
                                        </span>
                                    </div>
                                </div>
                                <p className="text-text-primary text-sm whitespace-pre-wrap">{post.content || post.textContent}</p>
                            </div>
                        ))}
                        {communityPosts.length === 0 && (
                            <div className="py-16 flex flex-col items-center text-text-muted">
                                <div className="icon-message-square text-4xl mb-3"></div>
                                <h3 className="font-bold text-lg text-text-primary">Sem Comunidade</h3>
                                <p className="text-sm text-center max-w-xs mt-1">Este canal ainda não possui publicações na aba comunidade.</p>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}

window.UserChannel = UserChannel;
