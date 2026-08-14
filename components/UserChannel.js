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

    const handleShare = () => {
        const url = `https://phantora.site.je/channel/${channelUserId}`;
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

    if (userNotFound || (!channelUser && !loading)) {
        return (
            <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-8">
                <div className="icon-user-x text-6xl text-gray-300 mb-4"></div>
                <h2 className="text-2xl font-bold text-gray-800 mb-2">Usuário não encontrado</h2>
                <p className="text-gray-500 mb-6 text-center">O canal que você está procurando não existe ou foi removido.</p>
                <button onClick={() => window.history.back()} className="px-6 py-2 bg-indigo-600 text-white rounded-xl font-bold">
                    Voltar
                </button>
            </div>
        );
    }

    if (!channelUser) return null;

    const isOwnChannel = String(currentUser.id) === String(channelUserId);
    const isPrivate = privacySettings.hideProfileFromFollowers && !isOwnChannel && !isFriend;

    return (
        <div className="min-h-screen bg-gray-50 pb-20" data-name="user-channel" data-file="components/UserChannel.js">
            {showToast && (
                <div className="fixed top-20 left-1/2 transform -translate-x-1/2 bg-gray-800 text-white px-4 py-2 rounded-lg shadow-lg z-50 flex items-center gap-2 animate-fade-in">
                    <div className="icon-circle-check text-green-400"></div>
                    Link do canal copiado!
                </div>
            )}
            
            <header className="bg-white shadow-sm border-b px-4 py-3 flex items-center justify-between sticky top-0 z-20">
                <div className="flex items-center">
                    <button onClick={() => window.history.back()} className="p-2 -ml-2 text-gray-600 hover:bg-gray-100 rounded-full">
                        <div className="icon-arrow-left text-xl"></div>
                    </button>
                    <h1 className="text-xl font-bold text-gray-800 ml-2">{channelUser.name}</h1>
                </div>
                <button onClick={handleShare} className="p-2 text-gray-600 hover:bg-gray-100 rounded-full" title="Compartilhar Canal">
                    <div className="icon-share text-xl"></div>
                </button>
            </header>

            <div className="bg-white shadow-sm border-b mb-4">
                <div className="p-6 flex flex-col items-center">
                    <img 
                        src={(!isPrivate && channelUser.avatar) ? channelUser.avatar : 'https://via.placeholder.com/150'} 
                        className="w-24 h-24 rounded-full object-cover border-4 border-indigo-100 mb-4" 
                        alt={channelUser.name}
                    />
                    <h2 className="text-2xl font-bold text-gray-800">{isPrivate ? 'Usuário Privado' : channelUser.name}</h2>
                    <p className="text-gray-500 mb-6">@{channelUser.username ? channelUser.username : channelUser.name.toLowerCase().replace(/\s/g, '')}</p>

                    <div className="flex gap-6 mb-6 text-center">
                        <div className="cursor-pointer" onClick={() => setActiveTab('videos')}>
                            <span className="block font-bold text-lg text-gray-800">{posts.length}</span>
                            <span className="text-sm text-gray-500">Posts</span>
                        </div>
                        <div className="cursor-pointer" onClick={() => setActiveTab('community')}>
                            <span className="block font-bold text-lg text-gray-800">{communityPosts.length}</span>
                            <span className="text-sm text-gray-500">Comunidade</span>
                        </div>
                        <div className="cursor-pointer" onClick={() => setActiveTab('followers')}>
                            <span className="block font-bold text-lg text-gray-800">{Object.keys(followers).length}</span>
                            <span className="text-sm text-gray-500">Seguidores</span>
                        </div>
                        <div className="cursor-pointer" onClick={() => setActiveTab('following')}>
                            <span className="block font-bold text-lg text-gray-800">{Object.keys(following).length}</span>
                            <span className="text-sm text-gray-500">Seguindo</span>
                        </div>
                    </div>

                    {!isOwnChannel && (
                        <div className="flex gap-3 w-full max-w-xs">
                            <button 
                                onClick={() => toggleFollow(channelUserId)}
                                className={`flex-1 py-2 rounded-xl font-bold transition-colors ${currentUserFollowing[channelUserId] ? 'bg-gray-200 text-gray-800 hover:bg-gray-300' : 'bg-indigo-600 text-white hover:bg-indigo-700'}`}
                            >
                                {currentUserFollowing[channelUserId] ? 'Seguindo' : 'Seguir'}
                            </button>
                        </div>
                    )}
                </div>

                <div className="flex border-t border-gray-100 overflow-x-auto custom-scrollbar">
                    <button onClick={() => setActiveTab('videos')} className={`min-w-[100px] flex-1 py-3 text-sm font-bold border-b-2 transition-colors ${activeTab === 'videos' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-800'}`}>Vídeos / Fotos</button>
                    <button onClick={() => setActiveTab('community')} className={`min-w-[100px] flex-1 py-3 text-sm font-bold border-b-2 transition-colors ${activeTab === 'community' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-800'}`}>Comunidade</button>
                    <button onClick={() => setActiveTab('followers')} className={`min-w-[100px] flex-1 py-3 text-sm font-bold border-b-2 transition-colors ${activeTab === 'followers' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-800'}`}>Seguidores</button>
                    <button onClick={() => setActiveTab('following')} className={`min-w-[100px] flex-1 py-3 text-sm font-bold border-b-2 transition-colors ${activeTab === 'following' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-800'}`}>Seguindo</button>
                </div>
            </div>

            <div className="max-w-2xl mx-auto p-4">
                {activeTab === 'community' && (
                    <div className="space-y-4">
                        {communityEnabled && !isOwnChannel && (
                            <div className="bg-white p-4 rounded-xl border border-indigo-100 shadow-sm mb-4 cursor-text" onClick={() => window.location.href = `index.html?create=community&target=${channelUserId}`}>
                                <div className="flex gap-3 items-center">
                                    <img src={currentUser.avatar || 'https://via.placeholder.com/150'} className="w-10 h-10 rounded-full" />
                                    <span className="text-gray-400 flex-1">Publicar na comunidade de {channelUser.name}...</span>
                                    <div className="icon-image text-indigo-500 text-xl"></div>
                                </div>
                            </div>
                        )}
                        {communityPosts.map(post => (
                            <div key={post.id} className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm" onClick={() => window.location.href = `index.html?v=${post.id}`}>
                                <div className="flex items-center gap-3 mb-3">
                                    <img src={post.authorAvatar || 'https://via.placeholder.com/150'} className="w-10 h-10 rounded-full" />
                                    <div>
                                        <h4 className="font-bold text-sm text-gray-800">{post.authorName}</h4>
                                        <span className="text-xs text-gray-500">{new Date(post.timestamp).toLocaleDateString()}</span>
                                    </div>
                                </div>
                                
                                {post.type === 'text' && (
                                    <p className="text-gray-700 whitespace-pre-wrap">{post.textContent || post.content}</p>
                                )}
                                
                                {post.type === 'poll' && (
                                    <div className="bg-indigo-50 rounded-xl p-4 border border-indigo-100">
                                        <h5 className="font-bold text-indigo-900 mb-3 flex items-center gap-2"><div className="icon-chart-bar"></div> Enquete</h5>
                                        {post.pollCdnUrl && <span className="text-sm text-indigo-600 block mb-2">Clique na publicação para votar</span>}
                                        {post.content && <p className="text-sm text-gray-600 mt-2">{post.content}</p>}
                                    </div>
                                )}
                                
                                {post.mediaUrls && (
                                    <div className="flex overflow-x-auto gap-2 mt-3 snap-x">
                                        {post.mediaUrls.map((url, idx) => (
                                            <img key={idx} src={url} className="h-48 w-auto rounded-lg snap-center object-cover" />
                                        ))}
                                    </div>
                                )}
                            </div>
                        ))}
                        {communityPosts.length === 0 && <div className="text-center py-10 text-gray-500">Nenhuma publicação na comunidade.</div>}
                    </div>
                )}

                {activeTab === 'videos' && (
                    <div className="grid grid-cols-3 gap-1 md:gap-2">
                        {posts.map(post => (
                            <a href={`index.html?v=${post.id}`} key={post.id} className="aspect-[3/4] bg-black relative group cursor-pointer overflow-hidden rounded-md">
                                {post.mediaUrl && (post.type === 'video' || post.mediaUrl.match(/\.(mp4|webm|ogg|mov)$/i) || (post.mediaUrl.includes('file-') && post.mediaUrl.includes('-mp4'))) ? (
                                    <video src={post.mediaUrl} className="w-full h-full object-cover opacity-90 group-hover:opacity-100 transition" preload="metadata"></video>
                                ) : post.mediaUrl ? (
                                    <img src={post.mediaUrl} className="w-full h-full object-cover opacity-90 group-hover:opacity-100 transition" />
                                ) : (
                                    <div className="w-full h-full bg-indigo-100 flex items-center justify-center p-2">
                                        <p className="text-xs text-indigo-800 line-clamp-4 text-center">{post.content}</p>
                                    </div>
                                )}
                                {(post.type === 'video' || (post.mediaUrl && (post.mediaUrl.match(/\.(mp4|webm|ogg|mov)$/i) || (post.mediaUrl.includes('file-') && post.mediaUrl.includes('-mp4'))))) && (
                                    <div className="absolute top-1 right-1 text-white">
                                        <div className="icon-play text-sm drop-shadow-md"></div>
                                    </div>
                                )}
                                <div className="absolute bottom-1 left-1 flex items-center text-white text-xs drop-shadow-md">
                                    <div className="icon-heart mr-1 text-[10px]"></div>
                                    {post.likes ? Object.keys(post.likes).length : 0}
                                </div>
                            </a>
                        ))}
                        {posts.length === 0 && <div className="col-span-3 text-center py-10 text-gray-500">Nenhum post encontrado.</div>}
                    </div>
                )}

                {(activeTab === 'followers' || activeTab === 'following') && (
                    <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                        {(() => {
                            const list = activeTab === 'followers' ? Object.keys(followers) : Object.keys(following);
                            if (list.length === 0) return <div className="p-6 text-center text-gray-500">A lista está vazia.</div>;
                            return list.map(uid => (
                                <div key={uid} className="flex items-center justify-between p-4 border-b border-gray-50 last:border-0 hover:bg-gray-50 cursor-pointer" onClick={() => window.location.href = `channel.html?uid=${uid}`}>
                                    <div className="flex items-center gap-3">
                                        {userProfiles[uid]?.avatar ? (
                                            <img src={userProfiles[uid].avatar} className="w-10 h-10 rounded-full object-cover" />
                                        ) : (
                                            <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-bold">
                                                {userProfiles[uid]?.name ? userProfiles[uid].name.charAt(0).toUpperCase() : uid.substring(0, 2).toUpperCase()}
                                            </div>
                                        )}
                                        <div className="flex flex-col">
                                            <span className="font-bold text-sm text-gray-800">{userProfiles[uid]?.name || `ID: ${uid.substring(0, 8)}...`}</span>
                                            <span className="text-xs text-gray-500">
                                                @{userProfiles[uid]?.username ? userProfiles[uid].username : (userProfiles[uid]?.name ? userProfiles[uid].name.toLowerCase().replace(/\s/g, '') : '')}
                                            </span>
                                        </div>
                                    </div>
                                    {String(uid) !== String(currentUser.id) && String(uid) !== String(channelUserId) && (
                                        <button 
                                            onClick={(e) => { e.stopPropagation(); toggleFollow(uid); }}
                                            className={`px-3 py-1 rounded-full text-xs font-bold transition-colors ${currentUserFollowing[uid] ? 'bg-gray-200 text-gray-700' : 'bg-indigo-600 text-white'}`}
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
        </div>
    );
}

window.UserChannel = UserChannel;