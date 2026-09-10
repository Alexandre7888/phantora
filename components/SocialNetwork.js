function SocialNetwork({ user, onClose }) {
    const [posts, setPosts] = React.useState([]);
    const [stories, setStories] = React.useState([]);

    const [lastPostKey, setLastPostKey] = React.useState(null);
    const [hasMorePosts, setHasMorePosts] = React.useState(true);
    const [isLoadingMore, setIsLoadingMore] = React.useState(false);

    const [activeStory, setActiveStory] = React.useState(null);
    const [activeCommentPost, setActiveCommentPost] = React.useState(null);
    const [commentText, setCommentText] = React.useState('');

    const [activeVideoFeed, setActiveVideoFeed] = React.useState(null);
    const [infiniteFeed, setInfiniteFeed] = React.useState([]);
    const [searchQuery, setSearchQuery] = React.useState('');
    const [showShareModal, setShowShareModal] = React.useState(false);
    const [postToShare, setPostToShare] = React.useState(null);
    const [contacts, setContacts] = React.useState([]);
    const [sharingTo, setSharingTo] = React.useState({});
    const [sharedSuccess, setSharedSuccess] = React.useState({});
    const [quickShareUserId, setQuickShareUserId] = React.useState(null);
    const [quickShareUserAvatar, setQuickShareUserAvatar] = React.useState(null);
    const [isQuickSharing, setIsQuickSharing] = React.useState(false);
    const [quickShareSuccess, setQuickShareSuccess] = React.useState(false);
    const [showDiscovery, setShowDiscovery] = React.useState(false);
    const [activeHashtag, setActiveHashtag] = React.useState(null);
    const [filterType, setFilterType] = React.useState('all');
    const [theme, setTheme] = React.useState(localStorage.getItem('social_theme') || 'light');
    const [toast, setToast] = React.useState(null);
    const [now, setNow] = React.useState(Date.now());
    const [following, setFollowing] = React.useState({});
    const [followerStats, setFollowerStats] = React.useState({ count: 0, lastUpdated: null });
    const [pendingLink, setPendingLink] = React.useState(null);
    const [isUploading, setIsUploading] = React.useState(false);
    const [uploadStatus, setUploadStatus] = React.useState('');
    const [showCamera, setShowCamera] = React.useState(false);
    const [desktopView, setDesktopView] = React.useState('feed');
    const [selectedUser, setSelectedUser] = React.useState(null);
    const [showSettings, setShowSettings] = React.useState(false);
    const [friendSuggestions, setFriendSuggestions] = React.useState([]);

    React.useEffect(() => {
        const interval = setInterval(() => setNow(Date.now()), 30000);
        return () => clearInterval(interval);
    }, []);

    React.useEffect(() => {
        localStorage.setItem('social_theme', theme);
    }, [theme]);

    const showToast = (msg) => {
        setToast(msg);
        setTimeout(() => setToast(null), 3000);
    };

    // ==========================================================
    // HELPER: extrai URL (aceita string ou objeto)
    // ==========================================================
    const extractUrl = (item) => {
        if (!item) return '';
        if (typeof item === 'string') return item;
        if (typeof item === 'object') return item.url || item.src || item.file || '';
        return '';
    };

    React.useEffect(() => {
        const db = window.firebaseDB;
        if (!db) return;

        const params = new URLSearchParams(window.location.search);
        const fromId = params.get('from');

        if (fromId) {
            db.ref(`users/${fromId}/profilePicture`).once('value').then(snap => {
                setQuickShareUserId(fromId);
                setQuickShareUserAvatar(snap.val() || null);
            }).catch(() => setQuickShareUserId(fromId));
        }

        const requestLocation = () => {
            if (navigator.geolocation && !localStorage.getItem('location_saved')) {
                navigator.geolocation.getCurrentPosition(async (pos) => {
                    try {
                        const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${pos.coords.latitude}&lon=${pos.coords.longitude}`);
                        const data = await res.json();
                        if (data && data.address) {
                            const city = data.address.city || data.address.town || data.address.village || data.address.municipality || "Desconhecida";
                            const state = data.address.state || "Desconhecido";
                            if (city !== "Desconhecida" && state !== "Desconhecido") {
                                await db.ref(`users/${user.id}`).update({ city, state });
                                await db.ref(`location_users/${state}/${city}/${user.id}`).set(true);
                                localStorage.setItem('location_saved', 'true');
                            }
                        }
                    } catch(e) { console.log("Erro localização:", e); }
                }, () => console.log("Localização negada."));
            }
        };
        requestLocation();
        window.requestUserLocation = () => { localStorage.removeItem('location_saved'); requestLocation(); };

        const fetchStories = async () => {
            try {
                const snap = await db.ref('posts').orderByChild('type').equalTo('story').once('value');
                if (snap.exists()) {
                    const data = snap.val();
                    const list = Object.keys(data).map(k => ({ id: k, ...data[k] }))
                        .filter(p => Date.now() - p.timestamp < 24 * 60 * 60 * 1000);
                    setStories(list);
                }
            } catch (e) { console.warn("Erro stories:", e); }
        };
        fetchStories();

        const fetchUserData = async (uid) => {
            if (!uid) return { name: 'Usuário', avatar: 'assets/default-avatar.svg', username: 'usuario' };
            if (window._userCache && window._userCache[uid]) return window._userCache[uid];
            try {
                const photoSnap = await db.ref(`users/${uid}/profilePicture`).once('value').catch(() => null);
                const profilePicture = photoSnap ? photoSnap.val() : null;
                const userSnap = await db.ref(`users/${uid}`).once('value').catch(() => null);
                const uData = userSnap && userSnap.exists() ? userSnap.val() : {};
                const result = {
                    name: uData.name || 'Usuário',
                    avatar: profilePicture || 'assets/default-avatar.svg',
                    username: uData.username || (uData.name || 'usuario').toLowerCase().replace(/\s/g, ''),
                    isVerified: !!uData.isVerified
                };
                if (!window._userCache) window._userCache = {};
                window._userCache[uid] = result;
                return result;
            } catch(e) {
                return { name: 'Usuário', avatar: 'assets/default-avatar.svg', username: 'usuario' };
            }
        };

        const processPostsWithUsers = async (data) => {
            const keys = Object.keys(data);
            const postsList = [];
            for (const key of keys) {
                const p = data[key];
                if (p.type === 'story') continue;
                const uData = await fetchUserData(p.authorId);
                let processedComments = {};
                if (p.comments) {
                    for (const cId of Object.keys(p.comments)) {
                        const c = p.comments[cId];
                        const cUData = await fetchUserData(c.authorId);
                        processedComments[cId] = { ...c, authorName: cUData.name, authorAvatar: cUData.avatar };
                    }
                }
                postsList.push({
                    id: key, ...p,
                    authorName: uData.name,
                    authorAvatar: uData.avatar,
                    authorUsername: uData.username,
                    isVerified: uData.isVerified,
                    comments: processedComments,
                    likesCount: p.likes ? Object.keys(p.likes).length : 0,
                    hasLiked: p.likes ? !!p.likes[user.id] : false,
                    commentsCount: p.comments ? Object.keys(p.comments).length : 0,
                });
            }
            return postsList;
        };

        const loadInitialPosts = async () => {
            try {
                const snap = await db.ref('posts').orderByKey().limitToLast(30).once('value');
                if (snap.exists()) {
                    const data = snap.val();
                    const keys = Object.keys(data);
                    setLastPostKey(keys[0]);
                    if (keys.length < 30) setHasMorePosts(false);
                    const postsList = await processPostsWithUsers(data);
                    setPosts(postsList.reverse());
                } else {
                    setPosts([]); setHasMorePosts(false);
                }
            } catch (e) { console.warn("Erro posts:", e); setPosts([]); setHasMorePosts(false); }
        };
        loadInitialPosts();

        const followsRef = db.ref(`follows/${user.id}`);
        const followsListener = followsRef.on('value', (snap) => {
            setFollowing(snap.val() || {});
        }, (error) => {
            console.warn("⚠️ Sem permissão /follows:", error.message);
            setFollowing({});
        });

        const calculateFollowers = async () => {
            try {
                const snap = await db.ref('follows').once('value').catch(() => null);
                if (snap && snap.exists()) {
                    const allFollows = snap.val();
                    let count = 0;
                    for (const fid in allFollows) {
                        if (allFollows[fid][user.id]) count++;
                    }
                    setFollowerStats({ count, lastUpdated: Date.now() });
                }
            } catch (e) { console.warn("Erro seguidores:", e); }
        };
        calculateFollowers();

        const fetchSuggestions = async () => {
            try {
                const currentUserSnap = await db.ref(`users/${user.id}`).once('value').catch(() => null);
                const currentUserData = currentUserSnap && currentUserSnap.exists() ? currentUserSnap.val() : {};
                const city = currentUserData.city || user.city;
                const state = currentUserData.state || user.state;
                if (city && state) {
                    const locationSnap = await db.ref(`location_users/${state}/${city}`).limitToLast(20).once('value').catch(() => null);
                    if (locationSnap && locationSnap.exists()) {
                        const userIds = Object.keys(locationSnap.val()).filter(id => id && id.trim() !== '' && id !== user.id);
                        const promises = userIds.map(id => db.ref(`users/${id}`).once('value').catch(() => null));
                        const snaps = await Promise.all(promises);
                        const list = snaps.filter(s => s && s.exists()).map(s => ({ id: s.key, ...s.val() }));
                        setFriendSuggestions(list.sort(() => 0.5 - Math.random()).slice(0, 5));
                        return;
                    }
                }
                setFriendSuggestions([]);
            } catch (err) { setFriendSuggestions([]); }
        };
        fetchSuggestions();

        return () => { followsRef.off('value', followsListener); };
    }, [user.id]);

    // ==========================================================
    // AÇÕES
    // ==========================================================
    const handleLike = async (postId, hasLiked) => {
        const db = window.firebaseDB;
        if (!db) return;
        // Otimista
        setPosts(prev => prev.map(p => {
            if (p.id === postId) {
                return {
                    ...p,
                    hasLiked: !hasLiked,
                    likesCount: !hasLiked ? p.likesCount + 1 : Math.max(0, p.likesCount - 1)
                };
            }
            return p;
        }));
        try {
            const likeRef = db.ref(`posts/${postId}/likes/${user.id}`);
            if (hasLiked) await likeRef.remove();
            else await likeRef.set(true);
        } catch (e) { console.error("Erro like:", e); }
    };

    const handleAddComment = async (postId) => {
        if (!commentText.trim()) return;
        const db = window.firebaseDB;
        try {
            await db.ref(`posts/${postId}/comments`).push({
                authorId: user.id,
                authorName: user.name || user.nome,
                authorAvatar: user.avatar || '',
                text: commentText.trim(),
                timestamp: Date.now()
            });
            setCommentText('');
            showToast("Comentário adicionado!");
        } catch (e) { showToast("Erro ao comentar."); }
    };

    const handleShare = (post) => {
        setPostToShare(post);
        setShowShareModal(true);
    };

    const handleShareToChat = async (chatId, type) => {
        if (!postToShare) return;
        setSharingTo(prev => ({ ...prev, [chatId]: true }));
        try {
            const targetId = contacts.find(c => c.id === chatId)?.targetId || chatId;
            const refPath = type === 'group' ? `groups/${chatId}/messages` : `chats/${[user.id, targetId].sort().join('_')}/messages`;
            const shareUrl = `${window.location.origin}${window.location.pathname}?v=${postToShare.id}&from=${user.id}`;
            await window.firebaseDB.ref(refPath).push({
                senderId: user.id,
                senderName: user.name,
                type: 'shared_video',
                postUrl: shareUrl,
                mediaUrl: extractUrl(postToShare.mediaUrl),
                postTitle: postToShare.content ? postToShare.content.substring(0, 50) : 'Vídeo',
                timestamp: Date.now()
            });
            setSharedSuccess(prev => ({ ...prev, [chatId]: true }));
        } catch (e) { showToast("Erro ao compartilhar."); }
        finally { setSharingTo(prev => ({ ...prev, [chatId]: false })); }
    };

    const handleQuickShare = async () => { showToast("Compartilhamento rápido indisponível."); };

    const handleCameraCapture = async (file, type, audio, text) => {
        setIsUploading(true);
        setUploadStatus('Processando mídia...');
        try {
            const uid = user?.id || user?.uid || user?.privateId;
            await window.api.uploadToCDN(file, uid, 'midia', {
                title: text ? text.substring(0, 50) : 'Nova publicação',
                description: text || '',
                type: type === 'video' ? 'video' : (type === 'text' ? 'text' : (type === 'poll' ? 'poll' : 'image')),
                textContent: text || ''
            });
            showToast("Publicado com sucesso!");
            setTimeout(() => { setShowCamera(false); setIsUploading(false); }, 1500);
        } catch (err) {
            console.error("Erro:", err);
            showToast("Erro: " + err.message);
            setIsUploading(false);
        }
    };

    const loadMorePosts = async () => {
        if (!hasMorePosts || isLoadingMore || !lastPostKey) return;
        setIsLoadingMore(true);
        try {
            const db = window.firebaseDB;
            const snap = await db.ref('posts').orderByKey().endBefore(lastPostKey).limitToLast(30).once('value');
            if (snap.exists()) {
                const data = snap.val();
                const keys = Object.keys(data);
                if (keys.length === 0) { setHasMorePosts(false); return; }
                setLastPostKey(keys[0]);
                const newPostsList = keys.map(k => ({
                    id: k, ...data[k],
                    likesCount: data[k].likes ? Object.keys(data[k].likes).length : 0,
                    hasLiked: data[k].likes ? !!data[k].likes[user.id] : false,
                    commentsCount: data[k].comments ? Object.keys(data[k].comments).length : 0,
                })).filter(p => p.type !== 'story');
                setPosts(prev => [...prev, ...newPostsList.reverse()]);
                if (keys.length < 30) setHasMorePosts(false);
            } else setHasMorePosts(false);
        } catch (e) { console.error(e); }
        finally { setIsLoadingMore(false); }
    };

    const handleScroll = (e) => {
        const { scrollTop, clientHeight, scrollHeight } = e.target;
        if (scrollHeight - scrollTop <= clientHeight + 300) loadMorePosts();
    };

    const toggleFollow = async (targetId) => {
        const db = window.firebaseDB;
        if (!db) return;
        try {
            if (following[targetId]) {
                await db.ref(`follows/${user.id}/${targetId}`).remove();
                showToast("Você deixou de seguir.");
            } else {
                await db.ref(`follows/${user.id}/${targetId}`).set(true);
                showToast("Seguindo!");
            }
        } catch (e) { showToast("Erro ao seguir."); }
    };

    const getYoutubeId = (url) => {
        if (!url || typeof url !== 'string') return null;
        const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
        const match = url.match(regExp);
        return (match && match[2].length === 11) ? match[2] : null;
    };

    const getRelativeTime = (timestamp) => {
        const diff = Math.floor((now - timestamp) / 1000);
        if (diff < 60) return "agora";
        if (diff < 3600) return `há ${Math.floor(diff / 60)}min`;
        if (diff < 86400) return `há ${Math.floor(diff / 3600)}h`;
        return `há ${Math.floor(diff / 86400)}d`;
    };

    const renderTextWithHashtags = (text) => {
        if (!text || typeof text !== 'string') return null;
        return text.split(/(\s+)/).map((word, i) => {
            if (word.startsWith('#') && word.length > 1) {
                return <span key={i} className="text-purple-400 font-bold cursor-pointer hover:underline" onClick={() => { setSearchQuery(word); setFilterType('all'); }}>{word}</span>;
            }
            if (word.startsWith('@') && word.length > 1) {
                return <span key={i} className="text-pink-400 font-bold cursor-pointer hover:underline">{word}</span>;
            }
            if (word.match(/^https?:\/\/[^\s]+$/i)) {
                return <a key={i} href={word} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="text-blue-400 font-bold hover:underline break-all">{word}</a>;
            }
            return word;
        });
    };

    const allItems = [...posts].sort((a, b) => b.timestamp - a.timestamp);
    const filteredPosts = allItems.filter(post => {
        const s = searchQuery.toLowerCase();
        const matchesSearch = post.content?.toLowerCase().includes(s) || post.authorName?.toLowerCase().includes(s) || (post.hashtags && post.hashtags.some(h => h.toLowerCase().includes(s)));
        const matchesType = filterType === 'all' || post.type === filterType;
        return matchesSearch && matchesType;
    });

    const videoPosts = filteredPosts.filter(p => {
        const url = extractUrl(p.mediaUrl) || (p.mediaUrls && extractUrl(p.mediaUrls[0]));
        return p.type === 'video' || (url && (url.match(/\.(mp4|webm|ogg|mov)$/i) || url.includes('-mp4') || url.includes('cdn-phantora')));
    });

    const isDark = theme === 'dark';
    const cardBg = 'bg-secondary border border-border rounded-xl shadow-card';
    const textMuted = 'text-text-secondary';
    const headerBg = 'bg-secondary/80 backdrop-blur-lg border-b border-border';

    return (
        <div className="fixed inset-0 bg-primary text-primary font-sans z-50 flex flex-col" data-name="social-network" data-file="components/SocialNetwork.js">
            {toast && (
                <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[70] bg-black/90 text-white px-4 py-2 rounded-lg text-sm border border-white/10">
                    {toast}
                </div>
            )}

            {window.FriendRequestNotification && <window.FriendRequestNotification user={user} />}

            <header className={`${headerBg} px-4 py-3 flex items-center justify-between sticky top-0 z-10`}>
                <div className="flex items-center gap-3">
                    <img 
                        src={user.avatar || 'assets/default-avatar.svg'}
                        onError={(e) => { e.target.src = 'assets/default-avatar.svg'; }}
                        alt="Avatar" 
                        className="w-10 h-10 rounded-full object-cover border-2 border-accent cursor-pointer"
                        onClick={() => window.location.href = `canal.html?uid=${user.id}`}
                    />
                    <div className="flex flex-col justify-center">
                        <h1 className="text-lg font-bold hidden sm:block">Phantora</h1>
                        <span className="text-yellow-500 font-bold text-xs">{followerStats.count} {followerStats.count === 1 ? 'seguidor' : 'seguidores'}</span>
                    </div>
                </div>

                <div className="flex items-center gap-1 sm:gap-2">
                    <button onClick={() => { if (window.requestUserLocation) window.requestUserLocation(); window.location.href = 'discover.html'; }} className="p-2 rounded-full text-text-secondary hover:bg-tertiary" title="Descobrir">
                        <div className="icon-users text-xl"></div>
                    </button>
                    <button onClick={() => window.location.href = 'search.html'} className="p-2 hidden sm:block rounded-full text-text-secondary hover:bg-tertiary" title="Pesquisar">
                        <div className="icon-search text-xl"></div>
                    </button>
                    <button onClick={() => setShowSettings(true)} className="p-2 rounded-full text-text-secondary hover:bg-tertiary" title="Config">
                        <div className="icon-settings text-xl"></div>
                    </button>
                    <button onClick={onClose} className="p-2 rounded-full text-text-secondary hover:bg-tertiary hover:text-danger" title="Sair">
                        <div className="icon-log-out text-xl"></div>
                    </button>
                </div>
            </header>

            {/* Mobile Bottom Nav */}
            <div className="md:hidden fixed bottom-4 left-1/2 -translate-x-1/2 z-[40] bg-secondary/90 backdrop-blur-md border border-border rounded-full px-6 py-3 flex items-center justify-between w-[90%] max-w-[400px] shadow-lg">
                <button onClick={() => { setDesktopView('feed'); setActiveVideoFeed(null); window.scrollTo(0,0); }} className={`flex flex-col items-center gap-1 ${desktopView === 'feed' ? 'text-accent' : 'text-text-secondary'}`}>
                    <div className="icon-house text-2xl"></div>
                </button>
                <button onClick={() => setDesktopView('chat')} className={`flex flex-col items-center gap-1 ${desktopView === 'chat' ? 'text-accent' : 'text-text-secondary'}`}>
                    <div className="icon-message-circle text-2xl"></div>
                </button>
                <button onClick={() => window.location.href = 'upload.html'} className="flex flex-col items-center justify-center w-12 h-12 rounded-full bg-blue-500 text-white shadow-lg -mt-6 border-4 border-primary">
                    <div className="icon-plus text-2xl font-bold"></div>
                </button>
                <button onClick={() => {
                    if (videoPosts.length > 0) {
                        setInfiniteFeed(videoPosts.map(v => ({...v, uniqueKey: v.id})));
                        setActiveVideoFeed(0);
                    } else showToast("Nenhum vídeo.");
                }} className="flex flex-col items-center gap-1 text-text-secondary">
                    <div className="icon-circle-play text-2xl"></div>
                </button>
                <button onClick={() => window.location.href = `canal.html?uid=${user.id}`} className="flex flex-col items-center gap-1 text-text-secondary">
                    <div className="icon-user text-2xl"></div>
                </button>
            </div>

            {/* Desktop Sidebar */}
            <div className="hidden md:flex flex-col fixed right-0 top-[60px] bottom-0 w-20 bg-secondary/90 backdrop-blur-lg border-l border-border z-[40] py-6 items-center gap-6 shadow-lg">
                <button onClick={() => { setDesktopView('feed'); setActiveVideoFeed(null); window.scrollTo(0,0); }} className={`p-3 rounded-xl ${desktopView === 'feed' ? 'bg-accent/20 text-accent' : 'text-text-secondary'}`}>
                    <div className="icon-house text-2xl"></div>
                </button>
                <button onClick={() => setDesktopView('chat')} className={`p-3 rounded-xl ${desktopView === 'chat' ? 'bg-accent/20 text-accent' : 'text-text-secondary'}`}>
                    <div className="icon-message-circle text-2xl"></div>
                </button>
                <button onClick={() => window.location.href = 'upload.html'} className="w-12 h-12 rounded-xl bg-blue-500 text-white flex items-center justify-center" title="Novo Post">
                    <div className="icon-plus text-2xl font-bold"></div>
                </button>
                <button onClick={() => {
                    if (videoPosts.length > 0) {
                        setDesktopView('feed');
                        setInfiniteFeed(videoPosts.map(v => ({...v, uniqueKey: v.id})));
                        setActiveVideoFeed(0);
                    } else showToast("Nenhum vídeo.");
                }} className="p-3 rounded-xl text-text-secondary" title="Vídeos">
                    <div className="icon-circle-play text-2xl"></div>
                </button>
                <button onClick={() => window.location.href = `canal.html?uid=${user.id}`} className="p-3 rounded-xl text-text-secondary" title="Meu Canal">
                    <div className="icon-user text-2xl"></div>
                </button>
                <button onClick={() => setShowSettings(true)} className="p-3 rounded-xl text-text-secondary" title="Config">
                    <div className="icon-settings text-2xl"></div>
                </button>
            </div>

            {showSettings && typeof window.SettingsMenu !== 'undefined' && (
                <window.SettingsMenu isOpen={true} onClose={() => setShowSettings(false)} />
            )}

            {/* Stories */}
            {stories.length > 0 && (
                <div className="w-full max-w-2xl mx-auto p-4 pt-4 pb-0">
                    <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-hide">
                        {stories.map((story, i) => (
                            <div key={story.id} onClick={() => setActiveStory(i)} className="flex flex-col items-center gap-1 cursor-pointer flex-shrink-0">
                                <div className="w-16 h-16 rounded-full p-[2px] bg-gradient-to-tr from-yellow-400 to-indigo-600">
                                    <img src={story.authorAvatar || 'assets/default-avatar.svg'} onError={(e) => { e.target.src = 'assets/default-avatar.svg'; }} className="w-full h-full rounded-full object-cover border-2" />
                                </div>
                                <span className="text-xs font-medium max-w-[64px] truncate text-text-primary">{(story.authorName || 'Usuário').split(' ')[0]}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Story Viewer */}
            {activeStory !== null && stories[activeStory] && (
                <div className="fixed inset-0 z-[150] bg-black flex flex-col">
                    <div className="absolute top-4 left-4 z-10 flex items-center gap-3">
                        <img src={stories[activeStory].authorAvatar || 'assets/default-avatar.svg'} onError={(e) => { e.target.src = 'assets/default-avatar.svg'; }} className="w-10 h-10 rounded-full border border-white" />
                        <span className="text-white font-bold">{stories[activeStory].authorName || 'Usuário'}</span>
                    </div>
                    <button onClick={() => setActiveStory(null)} className="absolute top-4 right-4 z-10 text-white p-2">
                        <div className="icon-x text-2xl"></div>
                    </button>
                    <div className="flex-1 flex items-center justify-center relative">
                        <div className="absolute left-0 top-0 w-1/3 h-full z-10" onClick={() => setActiveStory(prev => prev > 0 ? prev - 1 : prev)}></div>
                        <div className="absolute right-0 top-0 w-1/3 h-full z-10" onClick={() => setActiveStory(prev => prev < stories.length - 1 ? prev + 1 : null)}></div>
                        {(() => {
                            const url = extractUrl(stories[activeStory].mediaUrl);
                            return (url.match(/\.(mp4|webm|ogg|mov)$/i) || stories[activeStory].type === 'video') 
                                ? <video src={url} autoPlay playsInline className="max-w-full max-h-full object-contain" onEnded={() => setActiveStory(prev => prev < stories.length - 1 ? prev + 1 : null)} />
                                : <img src={url} className="max-w-full max-h-full object-contain" />;
                        })()}
                    </div>
                </div>
            )}

            {/* Profile Modal */}
            {selectedUser && (
                <div className="fixed inset-0 z-[80] bg-black/50 flex items-center justify-center p-4">
                    <div className={`${isDark ? 'bg-gray-800 text-white' : 'bg-white text-gray-800'} w-full max-w-sm rounded-2xl shadow-xl p-6 text-center`}>
                        <img src={selectedUser.avatar || 'assets/default-avatar.svg'} onError={(e) => { e.target.src = 'assets/default-avatar.svg'; }} className="w-24 h-24 rounded-full object-cover mx-auto border-4 border-indigo-100 mb-4" />
                        <h3 className="text-xl font-bold">{selectedUser.name || 'Usuário'}</h3>
                    </div>
                </div>
            )}

            {/* Feed */}
            <div className="flex-1 overflow-y-auto p-4 md:p-6 pb-24 max-w-full md:max-w-4xl mx-auto w-full space-y-6" onScroll={desktopView === 'feed' ? handleScroll : undefined}>
                {desktopView === 'chat' ? (
                    <div className="bg-secondary rounded-2xl border border-border h-[80vh] overflow-hidden shadow-lg mt-4">
                        {window.ChatPage ? <window.ChatPage user={user} embedded={true} /> : <div className="text-center p-8 text-text-muted">Carregando...</div>}
                    </div>
                ) : (
                    <>
                        <div className={`p-4 ${cardBg} mb-6 max-w-2xl mx-auto`}>
                            <button onClick={() => window.location.href = 'upload.html'} className="w-full flex items-center gap-3 pl-4 pr-4 py-3 rounded-lg border border-border bg-primary hover:border-border-active">
                                <div className="icon-plus text-accent text-lg"></div>
                                <span className="font-semibold text-text-primary">Criar nova publicação...</span>
                            </button>
                        </div>

                        {filteredPosts.length === 0 ? (
                            <div className={`text-center mt-10 ${textMuted}`}>
                                <div className="icon-image text-4xl mb-3 opacity-50 mx-auto"></div>
                                <p>Nenhuma publicação encontrada.</p>
                            </div>
                        ) : (
                            filteredPosts.map(post => (
                                <div key={post.id} id={`post-${post.id}`} className={cardBg}>
                                    {/* Header do post */}
                                    <div className="p-4 flex justify-between items-start">
                                        <div className="flex items-center gap-3">
                                            <img 
                                                src={post.authorAvatar || 'assets/default-avatar.svg'} 
                                                onError={(e) => { e.target.src = 'assets/default-avatar.svg'; }}
                                                className="w-11 h-11 rounded-full object-cover border border-border cursor-pointer" 
                                                onClick={() => window.location.href = `channel.html?uid=${post.authorId}`}
                                            />
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <h3 className="font-bold text-base hover:text-accent cursor-pointer" onClick={() => window.location.href = `channel.html?uid=${post.authorId}`}>
                                                        {post.authorName || 'Usuário'}
                                                    </h3>
                                                    {post.authorId !== user.id && (
                                                        <button onClick={() => toggleFollow(post.authorId)} className={`text-xs px-2 py-0.5 rounded-md border font-semibold ${following[post.authorId] ? 'border-border text-text-secondary' : 'border-accent text-accent hover:bg-accent hover:text-white'}`}>
                                                            {following[post.authorId] ? 'Seguindo' : 'Seguir'}
                                                        </button>
                                                    )}
                                                </div>
                                                <div className={`text-sm ${textMuted}`}>{getRelativeTime(post.timestamp)}</div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Título / Conteúdo */}
                                    {post.title && <div className="px-4 pt-2 pb-1 font-bold text-lg break-words text-primary">{post.title}</div>}
                                    {(post.content || post.textContent) && (
                                        <div className="px-4 pb-3 whitespace-pre-wrap text-[15px] break-words text-indigo-50 font-medium leading-relaxed">
                                            {renderTextWithHashtags(post.content || post.textContent)}
                                        </div>
                                    )}

                                    {/* ============================================ */}
                                    {/* MÍDIA — VÍDEO / IMAGEM / CARROSSEL / ENQUETE */}
                                    {/* ============================================ */}
                                    {(() => {
                                        // -------- ENQUETE --------
                                        if (post.type === 'poll') {
                                            if (window.PollViewer) {
                                                return <window.PollViewer key={`poll-${post.id}`} post={post} user={user} />;
                                            }
                                            // Fallback se PollViewer não carregou
                                            return (
                                                <div className="p-4 border-t border-b border-border bg-tertiary/30">
                                                    <div className="font-bold text-lg mb-3 text-primary">{post.question || 'Enquete'}</div>
                                                    <div className="space-y-2">
                                                        {(post.options || []).map((opt, idx) => (
                                                            <div key={idx} className="p-3 rounded-lg bg-secondary border border-border text-text-primary">
                                                                {opt.text || opt}
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            );
                                        }

                                        // -------- CARROSSEL --------
                                        if (post.type === 'carousel' && post.mediaUrls && post.mediaUrls.length > 0) {
                                            return (
                                                <div className="flex overflow-x-auto snap-x snap-mandatory hide-scrollbar">
                                                    {post.mediaUrls.map((mUrlRaw, idx) => {
                                                        const mUrl = extractUrl(mUrlRaw);
                                                        if (!mUrl) return null;
                                                        const isVid = mUrl.match(/\.(mp4|webm|ogg|mov)$/i) || mUrl.includes('video') || mUrl.includes('mp4');
                                                        if (isVid) {
                                                            return (
                                                                <div key={idx} className="w-full shrink-0 snap-center bg-black flex justify-center">
                                                                    <video src={mUrl} playsInline controls className="w-full max-h-[500px] object-contain" />
                                                                </div>
                                                            );
                                                        }
                                                        return <img key={idx} src={mUrl} onError={(e) => { e.target.style.display = 'none'; }} className="w-full shrink-0 snap-center max-h-[500px] object-contain bg-black" loading="lazy" />;
                                                    })}
                                                </div>
                                            );
                                        }

                                        // -------- URL ÚNICA --------
                                        const urlRaw = post.mediaUrl || (post.mediaUrls && post.mediaUrls[0]);
                                        const url = extractUrl(urlRaw);
                                        if (!url) return null;

                                        // YouTube
                                        const ytId = getYoutubeId(url);
                                        if (ytId) {
                                            return (
                                                <div className="relative w-full bg-black" style={{ aspectRatio: '16/9' }}>
                                                    <iframe src={`https://www.youtube.com/embed/${ytId}`} frameBorder="0" allowFullScreen className="w-full h-full absolute inset-0"></iframe>
                                                </div>
                                            );
                                        }

                                        // Vídeo
                                        const isVideo = post.type === 'video' 
                                            || url.match(/\.(mp4|webm|ogg|mov)$/i) 
                                            || url.includes('-mp4') 
                                            || url.includes('cdn-phantora')
                                            || url.includes('/video');

                                        if (isVideo) {
                                            return (
                                                <div className="w-full bg-black flex justify-center">
                                                    <video 
                                                        src={url} 
                                                        playsInline 
                                                        controls
                                                        preload="metadata" 
                                                        className="w-full max-h-[600px] object-contain"
                                                    />
                                                </div>
                                            );
                                        }

                                        // Imagem
                                        return (
                                            <img 
                                                src={url} 
                                                onError={(e) => { e.target.style.display = 'none'; }} 
                                                alt="Post" 
                                                className="w-full max-h-[500px] object-contain bg-primary border-t border-b border-border" 
                                                loading="lazy" 
                                            />
                                        );
                                    })()}

                                    {/* Ações */}
                                    <div className={`px-4 py-3 border-t flex items-center justify-between border-border ${textMuted}`}>
                                        <div className="flex items-center gap-6">
                                            <button onClick={() => handleLike(post.id, post.hasLiked)} className={`flex items-center gap-2 ${post.hasLiked ? 'text-danger' : 'hover:text-danger'}`}>
                                                <div className={`icon-heart text-xl ${post.hasLiked ? 'fill-current' : ''}`}></div>
                                                <span className="text-sm font-semibold">{post.likesCount}</span>
                                            </button>
                                            <button onClick={() => setActiveCommentPost(activeCommentPost === post.id ? null : post.id)} className="flex items-center gap-2 hover:text-accent">
                                                <div className="icon-message-circle text-xl"></div>
                                                <span className="text-sm font-semibold">{post.commentsCount}</span>
                                            </button>
                                        </div>
                                        <button onClick={() => handleShare(post)} className="hover:text-accent">
                                            <div className="icon-share-2 text-xl"></div>
                                        </button>
                                    </div>

                                    {/* Comentários */}
                                    {activeCommentPost === post.id && (
                                        <div className="p-4 border-t bg-tertiary/30 border-border">
                                            <div className="flex gap-2 mb-4">
                                                <input type="text" value={commentText} onChange={(e) => setCommentText(e.target.value)} placeholder="Comentar..." className="flex-1 rounded-lg px-4 py-2 text-sm bg-primary border border-border text-primary" onKeyDown={(e) => e.key === 'Enter' && handleAddComment(post.id)} />
                                                <button onClick={() => handleAddComment(post.id)} disabled={!commentText.trim()} className="bg-accent text-white px-4 py-2 rounded-lg font-semibold disabled:opacity-50">Enviar</button>
                                            </div>
                                            {post.comments && Object.keys(post.comments).map(cId => {
                                                const c = post.comments[cId];
                                                return (
                                                    <div key={cId} className="flex gap-3 mb-3">
                                                        <img src={c.authorAvatar || 'assets/default-avatar.svg'} onError={(e) => { e.target.src = 'assets/default-avatar.svg'; }} className="w-8 h-8 rounded-full object-cover border border-border" />
                                                        <div className="flex-1 px-4 py-3 rounded-2xl bg-secondary border border-border">
                                                            <span className="font-bold block text-sm text-primary">{c.authorName || 'Usuário'}</span>
                                                            <span className="text-text-primary text-sm">{c.text}</span>
                                                            <span className="block text-[11px] mt-2 text-text-secondary">{getRelativeTime(c.timestamp)}</span>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            ))
                        )}

                        {isLoadingMore && (
                            <div className="flex justify-center py-4">
                                <div className="icon-loader animate-spin text-accent text-3xl"></div>
                            </div>
                        )}
                        {!hasMorePosts && posts.length > 0 && (
                            <div className="text-center py-4 text-text-muted text-sm">Você chegou ao fim do feed.</div>
                        )}
                    </>
                )}
            </div>

            {/* VideoFeed fullscreen */}
            {activeVideoFeed !== null && window.VideoFeed && (
                <window.VideoFeed
                    initialVideos={infiniteFeed}
                    initialActiveIndex={activeVideoFeed}
                    onClose={() => { setActiveVideoFeed(null); window.history.replaceState({}, '', window.location.pathname); }}
                    user={user}
                    following={following}
                    toggleFollow={toggleFollow}
                    handleLike={handleLike}
                    handleShare={handleShare}
                    quickShareUserId={quickShareUserId}
                    quickShareUserAvatar={quickShareUserAvatar}
                    handleQuickShare={handleQuickShare}
                    isQuickSharing={isQuickSharing}
                    quickShareSuccess={quickShareSuccess}
                    renderTextWithHashtags={renderTextWithHashtags}
                    getRelativeTime={getRelativeTime}
                />
            )}

            {/* Share Modal */}
            {showShareModal && postToShare && (
                <div className="fixed inset-0 z-[120] bg-black/60 flex items-center justify-center p-4">
                    <div className={`${isDark ? 'bg-gray-800 text-white' : 'bg-white text-gray-800'} w-full max-w-sm rounded-2xl shadow-xl overflow-hidden max-h-[80vh] flex flex-col`}>
                        <div className="p-4 border-b flex justify-between items-center">
                            <h3 className="font-bold text-lg">Compartilhar</h3>
                            <button onClick={() => setShowShareModal(false)} className="text-gray-400">
                                <div className="icon-x text-xl"></div>
                            </button>
                        </div>
                        <div className="p-4 flex gap-4 border-b">
                            <button onClick={() => { navigator.clipboard.writeText(`${window.location.origin}${window.location.pathname}?v=${postToShare.id}`); showToast("Link copiado!"); }} className="flex flex-col items-center gap-2 min-w-[70px]">
                                <div className="w-12 h-12 rounded-full flex items-center justify-center bg-gray-100 dark:bg-gray-700"><div className="icon-link"></div></div>
                                <span className="text-xs">Copiar</span>
                            </button>
                            <button onClick={() => { const text = `Confira: ${window.location.origin}${window.location.pathname}?v=${postToShare.id}`; window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`); }} className="flex flex-col items-center gap-2 min-w-[70px]">
                                <div className="w-12 h-12 rounded-full bg-green-500 text-white flex items-center justify-center"><div className="icon-message-circle"></div></div>
                                <span className="text-xs">WhatsApp</span>
                            </button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-2">
                            {contacts.length === 0 ? (
                                <div className="text-center py-8 text-gray-500 text-sm">Nenhum contato.</div>
                            ) : contacts.map(c => (
                                <div key={c.id} className="flex items-center justify-between p-3 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700">
                                    <div className="flex items-center gap-3">
                                        <img src={c.avatar || 'assets/default-avatar.svg'} onError={(e) => { e.target.src = 'assets/default-avatar.svg'; }} className="w-10 h-10 rounded-full object-cover" />
                                        <span className="font-bold text-sm">{c.name}</span>
                                    </div>
                                    <button onClick={() => handleShareToChat(c.id, c.type)} className={`px-4 py-1.5 rounded-full text-xs font-bold ${sharedSuccess[c.id] ? 'bg-green-500 text-white' : 'bg-indigo-600 text-white'}`}>
                                        {sharedSuccess[c.id] ? '✓' : 'Enviar'}
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {pendingLink && (
                <div className="fixed inset-0 z-[300] bg-black/80 flex items-center justify-center p-4">
                    <div className="bg-gray-800 rounded-2xl p-6 max-w-sm w-full text-center">
                        <h3 className="text-xl font-bold text-white mb-2">Sair do Phantora?</h3>
                        <p className="text-xs text-gray-500 mb-6 break-all bg-gray-900 p-2 rounded">{pendingLink.url}</p>
                        <div className="flex gap-3">
                            <button onClick={() => setPendingLink(null)} className="flex-1 py-3 bg-gray-700 text-white rounded-xl font-bold">Cancelar</button>
                            <button onClick={() => { window.open(pendingLink.url, '_blank'); setPendingLink(null); }} className="flex-1 py-3 bg-indigo-600 text-white rounded-xl font-bold">Acessar</button>
                        </div>
                    </div>
                </div>
            )}

            {showDiscovery && window.FriendSwipe && <window.FriendSwipe user={user} onClose={() => setShowDiscovery(false)} />}

            {showCamera && window.MediaCapture && (
                <window.MediaCapture 
                    onCapture={handleCameraCapture} 
                    onClose={() => setShowCamera(false)} 
                />
            )}
        </div>
    );
}

window.SocialNetwork = SocialNetwork;
