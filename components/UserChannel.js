function UserChannel({ currentUser, channelUserId }) {
    const [channelUser, setChannelUser] = React.useState(null);
    const [posts, setPosts] = React.useState([]);
    const [communityPosts, setCommunityPosts] = React.useState([]);
    const [followers, setFollowers] = React.useState({});
    const [following, setFollowing] = React.useState({});
    const [currentUserFollowing, setCurrentUserFollowing] = React.useState({});
    const [activeTab, setActiveTab] = React.useState('videos'); // videos, community, followers, following
    const [communityEnabled, setCommunityEnabled] = React.useState(false);
    const [loading, setLoading] = React.useState(true);
    const [isFriend, setIsFriend] = React.useState(false);
    const [privacySettings, setPrivacySettings] = React.useState({});
    const [userProfiles, setUserProfiles] = React.useState({});
    const [showToast, setShowToast] = React.useState(false);
    const [userNotFound, setUserNotFound] = React.useState(false);
    const [showSubscription, setShowSubscription] = React.useState(false);
    const [hasTiers, setHasTiers] = React.useState(false);

    const handleShare = () => {
        const url = `https://phantora.site.je/canal/${channelUserId}`;
        navigator.clipboard.writeText(url).then(() => {
            setShowToast(true);
            setTimeout(() => setShowToast(false), 3000);
        }).catch(err => {
            console.error('Erro ao copiar:', err);
        });
    };

    React.useEffect(() => {
        const db = window.firebaseDB;
        if (!db) return;

        const loadData = async () => {
            try {
                // Load channel user data
                const userSnap = await db.ref(`users/${channelUserId}`).once('value');
                let foundUser = null;
                
                if (userSnap.exists()) {
                    const uData = userSnap.val();
                    foundUser = {
                        id: channelUserId,
                        name: uData.nome || uData.name || 'Usuário',
                        username: uData.username || uData.username_custom || '',
                        avatar: uData.profilePicture || ''
                    };
                    setPrivacySettings({
                        hideProfileFromFollowers: uData.hideProfileFromFollowers || false,
                        allowFollowerMessages: uData.allowFollowerMessages !== false
                    });
                    setCommunityEnabled(uData.communityEnabled || false);
                } else {
                    // Fallback to defaults if user node doesn't exist but we have the ID
                    setPrivacySettings({
                        hideProfileFromFollowers: false,
                        allowFollowerMessages: true
                    });
                }

                // Carregar posts utilizando Fan-out (mais rápido e otimizado)
                const userPostsSnap = await db.ref(`users/${channelUserId}/user_posts`).once('value');
                let allUserPosts = [];
                
                if (userPostsSnap.exists()) {
                    const postIdsData = userPostsSnap.val();
                    const postIds = Object.keys(postIdsData);
                    
                    // Buscar dados completos de cada post
                    const postPromises = postIds.map(async (pid) => {
                        const pSnap = await db.ref(`posts/${pid}`).once('value');
                        if (pSnap.exists()) {
                            return { id: pid, ...pSnap.val() };
                        }
                        return null;
                    });
                    
                    const fetchedPosts = await Promise.all(postPromises);
                    allUserPosts = fetchedPosts
                        .filter(p => p !== null)
                        .sort((a, b) => b.timestamp - a.timestamp);
                }

                // Filtrar os posts padrão e os da comunidade do usuário
                const regularPosts = allUserPosts.filter(p => !p.communityTargetId);
                const communityContent = allUserPosts.filter(p => p.communityTargetId === channelUserId);
                
                setPosts(regularPosts);
                setCommunityPosts(communityContent);

                if (!foundUser && allUserPosts.length > 0) {
                    // Tentar obter detalhes do usuário do seu primeiro post caso ele não exista no node users
                    const firstPost = allUserPosts[0];
                    foundUser = {
                        id: channelUserId,
                        name: firstPost.authorName || 'Usuário',
                        username: '',
                        avatar: firstPost.authorAvatar || ''
                    };
                } 
                
                if (!foundUser) {
                    setUserNotFound(true);
                } else {
                    setChannelUser(foundUser);
                }
                
                // Verificar se usuário tem planos de assinatura
                const tiersSnap = await db.ref(`users/${channelUserId}/subscriptionTiers`).once('value');
                if (tiersSnap.exists() && Object.keys(tiersSnap.val()).length > 0) {
                    setHasTiers(true);
                }

                // Load followers and following for channel user
                const allFollowsSnap = await db.ref('follows').once('value');
                if (allFollowsSnap.exists()) {
                    const allFollows = allFollowsSnap.val();
                    
                    // Users that follow the channel user
                    const channelFollowers = {};
                    for (const uid in allFollows) {
                        if (allFollows[uid][channelUserId]) {
                            channelFollowers[uid] = true;
                        }
                    }
                    setFollowers(channelFollowers);

                    // Users that channel user follows
                    setFollowing(allFollows[channelUserId] || {});

                    // Current user follows
                    setCurrentUserFollowing(allFollows[currentUser.id] || {});

                    // Check friendship (mutual follow)
                    const currentUserFollowsThem = allFollows[currentUser.id] && allFollows[currentUser.id][channelUserId];
                    const theyFollowCurrentUser = allFollows[channelUserId] && allFollows[channelUserId][currentUser.id];
                    setIsFriend(currentUserFollowsThem && theyFollowCurrentUser);
                }
            } catch (e) {
                console.error(e);
            }
            setLoading(false);
        };

        loadData();

        // Listeners for real-time updates on follows
        const followsRef = db.ref('follows');
        const listener = followsRef.on('value', (snap) => {
            if (snap.exists()) {
                const allFollows = snap.val();
                const channelFollowers = {};
                for (const uid in allFollows) {
                    if (allFollows[uid][channelUserId]) {
                        channelFollowers[uid] = true;
                    }
                }
                setFollowers(channelFollowers);
                setFollowing(allFollows[channelUserId] || {});
                setCurrentUserFollowing(allFollows[currentUser.id] || {});
                
                const currentUserFollowsThem = allFollows[currentUser.id] && allFollows[currentUser.id][channelUserId];
                const theyFollowCurrentUser = allFollows[channelUserId] && allFollows[channelUserId][currentUser.id];
                setIsFriend(currentUserFollowsThem && theyFollowCurrentUser);
            }
        });

        return () => followsRef.off('value', listener);
    }, [channelUserId, currentUser.id]);

    React.useEffect(() => {
        const db = window.firebaseDB;
        if (!db) return;

        const loadProfiles = async () => {
            const uidsToLoad = new Set([...Object.keys(followers), ...Object.keys(following)]);
            const newProfiles = { ...userProfiles };
            let needsUpdate = false;
            
            for (const uid of uidsToLoad) {
                if (!newProfiles[uid]) {
                    const snap = await db.ref(`users/${uid}`).once('value');
                    if (snap.exists()) {
                        const data = snap.val();
                        newProfiles[uid] = {
                            name: data.nome || data.name || 'Usuário',
                            username: data.username || data.username_custom || '',
                            avatar: data.profilePicture || ''
                        };
                        needsUpdate = true;
                    }
                }
            }
            
            if (needsUpdate) {
                setUserProfiles(newProfiles);
            }
        };

        if (Object.keys(followers).length > 0 || Object.keys(following).length > 0) {
            loadProfiles();
        }
    }, [followers, following]);

    const toggleFollow = async (targetId) => {
        const db = window.firebaseDB;
        if (!db) return;
        if (currentUserFollowing[targetId]) {
            await db.ref(`follows/${currentUser.id}/${targetId}`).remove();
        } else {
            await db.ref(`follows/${currentUser.id}/${targetId}`).set(true);
        }
    };

    if (loading) {
        return <div className="flex h-screen items-center justify-center"><div className="icon-loader animate-spin text-4xl text-indigo-600"></div></div>;
    }

    const forceRefreshImage = (e) => {
        const img = e.target;
        const currentSrc = img.src;
        if (!currentSrc.includes('?v=')) {
            img.src = currentSrc + (currentSrc.includes('?') ? '&' : '?') + 'v=' + Date.now();
        } else {
            img.src = currentSrc.replace(/v=\d+/, 'v=' + Date.now());
        }
    };

    if (userNotFound || (!channelUser && !loading)) {
        return (
            <div className="min-h-screen bg-primary flex flex-col items-center justify-center p-8">
                <div className="icon-user-x text-6xl text-text-muted mb-4"></div>
                <h2 className="text-2xl font-bold text-text-primary mb-2">Usuário não encontrado</h2>
                <p className="text-text-secondary mb-6 text-center">O canal que você está procurando não existe ou foi removido.</p>
                <button onClick={() => window.history.back()} className="px-6 py-2 bg-accent text-white rounded-xl font-bold hover:bg-accent-hover transition-colors">
                    Voltar
                </button>
            </div>
        );
    }

    if (!channelUser) return null;

    const isOwnChannel = String(currentUser.id) === String(channelUserId);
    const isPrivate = privacySettings.hideProfileFromFollowers && !isOwnChannel && !isFriend;

    return (
        <div className="min-h-screen bg-primary pb-20 font-sans" data-name="user-channel" data-file="components/UserChannel.js">
            {showToast && (
                <div className="fixed top-20 left-1/2 transform -translate-x-1/2 bg-tertiary border border-border text-text-primary px-4 py-2 rounded-lg shadow-lg z-50 flex items-center gap-2 animate-fade-in">
                    <div className="icon-circle-check text-success"></div>
                    Link do canal copiado!
                </div>
            )}
            
            <header className="bg-secondary/80 backdrop-blur-lg shadow-sm border-b border-border px-4 py-3 flex items-center justify-between sticky top-0 z-20">
                <div className="flex items-center">
                    <button onClick={() => window.history.back()} className="p-2 -ml-2 text-text-secondary hover:text-text-primary hover:bg-tertiary rounded-full transition-colors">
                        <div className="icon-arrow-left text-xl"></div>
                    </button>
                    <h1 className="text-xl font-bold text-text-primary ml-2">{channelUser.name}</h1>
                </div>
                <button onClick={handleShare} className="p-2 text-text-secondary hover:text-text-primary hover:bg-tertiary rounded-full transition-colors" title="Compartilhar Canal">
                    <div className="icon-share text-xl"></div>
                </button>
            </header>

            <div className="bg-secondary shadow-card border-b border-border mb-4">
                <div className="p-6 flex flex-col items-center">
                    <img 
                        src={(!isPrivate && channelUser.avatar) ? channelUser.avatar : 'https://via.placeholder.com/150'} 
                        className="w-24 h-24 rounded-full object-cover border-4 border-accent mb-4 cursor-pointer" 
                        alt={channelUser.name}
                        onClick={forceRefreshImage}
                        title="Toque para forçar atualização da imagem"
                    />
                    <h2 className="text-2xl font-bold text-text-primary">{isPrivate ? 'Usuário Privado' : channelUser.name}</h2>
                    <p className="text-text-secondary mb-6">@{channelUser.username ? channelUser.username : channelUser.name.toLowerCase().replace(/\s/g, '')}</p>

                    <div className="flex gap-6 mb-6 text-center">
                        <div className="cursor-pointer hover:opacity-80 transition-opacity" onClick={() => setActiveTab('videos')}>
                            <span className="block font-bold text-lg text-text-primary">{posts.length}</span>
                            <span className="text-sm text-text-secondary">Publicações</span>
                        </div>
                        <div className="cursor-pointer hover:opacity-80 transition-opacity" onClick={() => setActiveTab('community')}>
                            <span className="block font-bold text-lg text-text-primary">{communityPosts.length}</span>
                            <span className="text-sm text-text-secondary">Comunidade</span>
                        </div>
                        <div className="cursor-pointer hover:opacity-80 transition-opacity" onClick={() => setActiveTab('followers')}>
                            <span className="block font-bold text-lg text-text-primary">{Object.keys(followers).length}</span>
                            <span className="text-sm text-text-secondary">Seguidores</span>
                        </div>
                        <div className="cursor-pointer hover:opacity-80 transition-opacity" onClick={() => setActiveTab('following')}>
                            <span className="block font-bold text-lg text-text-primary">{Object.keys(following).length}</span>
                            <span className="text-sm text-text-secondary">Seguindo</span>
                        </div>
                    </div>

                    {!isOwnChannel && (
                        <div className="flex flex-col gap-3 w-full max-w-xs">
                            <button 
                                onClick={() => toggleFollow(channelUserId)}
                                className={`w-full py-2 rounded-xl font-bold transition-colors ${currentUserFollowing[channelUserId] ? 'bg-tertiary border border-border text-text-primary hover:bg-border' : 'bg-accent text-white hover:bg-accent-hover'}`}
                            >
                                {currentUserFollowing[channelUserId] ? 'Seguindo' : 'Seguir'}
                            </button>
                            {hasTiers && (
                                <button 
                                    onClick={() => setShowSubscription(true)}
                                    className="w-full py-2 rounded-xl font-bold transition-colors bg-accent/10 text-accent border border-accent/20 hover:bg-accent/20 flex justify-center items-center gap-2"
                                >
                                    <div className="icon-star text-sm"></div> Assinar Canal
                                </button>
                            )}
                        </div>
                    )}
                </div>

                <div className="flex border-t border-border overflow-x-auto custom-scrollbar">
                    <button onClick={() => setActiveTab('videos')} className={`min-w-[100px] flex-1 py-3 text-sm font-bold border-b-2 transition-colors ${activeTab === 'videos' ? 'border-accent text-accent' : 'border-transparent text-text-secondary hover:text-text-primary'}`}>Vídeos / Fotos</button>
                    <button onClick={() => setActiveTab('community')} className={`min-w-[100px] flex-1 py-3 text-sm font-bold border-b-2 transition-colors ${activeTab === 'community' ? 'border-accent text-accent' : 'border-transparent text-text-secondary hover:text-text-primary'}`}>Comunidade</button>
                    <button onClick={() => setActiveTab('followers')} className={`min-w-[100px] flex-1 py-3 text-sm font-bold border-b-2 transition-colors ${activeTab === 'followers' ? 'border-accent text-accent' : 'border-transparent text-text-secondary hover:text-text-primary'}`}>Seguidores</button>
                    <button onClick={() => setActiveTab('following')} className={`min-w-[100px] flex-1 py-3 text-sm font-bold border-b-2 transition-colors ${activeTab === 'following' ? 'border-accent text-accent' : 'border-transparent text-text-secondary hover:text-text-primary'}`}>Seguindo</button>
                </div>
            </div>

            <div className="max-w-2xl mx-auto p-4">
                {activeTab === 'community' && (
                    <div className="space-y-4">
                        {communityEnabled && !isOwnChannel && (
                            <div className="bg-secondary p-4 rounded-xl border border-border shadow-sm mb-4 cursor-text hover:border-accent transition-colors" onClick={() => window.location.href = `index.html?create=community&target=${channelUserId}`}>
                                <div className="flex gap-3 items-center">
                                    <img src={currentUser.avatar || 'https://via.placeholder.com/150'} className="w-10 h-10 rounded-full object-cover" />
                                    <span className="text-text-muted flex-1">Publicar na comunidade de {channelUser.name}...</span>
                                    <div className="icon-image text-accent text-xl"></div>
                                </div>
                            </div>
                        )}
                        {communityPosts.map(post => (
                            <div key={post.id} className="bg-secondary rounded-xl border border-border p-4 shadow-sm hover:border-border-active transition-colors cursor-pointer" onClick={() => window.location.href = `index.html?v=${post.id}`}>
                                <div className="flex items-center gap-3 mb-3">
                                    <img src={post.authorAvatar || 'https://via.placeholder.com/150'} className="w-10 h-10 rounded-full object-cover" />
                                    <div>
                                        <h4 className="font-bold text-sm text-text-primary">{post.authorName}</h4>
                                        <span className="text-xs text-text-secondary">{new Date(post.timestamp).toLocaleDateString()}</span>
                                    </div>
                                </div>
                                
                                {post.type === 'text' && (
                                    <p className="text-text-primary whitespace-pre-wrap">{post.textContent || post.content}</p>
                                )}
                                
                                {post.type === 'poll' && (
                                    <div className="bg-tertiary rounded-xl p-4 border border-border">
                                        <h5 className="font-bold text-accent mb-3 flex items-center gap-2"><div className="icon-chart-bar"></div> Enquete</h5>
                                        {post.pollCdnUrl && <span className="text-sm text-accent block mb-2">Clique na publicação para votar</span>}
                                        {post.content && <p className="text-sm text-text-primary mt-2">{post.content}</p>}
                                    </div>
                                )}
                                
                                {post.mediaUrls && (
                                    <div className="flex overflow-x-auto gap-2 mt-3 snap-x">
                                        {post.mediaUrls.map((url, idx) => (
                                            <img key={idx} src={url} className="h-48 w-auto rounded-lg snap-center object-cover border border-border" />
                                        ))}
                                    </div>
                                )}
                            </div>
                        ))}
                        {communityPosts.length === 0 && <div className="text-center py-10 text-text-muted">Nenhuma publicação na comunidade.</div>}
                    </div>
                )}

                {activeTab === 'videos' && (
                    <div className="grid grid-cols-3 gap-1 md:gap-2">
                        {posts.map(post => (
                            <a href={`index.html?v=${post.id}`} key={post.id} className="aspect-[3/4] bg-black relative group cursor-pointer overflow-hidden rounded-md border border-border">
                                {post.mediaUrl && (post.type === 'video' || post.mediaUrl.match(/\.(mp4|webm|ogg|mov)$/i) || (post.mediaUrl.includes('file-') && post.mediaUrl.includes('-mp4'))) ? (
                                    <video src={post.mediaUrl} className="w-full h-full object-cover opacity-90 group-hover:opacity-100 transition" preload="metadata"></video>
                                ) : post.mediaUrl ? (
                                    <img src={post.mediaUrl} className="w-full h-full object-cover opacity-90 group-hover:opacity-100 transition" />
                                ) : (
                                    <div className="w-full h-full bg-tertiary flex items-center justify-center p-2">
                                        <p className="text-xs text-text-secondary line-clamp-4 text-center">{post.content}</p>
                                    </div>
                                )}
                                {(post.type === 'video' || (post.mediaUrl && (post.mediaUrl.match(/\.(mp4|webm|ogg|mov)$/i) || (post.mediaUrl.includes('file-') && post.mediaUrl.includes('-mp4'))))) && (
                                    <div className="absolute top-1 right-1 text-white">
                                        <div className="icon-play text-sm drop-shadow-md"></div>
                                    </div>
                                )}
                                <div className="absolute bottom-1 left-1 flex items-center text-white text-xs drop-shadow-md bg-black/40 px-1.5 py-0.5 rounded backdrop-blur-sm">
                                    <div className="icon-heart mr-1 text-[10px]"></div>
                                    {post.likes ? Object.keys(post.likes).length : 0}
                                </div>
                            </a>
                        ))}
                        {posts.length === 0 && <div className="col-span-3 text-center py-10 text-text-muted">Nenhum post encontrado.</div>}
                    </div>
                )}

                {(activeTab === 'followers' || activeTab === 'following') && (
                    <div className="bg-secondary rounded-xl shadow-card border border-border overflow-hidden">
                        {(() => {
                            const list = activeTab === 'followers' ? Object.keys(followers) : Object.keys(following);
                            if (list.length === 0) return <div className="p-6 text-center text-text-muted">A lista está vazia.</div>;
                            return list.map(uid => (
                                <div key={uid} className="flex items-center justify-between p-4 border-b border-border last:border-0 hover:bg-tertiary cursor-pointer transition-colors" onClick={() => window.location.href = `canal.html?uid=${uid}`}>
                                    <div className="flex items-center gap-3">
                                        {userProfiles[uid]?.avatar ? (
                                            <img src={userProfiles[uid].avatar} className="w-10 h-10 rounded-full object-cover border border-border" />
                                        ) : (
                                            <div className="w-10 h-10 rounded-full bg-tertiary flex items-center justify-center text-text-primary font-bold border border-border">
                                                {userProfiles[uid]?.name ? userProfiles[uid].name.charAt(0).toUpperCase() : uid.substring(0, 2).toUpperCase()}
                                            </div>
                                        )}
                                        <div className="flex flex-col">
                                            <span className="font-bold text-sm text-text-primary">{userProfiles[uid]?.name || `ID: ${uid.substring(0, 8)}...`}</span>
                                            <span className="text-xs text-text-secondary">
                                                @{userProfiles[uid]?.username ? userProfiles[uid].username : (userProfiles[uid]?.name ? userProfiles[uid].name.toLowerCase().replace(/\s/g, '') : '')}
                                            </span>
                                        </div>
                                    </div>
                                    {String(uid) !== String(currentUser.id) && String(uid) !== String(channelUserId) && (
                                        <button 
                                            onClick={(e) => { e.stopPropagation(); toggleFollow(uid); }}
                                            className={`px-3 py-1 rounded-full text-xs font-bold transition-colors ${currentUserFollowing[uid] ? 'bg-tertiary border border-border text-text-primary hover:bg-border' : 'bg-accent text-white hover:bg-accent-hover'}`}
                                        >
                                            {currentUserFollowing[uid] ? 'Seguindo' : 'Seguir'}
                                        </button>
                                    )}
                                </div>
                            ));
                        })()}
                    </div>
                )}
            </div>
            {showSubscription && window.ChannelSubscription && (
                <window.ChannelSubscription
                    creatorId={channelUserId}
                    creatorName={channelUser.name}
                    creatorAvatar={channelUser.avatar}
                    onClose={() => setShowSubscription(false)}
                    db={window.firebaseDB}
                />
            )}
        </div>
    );
}

window.UserChannel = UserChannel;
