function SocialNetwork({ user, onClose }) {
    const [posts, setPosts] = React.useState([]);
    const [isLoadingPosts, setIsLoadingPosts] = React.useState(true);
    const [isLoadingMore, setIsLoadingMore] = React.useState(false);
    const [hasMorePosts, setHasMorePosts] = React.useState(true);
    const [lastPostKey, setLastPostKey] = React.useState(null);
    const [stories, setStories] = React.useState([]);
    const [activeStory, setActiveStory] = React.useState(null);
    const [activeCommentPost, setActiveCommentPost] = React.useState(null);
    const [commentText, setCommentText] = React.useState('');
    const [activeVideoFeed, setActiveVideoFeed] = React.useState(null);
    const [infiniteFeed, setInfiniteFeed] = React.useState([]);
    const [searchQuery, setSearchQuery] = React.useState('');
    const [showShareModal, setShowShareModal] = React.useState(false);
    const [postToShare, setPostToShare] = React.useState(null);
    const [shareStartTime, setShareStartTime] = React.useState(0);
    const [generatedTag, setGeneratedTag] = React.useState(null);
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
    const [showSettings, setShowSettings] = React.useState(false);
    const [idToken, setIdToken] = React.useState(null);
    const [deletingPostId, setDeletingPostId] = React.useState(null);
    const [showTagViewer, setShowTagViewer] = React.useState(false);
    const [currentTagId, setCurrentTagId] = React.useState(null);
    const [sharingStartTime, setSharingStartTime] = React.useState(0);
    const autoOpenedVideoRef = React.useRef(false);

    React.useEffect(() => {
        const interval = setInterval(() => setNow(Date.now()), 30000);
        return () => clearInterval(interval);
    }, []);

    React.useEffect(() => {
        localStorage.setItem('social_theme', theme);
    }, [theme]);

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
                if (token) {
                    setIdToken(token);
                    window._currentToken = token;
                }
            } catch (e) {}
        };
        fetchToken();
        const interval = setInterval(fetchToken, 30 * 60 * 1000);
        return () => clearInterval(interval);
    }, []);

    // DETECTA ?tag=TAG_ID NA URL
    React.useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const tagId = params.get('tag');
        if (tagId) {
            setCurrentTagId(tagId);
            setShowTagViewer(true);
        }
    }, []);

    const showToast = (msg) => {
        setToast(msg);
        setTimeout(() => setToast(null), 3000);
    };

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

    const getFilenameFromUrl = (url) => {
        if (!url || typeof url !== 'string') return null;
        try {
            const cleanUrl = url.split('?')[0];
            const parts = cleanUrl.split('/');
            return parts[parts.length - 1] || null;
        } catch (e) { return null; }
    };

    // GERA TAG ÚNICA DE 24H
    const generateTagId = () => {
        const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        let result = '';
        for (let i = 0; i < 12; i++) {
            result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return result;
    };

    const createTag = async (postId, startTime = 0) => {
        const db = window.firebaseDB;
        if (!db) throw new Error("Firebase não disponível");
        const tagId = generateTagId();
        const now = Date.now();
        const expiresAt = now + 24 * 60 * 60 * 1000;
        const tagData = {
            id: tagId,
            videoId: postId,
            senderId: user.id || user.uid || user.privateId,
            senderName: user.name || user.nome || 'Usuário',
            startTime: Math.floor(startTime),
            createdAt: now,
            expiresAt: expiresAt,
            views: 0
        };
        await db.ref(`tags/${tagId}`).set(tagData);
        return tagData;
    };

    const handleShare = async (post, startTime = 0) => {
        try {
            const tag = await createTag(post.id, startTime);
            setGeneratedTag(tag);
            setPostToShare(post);
            setShareStartTime(startTime);
            setShowShareModal(true);
        } catch (e) {
            showToast("Erro ao gerar link: " + e.message);
        }
    };

    const getShareUrl = () => {
        if (!generatedTag) return '';
        return `${window.location.origin}${window.location.pathname}?tag=${generatedTag.id}`;
    };

    const handleCopyLink = () => {
        const url = getShareUrl();
        if (!url) return;
        navigator.clipboard.writeText(url);
        showToast("Link copiado!");
    };

    const handleShareToChat = async (chatId, type) => {
        if (!postToShare || !generatedTag) return;
        setSharingTo(prev => ({ ...prev, [chatId]: true }));
        try {
            const targetId = contacts.find(c => c.id === chatId)?.targetId || chatId;
            const refPath = type === 'group' ? `groups/${chatId}/messages` : `chats/${[user.id, targetId].sort().join('_')}/messages`;
            await window.firebaseDB.ref(refPath).push({
                senderId: user.id,
                senderName: user.name,
                type: 'shared_video',
                postUrl: getShareUrl(),
                tagId: generatedTag.id,
                mediaUrl: extractUrl(postToShare.mediaUrl),
                postTitle: postToShare.content ? postToShare.content.substring(0, 50) : 'Vídeo',
                startTime: shareStartTime,
                timestamp: Date.now()
            });
            setSharedSuccess(prev => ({ ...prev, [chatId]: true }));
        } catch (e) { showToast("Erro ao compartilhar."); }
        finally { setSharingTo(prev => ({ ...prev, [chatId]: false })); }
    };

    const handleShareWhatsApp = () => {
        const url = getShareUrl();
        if (!url) return;
        const text = `🎬 Confira este vídeo no Phantora: ${url}`;
        window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`, '_blank');
    };

    const openVideoFromTag = (videoId, startTime = 0) => {
        const vPosts = posts.filter(p => {
            const raw = extractUrl(p.mediaUrl) || (p.mediaUrls && extractUrl(p.mediaUrls[0]));
            return isVideoUrl(raw);
        });
        const idx = vPosts.findIndex(p => p.id === videoId);
        if (idx !== -1) {
            const list = vPosts.map(v => {
                const raw = extractUrl(v.mediaUrl) || (v.mediaUrls && extractUrl(v.mediaUrls[0]));
                return { ...v, mediaUrl: cdnUrl(raw), uniqueKey: v.id, startAt: startTime };
            });
            setInfiniteFeed(list);
            setActiveVideoFeed(idx);
        } else {
            showToast("Vídeo não encontrado no feed atual.");
        }
    };

    const handleDeletePost = async (postId) => {
        if (!window.confirm("Deseja realmente excluir esta publicação? O arquivo também será deletado do servidor.")) return;
        setDeletingPostId(postId);
        const db = window.firebaseDB;
        if (!db) { setDeletingPostId(null); return; }
        try {
            const postSnap = await db.ref(`posts/${postId}`).once('value');
            const post = postSnap.val();
            if (!post) { showToast("Post não encontrado."); setDeletingPostId(null); return; }
            const urlsToDelete = [];
            const mediaUrl = extractUrl(post.mediaUrl);
            if (mediaUrl) urlsToDelete.push(mediaUrl);
            if (Array.isArray(post.mediaUrls)) {
                post.mediaUrls.forEach(u => {
                    const url = extractUrl(u);
                    if (url) urlsToDelete.push(url);
                });
            }
            for (const url of urlsToDelete) {
                const filename = getFilenameFromUrl(url);
                if (filename) { try { await window.api.deleteFromCDN(filename); } catch (e) {} }
            }
            await db.ref(`posts/${postId}`).remove();
            await db.ref(`users/${user.id}/user_posts/${postId}`).remove().catch(() => {});
            setPosts(prev => prev.filter(p => p.id !== postId));
            showToast("Post excluído com sucesso!");
        } catch (error) {
            showToast("Erro ao excluir: " + error.message);
        } finally {
            setDeletingPostId(null);
        }
    };

    React.useEffect(() => {
        if (autoOpenedVideoRef.current) return;
        if (posts.length === 0) return;
        const params = new URLSearchParams(window.location.search);
        const videoId = params.get('v');
        if (!videoId) return;
        const vPosts = posts.filter(p => {
            const raw = extractUrl(p.mediaUrl) || (p.mediaUrls && extractUrl(p.mediaUrls[0]));
            return isVideoUrl(raw);
        });
        const idx = vPosts.findIndex(p => p.id === videoId);
        if (idx !== -1) {
            autoOpenedVideoRef.current = true;
            const list = vPosts.map(v => {
                const raw = extractUrl(v.mediaUrl) || (v.mediaUrls && extractUrl(v.mediaUrls[0]));
                return { ...v, mediaUrl: cdnUrl(raw), uniqueKey: v.id };
            });
            setInfiniteFeed(list);
            setActiveVideoFeed(idx);
        }
    }, [posts.length, idToken]);

    const POSTS_PER_PAGE = 30;

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
                            const city = data.address.city || data.address.town || data.address.village || "Desconhecida";
                            const state = data.address.state || "Desconhecido";
                            if (city !== "Desconhecida" && state !== "Desconhecido") {
                                await db.ref(`users/${user.id}`).update({ city, state });
                                await db.ref(`location_users/${state}/${city}/${user.id}`).set(true);
                                localStorage.setItem('location_saved', 'true');
                            }
                        }
                    } catch(e) {}
                }, () => {});
            }
        };
        requestLocation();
        window.requestUserLocation = () => { localStorage.removeItem('location_saved'); requestLocation(); };

        db.ref('posts').orderByChild('type').equalTo('story').once('value').then(snap => {
            if (snap.exists()) {
                const data = snap.val();
                const list = Object.keys(data).map(k => ({ id: k, ...data[k] }))
                    .filter(p => Date.now() - p.timestamp < 24 * 60 * 60 * 1000);
                setStories(list);
            }
        }).catch(() => {});

        const loadContacts = async () => {
            try {
                const chatsSnap = await db.ref(`users/${user.id}/chats`).once('value').catch(() => null);
                if (chatsSnap && chatsSnap.exists()) {
                    const chats = chatsSnap.val();
                    const list = [];
                    for (const chatId of Object.keys(chats)) {
                        const c = chats[chatId];
                        const targetId = c.targetId || chatId;
                        const photoSnap = await db.ref(`users/${targetId}/profilePicture`).once('value').catch(() => null);
                        const userSnap = await db.ref(`users/${targetId}`).once('value').catch(() => null);
                        const avatar = photoSnap ? photoSnap.val() : null;
                        const uData = userSnap && userSnap.exists() ? userSnap.val() : {};
                        list.push({
                            id: chatId,
                            targetId: targetId,
                            name: uData.name || 'Usuário',
                            avatar: avatar || 'assets/default-avatar.svg',
                            type: 'chat'
                        });
                    }
                    setContacts(list);
                }
            } catch (e) {}
        };
        loadContacts();

        const loadInitialPosts = async () => {
            try {
                const snap = await db.ref('posts').orderByKey().limitToLast(POSTS_PER_PAGE).once('value');
                if (!snap.exists()) {
                    setPosts([]); setHasMorePosts(false); setIsLoadingPosts(false); return;
                }
                const data = snap.val();
                const keys = Object.keys(data);
                setLastPostKey(keys[0]);
                if (keys.length < POSTS_PER_PAGE) setHasMorePosts(false);
                const list = keys.map(k => ({
                    id: k,
                    ...data[k],
                    authorName: null,
                    authorAvatar: null,
                    likesCount: data[k].likes ? Object.keys(data[k].likes).length : 0,
                    hasLiked: data[k].likes ? !!data[k].likes[user.id] : false,
                    commentsCount: data[k].comments ? Object.keys(data[k].comments).length : 0
                })).filter(p => p.type !== 'story');
                const reversed = list.reverse();
                setPosts(reversed);
                setIsLoadingPosts(false);
                setTimeout(() => enrichPostsBackground(reversed), 50);
            } catch (e) {
                setPosts([]); setHasMorePosts(false); setIsLoadingPosts(false);
            }
        };
        loadInitialPosts();

        const followsRef = db.ref(`follows/${user.id}`);
        const followsListener = followsRef.on('value', (snap) => {
            setFollowing(snap.val() || {});
        }, () => setFollowing({}));

        db.ref('follows').once('value').then(snap => {
            if (snap.exists()) {
                const allFollows = snap.val();
                let count = 0;
                for (const fid in allFollows) if (allFollows[fid][user.id]) count++;
                setFollowerStats({ count, lastUpdated: Date.now() });
            }
        }).catch(() => {});

        return () => { followsRef.off('value', followsListener); };
    }, [user.id]);

    const enrichPostsBackground = async (postsList) => {
        const db = window.firebaseDB;
        if (!db) return;
        if (!window._userCache) window._userCache = {};
        const uids = [...new Set(postsList.map(p => p.authorId).filter(Boolean))];
        const userDataMap = {};
        await Promise.all(uids.map(async (uid) => {
            if (window._userCache[uid]) { userDataMap[uid] = window._userCache[uid]; return; }
            try {
                const [photoSnap, userSnap] = await Promise.all([
                    db.ref(`users/${uid}/profilePicture`).once('value').catch(() => null),
                    db.ref(`users/${uid}`).once('value').catch(() => null)
                ]);
                const profilePicture = photoSnap ? photoSnap.val() : null;
                const uData = userSnap && userSnap.exists() ? userSnap.val() : {};
                const info = { name: uData.name || 'Usuário', avatar: profilePicture || 'assets/default-avatar.svg', isVerified: !!uData.isVerified };
                window._userCache[uid] = info;
                userDataMap[uid] = info;
            } catch (e) {
                userDataMap[uid] = { name: 'Usuário', avatar: 'assets/default-avatar.svg' };
            }
        }));
        setPosts(prev => prev.map(p => {
            if (!p.authorId || !userDataMap[p.authorId]) return p;
            const info = userDataMap[p.authorId];
            return { ...p, authorName: info.name, authorAvatar: info.avatar, isVerified: info.isVerified };
        }));
    };

    const loadMorePosts = async () => {
        if (!hasMorePosts || isLoadingMore || !lastPostKey) return;
        setIsLoadingMore(true);
        try {
            const db = window.firebaseDB;
            const snap = await db.ref('posts').orderByKey().endBefore(lastPostKey).limitToLast(POSTS_PER_PAGE).once('value');
            if (snap.exists()) {
                const data = snap.val();
                const keys = Object.keys(data);
                if (keys.length === 0) { setHasMorePosts(false); return; }
                setLastPostKey(keys[0]);
                const newList = keys.map(k => ({
                    id: k,
                    ...data[k],
                    likesCount: data[k].likes ? Object.keys(data[k].likes).length : 0,
                    hasLiked: data[k].likes ? !!data[k].likes[user.id] : false,
                    commentsCount: data[k].comments ? Object.keys(data[k].comments).length : 0
                })).filter(p => p.type !== 'story').reverse();
                setPosts(prev => [...prev, ...newList]);
                enrichPostsBackground(newList);
                if (keys.length < POSTS_PER_PAGE) setHasMorePosts(false);
            } else { setHasMorePosts(false); }
        } catch (e) {}
        finally { setIsLoadingMore(false); }
    };

    const handleScroll = (e) => {
        const { scrollTop, clientHeight, scrollHeight } = e.target;
        if (scrollHeight - scrollTop <= clientHeight + 400) loadMorePosts();
    };

    const handleLike = async (postId, hasLiked) => {
        const db = window.firebaseDB;
        if (!db) return;
        setPosts(prev => prev.map(p => p.id === postId ? { ...p, hasLiked: !hasLiked, likesCount: !hasLiked ? p.likesCount + 1 : Math.max(0, p.likesCount - 1) } : p));
        try {
            const likeRef = db.ref(`posts/${postId}/likes/${user.id}`);
            if (hasLiked) await likeRef.remove();
            else await likeRef.set(true);
        } catch (e) {}
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

    const handleCameraCapture = async (file, type, audio, text) => {
        setIsUploading(true);
        setUploadStatus('Processando...');
        try {
            const uid = user?.id || user?.uid || user?.privateId;
            await window.api.uploadToCDN(file, uid, 'midia', {
                title: text ? text.substring(0, 50) : 'Nova publicação',
                description: text || '',
                type: type === 'video' ? 'video' : (type === 'text' ? 'text' : (type === 'poll' ? 'poll' : 'image')),
                textContent: text || ''
            });
            showToast("Publicado!");
            setTimeout(() => { setShowCamera(false); setIsUploading(false); }, 1500);
        } catch (err) {
            showToast("Erro: " + err.message);
            setIsUploading(false);
        }
    };

    const toggleFollow = async (targetId) => {
        const db = window.firebaseDB;
        if (!db) return;
        try {
            if (following[targetId]) {
                await db.ref(`follows/${user.id}/${targetId}`).remove();
                showToast("Deixou de seguir.");
            } else {
                await db.ref(`follows/${user.id}/${targetId}`).set(true);
                showToast("Seguindo!");
            }
        } catch (e) { showToast("Erro."); }
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
                return <span key={i} className="text-purple-400 font-bold cursor-pointer hover:underline" onClick={() => { setActiveHashtag(word); setSearchQuery(word); setFilterType('all'); setActiveVideoFeed(null); }}>{word}</span>;
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
        const matchesType = filterType === 'all' || post.type === filterType || (filterType === 'image' && post.type === 'video');
        return matchesSearch && matchesType;
    });

    const videoPosts = filteredPosts.filter(p => {
        const raw = extractUrl(p.mediaUrl) || (p.mediaUrls && extractUrl(p.mediaUrls[0]));
        return isVideoUrl(raw);
    });

    const isDark = theme === 'dark';
    const cardBg = 'bg-secondary border border-border rounded-xl shadow-card hover:-translate-y-0.5 hover:shadow-lg transition-all duration-200';
    const textMuted = 'text-text-secondary';
    const headerBg = 'bg-secondary/80 backdrop-blur-lg border-b border-border';

    const InlineVideoPlayer = ({ post }) => {
        const videoRef = React.useRef(null);
        const containerRef = React.useRef(null);
        const [isPlaying, setIsPlaying] = React.useState(false);
        const [isMuted, setIsMuted] = React.useState(true);
        const [progress, setProgress] = React.useState(0);
        const [showOverlay, setShowOverlay] = React.useState(true);
        const [authedUrl, setAuthedUrl] = React.useState('');
        const [hasError, setHasError] = React.useState(false);
        const [isVisible, setIsVisible] = React.useState(false);

        React.useEffect(() => {
            const el = containerRef.current;
            if (!el) return;
            const observer = new IntersectionObserver((entries) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) { setIsVisible(true); observer.disconnect(); }
                });
            }, { rootMargin: '300px' });
            observer.observe(el);
            return () => observer.disconnect();
        }, []);

        React.useEffect(() => {
            if (!isVisible) return;
            let cancelled = false;
            const load = async () => {
                const rawUrl = extractUrl(post.mediaUrl) || (post.mediaUrls && extractUrl(post.mediaUrls[0]));
                if (!rawUrl) return;
                let finalUrl = cdnUrl(rawUrl);
                if (window.api && typeof window.api.getAuthedUrl === 'function') {
                    try { finalUrl = await window.api.getAuthedUrl(rawUrl); } catch (e) {}
                }
                if (!cancelled) setAuthedUrl(finalUrl);
            };
            load();
            return () => { cancelled = true; };
        }, [post.id, isVisible]);

        const togglePlay = (e) => {
            e.stopPropagation();
            const vid = videoRef.current;
            if (!vid) return;
            if (vid.paused) { vid.play().catch(()=>{}); setIsPlaying(true); setShowOverlay(false); }
            else { vid.pause(); setIsPlaying(false); setShowOverlay(true); }
        };

        const toggleMute = (e) => {
            e.stopPropagation();
            const vid = videoRef.current;
            if (!vid) return;
            vid.muted = !vid.muted;
            setIsMuted(vid.muted);
        };

        const handleTimeUpdate = () => {
            const vid = videoRef.current;
            if (!vid || !vid.duration) return;
            setProgress((vid.currentTime / vid.duration) * 100);
        };

        const handleOpenFeed = (e) => {
            e.stopPropagation();
            const idx = videoPosts.findIndex(vp => vp.id === post.id);
            const list = videoPosts.map(v => {
                const raw = extractUrl(v.mediaUrl) || (v.mediaUrls && extractUrl(v.mediaUrls[0]));
                return { ...v, mediaUrl: cdnUrl(raw), uniqueKey: v.id };
            });
            setInfiniteFeed(list);
            setActiveVideoFeed(idx !== -1 ? idx : 0);
        };

        return (
            <div ref={containerRef} className="relative w-full bg-black" onClick={handleOpenFeed}>
                {!isVisible && (
                    <div className="w-full h-64 flex items-center justify-center bg-black/40">
                        <div className="text-white/40 text-sm">Carregando vídeo...</div>
                    </div>
                )}
                {isVisible && !authedUrl && (
                    <div className="w-full h-64 flex items-center justify-center bg-black">
                        <div className="icon-loader animate-spin text-white text-3xl"></div>
                    </div>
                )}
                {isVisible && authedUrl && !hasError && (
                    <>
                        <video ref={videoRef} src={authedUrl} playsInline muted={isMuted} loop preload="metadata" className="w-full max-h-[600px] object-contain pointer-events-none" onTimeUpdate={handleTimeUpdate} onPlay={() => { setIsPlaying(true); setShowOverlay(false); }} onPause={() => { setIsPlaying(false); setShowOverlay(true); }} onError={() => setHasError(true)} />
                        {showOverlay && (
                            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                <div className="w-20 h-20 bg-black/50 rounded-full flex items-center justify-center backdrop-blur-md border border-white/20">
                                    <div className="icon-play text-white text-4xl ml-1"></div>
                                </div>
                            </div>
                        )}
                        <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/20">
                            <div className="h-full bg-white transition-all" style={{ width: `${progress}%` }}></div>
                        </div>
                        <div className="absolute bottom-3 right-3 flex gap-2">
                            <button onClick={togglePlay} className="w-10 h-10 rounded-full bg-black/50 backdrop-blur-md flex items-center justify-center border border-white/20">
                                <div className={`text-white text-xl ${isPlaying ? 'icon-pause' : 'icon-play'}`}></div>
                            </button>
                            <button onClick={toggleMute} className="w-10 h-10 rounded-full bg-black/50 backdrop-blur-md flex items-center justify-center border border-white/20">
                                <div className={`text-white text-xl ${isMuted ? 'icon-volume-x' : 'icon-volume-2'}`}></div>
                            </button>
                        </div>
                    </>
                )}
                {hasError && (
                    <div className="w-full h-64 flex items-center justify-center bg-black flex-col gap-2">
                        <div className="icon-alert-circle text-red-400 text-4xl"></div>
                        <span className="text-white/60 text-sm">Erro ao carregar vídeo</span>
                    </div>
                )}
            </div>
        );
    };

    return (
        <div className="fixed inset-0 bg-primary text-primary font-sans z-50 flex flex-col animate-fade-in transition-colors duration-300" data-name="social-network" data-file="components/SocialNetwork.js">
            {toast && (
                <div className="fixed top-20 left-1/2 transform -translate-x-1/2 z-[70] bg-tertiary text-primary px-4 py-2 rounded-lg shadow-lg text-sm flex items-center gap-2 animate-fade-in-up border border-border">
                    <div className="icon-info text-accent"></div>
                    {toast}
                </div>
            )}

            {window.FriendRequestNotification && <window.FriendRequestNotification user={user} />}

            <header className={`${headerBg} px-4 py-3 flex items-center justify-between sticky top-0 z-10 transition-colors`}>
                <div className="flex items-center gap-3">
                    <img src={user.avatar || 'assets/default-avatar.svg'} onError={(e) => { e.target.src = 'assets/default-avatar.svg'; }} alt="Avatar" className="w-10 h-10 rounded-full object-cover border-2 border-accent cursor-pointer hover:opacity-80 transition-opacity shrink-0" onClick={() => window.location.href = `canal.html?uid=${user.id}`} />
                    <div className="flex flex-col justify-center">
                        <h1 className="text-lg font-bold text-primary hidden sm:block leading-none mb-1">Phantora</h1>
                        <div className="flex flex-col">
                            <span className="text-yellow-500 font-bold text-xs leading-none">{followerStats.count} {followerStats.count === 1 ? 'seguidor' : 'seguidores'}</span>
                            <span className="text-text-muted text-[10px] leading-none mt-1">atualizado agora</span>
                        </div>
                    </div>
                </div>
                <div className="flex items-center gap-1 sm:gap-2">
                    <button onClick={() => { if (window.requestUserLocation) window.requestUserLocation(); window.location.href = 'discover.html'; }} className="p-2 rounded-full text-text-secondary hover:bg-tertiary hover:text-accent transition-colors" title="Descobrir Pessoas"><div className="icon-users text-xl"></div></button>
                    <button onClick={() => window.location.href = 'search.html'} className="p-2 hidden sm:block rounded-full text-text-secondary hover:bg-tertiary" title="Pesquisar"><div className="icon-search text-xl"></div></button>
                    <button onClick={() => setShowSettings(true)} className="p-2 rounded-full text-text-secondary hover:bg-tertiary" title="Configurações"><div className="icon-settings text-xl"></div></button>
                    <button onClick={onClose} className="p-2 rounded-full text-text-secondary hover:bg-tertiary hover:text-danger" title="Sair"><div className="icon-log-out text-xl"></div></button>
                </div>
            </header>

            <div className="md:hidden fixed bottom-4 left-1/2 transform -translate-x-1/2 z-[40] bg-secondary/90 backdrop-blur-md border border-border rounded-full px-6 py-3 flex items-center justify-between w-[90%] max-w-[400px] shadow-lg">
                <button onClick={() => { setDesktopView('feed'); setActiveVideoFeed(null); window.scrollTo(0,0); }} className={`flex flex-col items-center gap-1 transition-colors active:scale-95 ${desktopView === 'feed' ? 'text-accent' : 'text-text-secondary'}`}><div className="icon-house text-2xl"></div></button>
                <button onClick={() => setDesktopView('chat')} className={`flex flex-col items-center gap-1 transition-colors active:scale-95 ${desktopView === 'chat' ? 'text-accent' : 'text-text-secondary'}`}><div className="icon-message-circle text-2xl"></div></button>
                <button onClick={() => window.location.href = 'upload.html'} className="flex flex-col items-center justify-center w-12 h-12 rounded-full bg-blue-500 text-white shadow-[0_0_15px_rgba(59,130,246,0.5)] -mt-6 border-4 border-primary"><div className="icon-plus text-2xl font-bold"></div></button>
                <button onClick={() => {
                    if (videoPosts.length > 0) {
                        const list = videoPosts.map(v => {
                            const raw = extractUrl(v.mediaUrl) || (v.mediaUrls && extractUrl(v.mediaUrls[0]));
                            return { ...v, mediaUrl: cdnUrl(raw), uniqueKey: v.id };
                        });
                        setInfiniteFeed(list); setActiveVideoFeed(0);
                    } else showToast("Nenhum vídeo disponível.");
                }} className="flex flex-col items-center gap-1 text-text-secondary"><div className="icon-circle-play text-2xl"></div></button>
                <button onClick={() => window.location.href = `canal.html?uid=${user.id}`} className="flex flex-col items-center gap-1 text-text-secondary"><div className="icon-user text-2xl"></div></button>
            </div>

            <div className="hidden md:flex flex-col fixed right-0 top-[60px] bottom-0 w-20 bg-secondary/90 backdrop-blur-lg border-l border-border z-[40] py-6 items-center gap-6 shadow-lg">
                <button onClick={() => { setDesktopView('feed'); setActiveVideoFeed(null); window.scrollTo(0,0); }} className={`p-3 rounded-xl transition-all ${desktopView === 'feed' ? 'bg-accent/20 text-accent' : 'text-text-secondary'}`} title="Início"><div className="icon-house text-2xl"></div></button>
                <button onClick={() => setDesktopView('chat')} className={`p-3 rounded-xl transition-all ${desktopView === 'chat' ? 'bg-accent/20 text-accent' : 'text-text-secondary'}`} title="Mensagens"><div className="icon-message-circle text-2xl"></div></button>
                <button onClick={() => window.location.href = 'upload.html'} className="w-12 h-12 rounded-xl bg-blue-500 text-white flex items-center justify-center" title="Novo Post"><div className="icon-plus text-2xl font-bold"></div></button>
                <button onClick={() => {
                    if (videoPosts.length > 0) {
                        setDesktopView('feed');
                        const list = videoPosts.map(v => {
                            const raw = extractUrl(v.mediaUrl) || (v.mediaUrls && extractUrl(v.mediaUrls[0]));
                            return { ...v, mediaUrl: cdnUrl(raw), uniqueKey: v.id };
                        });
                        setInfiniteFeed(list); setActiveVideoFeed(0);
                    } else showToast("Nenhum vídeo disponível.");
                }} className="p-3 rounded-xl text-text-secondary" title="Vídeos"><div className="icon-circle-play text-2xl"></div></button>
                <button onClick={() => window.location.href = `canal.html?uid=${user.id}`} className="p-3 rounded-xl text-text-secondary" title="Meu Canal"><div className="icon-user text-2xl"></div></button>
                <button onClick={() => setShowSettings(true)} className="p-3 rounded-xl text-text-secondary" title="Configurações"><div className="icon-settings text-2xl"></div></button>
            </div>

            {showSettings && typeof window.SettingsMenu !== 'undefined' && <window.SettingsMenu isOpen={true} onClose={() => setShowSettings(false)} />}

            {stories.length > 0 && (
                <div className="w-full max-w-2xl mx-auto p-4 md:px-6 pt-4 pb-0">
                    <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-hide">
                        {stories.map((story, i) => (
                            <div key={story.id} onClick={() => setActiveStory(i)} className="flex flex-col items-center gap-1 cursor-pointer group flex-shrink-0">
                                <div className="w-16 h-16 rounded-full p-[2px] bg-gradient-to-tr from-yellow-400 to-indigo-600">
                                    <img src={story.authorAvatar || 'assets/default-avatar.svg'} onError={(e) => { e.target.src = 'assets/default-avatar.svg'; }} className="w-full h-full rounded-full object-cover border-2" />
                                </div>
                                <span className="text-xs font-medium max-w-[64px] truncate text-text-primary">{(story.authorName || 'Usuário').split(' ')[0]}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {activeStory !== null && stories[activeStory] && (
                <div className="fixed inset-0 z-[150] bg-black flex flex-col animate-fade-in">
                    <div className="absolute top-4 left-4 z-10 flex items-center gap-3">
                        <img src={stories[activeStory].authorAvatar || 'assets/default-avatar.svg'} onError={(e) => { e.target.src = 'assets/default-avatar.svg'; }} className="w-10 h-10 rounded-full border border-white" />
                        <span className="text-white font-bold">{stories[activeStory].authorName || 'Usuário'}</span>
                        <span className="text-white/70 text-xs">{getRelativeTime(stories[activeStory].timestamp || Date.now())}</span>
                    </div>
                    <button onClick={() => setActiveStory(null)} className="absolute top-4 right-4 z-10 text-white p-2"><div className="icon-x text-2xl"></div></button>
                    <div className="flex-1 flex items-center justify-center relative cursor-pointer">
                        <div className="absolute left-0 top-0 w-1/3 h-full z-10" onClick={() => setActiveStory(prev => prev > 0 ? prev - 1 : prev)}></div>
                        <div className="absolute right-0 top-0 w-1/3 h-full z-10" onClick={() => setActiveStory(prev => prev < stories.length - 1 ? prev + 1 : null)}></div>
                        {(() => {
                            const rawUrl = extractUrl(stories[activeStory].mediaUrl);
                            const url = cdnUrl(rawUrl);
                            return isVideoUrl(rawUrl)
                                ? <video src={url} autoPlay playsInline controls className="max-w-full max-h-full object-contain" onEnded={() => setActiveStory(prev => prev < stories.length - 1 ? prev + 1 : null)} />
                                : <img src={url} className="max-w-full max-h-full object-contain" />;
                        })()}
                        {stories[activeStory].content && (
                            <div className="absolute bottom-20 left-0 w-full text-center p-4">
                                <span className="bg-black/50 text-white px-4 py-2 rounded-xl text-lg font-bold backdrop-blur-sm inline-block">{stories[activeStory].content}</span>
                            </div>
                        )}
                    </div>
                </div>
            )}

            <div className="flex-1 overflow-y-auto p-4 md:p-6 pb-24 max-w-full md:max-w-4xl mx-auto w-full space-y-6" onScroll={desktopView === 'feed' ? handleScroll : undefined}>
                {desktopView === 'chat' ? (
                    <div className="bg-secondary rounded-2xl border border-border h-[80vh] overflow-hidden shadow-lg mt-4">
                        {window.ChatPage ? <window.ChatPage user={user} embedded={true} /> : <div className="text-center p-8 text-text-muted">Carregando mensagens...</div>}
                    </div>
                ) : (
                    <>
                        <div className={`p-4 ${cardBg} mb-6 max-w-2xl mx-auto`}>
                            <button onClick={() => window.location.href = 'upload.html'} className="w-full flex items-center gap-3 pl-4 pr-4 py-3 rounded-lg border border-border bg-primary text-text-muted hover:border-border-active transition-colors">
                                <div className="icon-plus text-accent text-lg"></div>
                                <span className="font-semibold text-text-primary">Criar nova publicação...</span>
                            </button>
                        </div>

                        {isLoadingPosts ? (
                            <div className="space-y-4">
                                {[1, 2, 3].map(i => (
                                    <div key={i} className={`${cardBg} animate-pulse`}>
                                        <div className="p-4 flex items-center gap-3">
                                            <div className="w-11 h-11 rounded-full bg-tertiary"></div>
                                            <div className="flex-1">
                                                <div className="h-4 bg-tertiary rounded w-32 mb-2"></div>
                                                <div className="h-3 bg-tertiary rounded w-20"></div>
                                            </div>
                                        </div>
                                        <div className="px-4 pb-4">
                                            <div className="h-4 bg-tertiary rounded w-full mb-2"></div>
                                            <div className="h-4 bg-tertiary rounded w-3/4"></div>
                                        </div>
                                        <div className="w-full h-64 bg-tertiary"></div>
                                    </div>
                                ))}
                            </div>
                        ) : filteredPosts.length === 0 ? (
                            <div className={`text-center mt-10 ${textMuted}`}>
                                <div className="icon-image text-4xl mb-3 opacity-50 mx-auto"></div>
                                <p>Nenhuma publicação encontrada.</p>
                            </div>
                        ) : (
                            filteredPosts.map(post => {
                                const isOwner = post.authorId === user.id;
                                const isDeleting = deletingPostId === post.id;
                                return (
                                    <div key={post.id} id={`post-${post.id}`} className={cardBg}>
                                        <div className="p-4 flex justify-between items-start">
                                            <div className="flex items-center gap-3">
                                                <div className="cursor-pointer" onClick={() => window.location.href = `channel.html?uid=${post.authorId}`}>
                                                    {post.authorAvatar ? (
                                                        <img src={post.authorAvatar} onError={(e) => { e.target.src = 'assets/default-avatar.svg'; }} alt="Avatar" className="w-11 h-11 rounded-full object-cover border border-border shadow-sm" />
                                                    ) : (
                                                        <div className="w-11 h-11 rounded-full bg-tertiary flex items-center justify-center text-primary font-bold border border-border shadow-sm">
                                                            {(post.authorName || '?').charAt(0).toUpperCase()}
                                                        </div>
                                                    )}
                                                </div>
                                                <div>
                                                    <div className="flex items-center gap-2">
                                                        <h3 className="font-bold text-base hover:text-accent cursor-pointer transition-colors" onClick={() => window.location.href = `channel.html?uid=${post.authorId}`}>
                                                            {post.authorName || 'Carregando...'}
                                                        </h3>
                                                        {post.authorId !== user.id && post.authorName && (
                                                            <button onClick={(e) => { e.stopPropagation(); toggleFollow(post.authorId); }} className={`text-xs px-2 py-0.5 rounded-md border font-semibold transition-colors ${following[post.authorId] ? 'border-border text-text-secondary' : 'border-accent text-accent hover:bg-accent hover:text-white'}`}>
                                                                {following[post.authorId] ? 'Seguindo' : 'Seguir'}
                                                            </button>
                                                        )}
                                                    </div>
                                                    <div className={`flex items-center gap-2 text-sm ${textMuted}`}>
                                                        <span>{getRelativeTime(post.timestamp)}</span>
                                                    </div>
                                                </div>
                                            </div>
                                            {isOwner && (
                                                <button onClick={() => handleDeletePost(post.id)} disabled={isDeleting} className={`p-2 rounded-full ${isDeleting ? 'opacity-50 cursor-wait' : 'text-text-secondary hover:text-danger hover:bg-danger/10'}`} title="Excluir post">
                                                    {isDeleting ? <div className="icon-loader animate-spin text-sm"></div> : <div className="icon-trash text-sm"></div>}
                                                </button>
                                            )}
                                        </div>

                                        {post.title && <div className="px-4 pt-2 pb-1 font-bold text-lg break-words text-primary">{post.title}</div>}
                                        {(post.content || post.textContent) && (
                                            <div className="px-4 pb-3 whitespace-pre-wrap text-[15px] break-words text-indigo-50 font-medium leading-relaxed">
                                                {renderTextWithHashtags(post.content || post.textContent)}
                                            </div>
                                        )}

                                        {(() => {
                                            if (post.type === 'poll') {
                                                if (window.PollViewer) return <window.PollViewer key={`poll-${post.id}`} post={post} user={user} />;
                                                return (
                                                    <div className="p-4 border-t border-b border-border bg-tertiary/30">
                                                        <div className="font-bold text-lg mb-3 text-primary">{post.question || 'Enquete'}</div>
                                                        <div className="space-y-2">
                                                            {(post.options || []).map((opt, idx) => (
                                                                <div key={idx} className="p-3 rounded-lg bg-secondary border border-border text-text-primary">{opt.text || opt}</div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                );
                                            }

                                            if (post.type === 'carousel' && post.mediaUrls && post.mediaUrls.length > 0) {
                                                return (
                                                    <div className="flex overflow-x-auto snap-x snap-mandatory hide-scrollbar">
                                                        {post.mediaUrls.map((mUrlRaw, idx) => {
                                                            const raw = extractUrl(mUrlRaw);
                                                            if (!raw) return null;
                                                            const url = cdnUrl(raw);
                                                            if (isVideoUrl(raw)) {
                                                                return (
                                                                    <div key={idx} className="w-full shrink-0 snap-center bg-black flex justify-center">
                                                                        <video src={url} playsInline controls className="w-full max-h-[500px] object-contain" />
                                                                    </div>
                                                                );
                                                            }
                                                            return <img key={idx} src={url} onError={(e) => { e.target.style.display = 'none'; }} className="w-full shrink-0 snap-center max-h-[500px] object-contain bg-black" loading="lazy" decoding="async" />;
                                                        })}
                                                    </div>
                                                );
                                            }

                                            const rawUrl = extractUrl(post.mediaUrl) || (post.mediaUrls && extractUrl(post.mediaUrls[0]));
                                            if (!rawUrl) return null;
                                            const url = cdnUrl(rawUrl);

                                            const ytId = getYoutubeId(rawUrl);
                                            if (ytId) {
                                                return (
                                                    <div className="relative w-full bg-black" style={{ aspectRatio: '16/9' }}>
                                                        <iframe src={`https://www.youtube.com/embed/${ytId}`} frameBorder="0" allowFullScreen className="w-full h-full absolute inset-0"></iframe>
                                                    </div>
                                                );
                                            }

                                            if (isVideoUrl(rawUrl)) return <InlineVideoPlayer post={post} />;

                                            return (
                                                <img src={url} onError={(e) => { e.target.style.display = 'none'; }} alt="Post" className="w-full max-h-[500px] object-contain bg-primary border-t border-b border-border" loading="lazy" decoding="async" />
                                            );
                                        })()}

                                        <div className={`px-4 py-3 border-t flex items-center justify-between border-border ${textMuted}`}>
                                            <div className="flex items-center gap-6">
                                                <button onClick={() => handleLike(post.id, post.hasLiked)} className={`flex items-center gap-2 transition-colors ${post.hasLiked ? 'text-danger' : 'hover:text-danger'}`}>
                                                    <div className={`icon-heart text-xl ${post.hasLiked ? 'fill-current' : ''}`}></div>
                                                    <span className="text-sm font-semibold">{post.likesCount || 0}</span>
                                                </button>
                                                <button onClick={() => setActiveCommentPost(activeCommentPost === post.id ? null : post.id)} className="flex items-center gap-2 hover:text-accent transition-colors">
                                                    <div className="icon-message-circle text-xl"></div>
                                                    <span className="text-sm font-semibold">{post.commentsCount || 0}</span>
                                                </button>
                                            </div>
                                            <button onClick={() => handleShare(post)} className="hover:text-accent transition-colors"><div className="icon-share-2 text-xl"></div></button>
                                        </div>

                                        {activeCommentPost === post.id && (
                                            <div className={`p-4 border-t bg-tertiary/30 border-border`}>
                                                <div className="flex gap-2 mb-4">
                                                    <input type="text" value={commentText} onChange={(e) => setCommentText(e.target.value)} placeholder="Escreva um comentário..." className="flex-1 rounded-lg px-4 py-2 text-sm outline-none border focus:border-accent bg-primary border-border text-primary transition-all" onKeyDown={(e) => e.key === 'Enter' && handleAddComment(post.id)} />
                                                    <button onClick={() => handleAddComment(post.id)} disabled={!commentText.trim()} className="bg-accent text-white px-4 py-2 rounded-lg font-semibold disabled:opacity-50 hover:bg-accent-hover transition-colors active:scale-95">Enviar</button>
                                                </div>
                                                <div className="space-y-4 max-h-64 overflow-y-auto pr-2 custom-scrollbar">
                                                    {post.comments && Object.keys(post.comments).map(cId => {
                                                        const comment = post.comments[cId];
                                                        return (
                                                            <div key={cId} className="flex gap-3 group">
                                                                {comment.authorAvatar ? (
                                                                    <img src={comment.authorAvatar} onError={(e) => { e.target.src = 'assets/default-avatar.svg'; }} className="w-8 h-8 rounded-full object-cover shadow-sm border border-border" />
                                                                ) : (
                                                                    <div className="w-8 h-8 rounded-full bg-tertiary flex items-center justify-center text-xs font-bold text-primary shrink-0 border border-border">
                                                                        {(comment.authorName || '?').charAt(0)}
                                                                    </div>
                                                                )}
                                                                <div className={`px-4 py-3 rounded-2xl rounded-tl-sm text-sm flex-1 bg-secondary border border-border shadow-sm`}>
                                                                    <div className="flex justify-between items-start mb-1">
                                                                        <span className="font-bold block text-sm text-primary">{comment.authorName || 'Usuário'}</span>
                                                                    </div>
                                                                    <span className="text-text-primary leading-relaxed">{comment.text}</span>
                                                                    <span className={`block text-[11px] mt-2 text-text-secondary`}>{getRelativeTime(comment.timestamp)}</span>
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                    {(!post.comments || Object.keys(post.comments).length === 0) && (
                                                        <p className={`text-center text-sm py-4 text-text-muted`}>Seja o primeiro a comentar.</p>
                                                    )}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                );
                            })
                        )}

                        {isLoadingMore && (
                            <div className="flex justify-center py-4"><div className="icon-loader animate-spin text-accent text-3xl"></div></div>
                        )}
                        {!hasMorePosts && posts.length > 0 && (
                            <div className="text-center py-4 text-text-muted text-sm">Você chegou ao fim do feed.</div>
                        )}
                    </>
                )}
            </div>

            {activeVideoFeed !== null && window.VideoFeed && (
                <window.VideoFeed
                    initialVideos={infiniteFeed}
                    initialActiveIndex={activeVideoFeed}
                    onClose={() => { setActiveVideoFeed(null); autoOpenedVideoRef.current = false; window.history.replaceState({}, '', window.location.pathname); }}
                    user={user}
                    following={following}
                    toggleFollow={toggleFollow}
                    handleLike={handleLike}
                    handleShare={handleShare}
                    quickShareUserId={quickShareUserId}
                    quickShareUserAvatar={quickShareUserAvatar}
                    handleQuickShare={async () => showToast("Indisponível")}
                    isQuickSharing={false}
                    quickShareSuccess={false}
                    renderTextWithHashtags={renderTextWithHashtags}
                    getRelativeTime={getRelativeTime}
                />
            )}

            {showTagViewer && currentTagId && window.TagViewer && (
                <window.TagViewer
                    tagId={currentTagId}
                    currentUser={user}
                    onClose={() => { setShowTagViewer(false); setCurrentTagId(null); window.history.replaceState({}, '', window.location.pathname); }}
                    onOpenVideo={openVideoFromTag}
                />
            )}

            {showShareModal && postToShare && (
                <div className="fixed inset-0 z-[120] bg-black/60 flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fade-in-up">
                    <div className={`${isDark ? 'bg-gray-800 text-white' : 'bg-white text-gray-800'} w-full max-w-sm rounded-t-2xl sm:rounded-2xl shadow-xl overflow-hidden max-h-[80vh] flex flex-col`}>
                        <div className={`p-4 border-b flex justify-between items-center ${isDark ? 'border-gray-700' : 'border-gray-100'}`}>
                            <h3 className="font-bold text-lg">Compartilhar com...</h3>
                            <button onClick={() => setShowShareModal(false)} className="text-gray-400 hover:text-gray-600"><div className="icon-x text-xl"></div></button>
                        </div>
                        <div className="p-4 flex gap-4 overflow-x-auto pb-4 border-b border-gray-100 dark:border-gray-700 scrollbar-hide">
                            <button onClick={handleCopyLink} className="flex flex-col items-center gap-2 min-w-[70px]">
                                <div className={`w-12 h-12 rounded-full flex items-center justify-center text-xl ${isDark ? 'bg-gray-700 text-gray-300' : 'bg-gray-100 text-gray-600'}`}><div className="icon-link"></div></div>
                                <span className="text-xs font-medium text-center">Copiar Link</span>
                            </button>
                            <button onClick={handleShareWhatsApp} className="flex flex-col items-center gap-2 min-w-[70px]">
                                <div className="w-12 h-12 rounded-full bg-green-500 text-white flex items-center justify-center text-xl"><div className="icon-message-circle"></div></div>
                                <span className="text-xs font-medium text-center">WhatsApp</span>
                            </button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-2">
                            <h4 className={`px-2 py-2 text-xs font-bold uppercase tracking-wider ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Seus Contatos</h4>
                            {contacts.length === 0 ? (
                                <div className="text-center py-8 text-gray-500 text-sm">Nenhum contato encontrado.</div>
                            ) : (
                                contacts.map(c => (
                                    <div key={c.id} className={`flex items-center justify-between p-3 rounded-xl transition ${isDark ? 'hover:bg-gray-700' : 'hover:bg-gray-50'}`}>
                                        <div className="flex items-center gap-3">
                                            {c.avatar ? (
                                                <img src={c.avatar} onError={(e) => { e.target.src = 'assets/default-avatar.svg'; }} className="w-10 h-10 rounded-full object-cover" />
                                            ) : (
                                                <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold ${c.type === 'group' ? 'bg-green-100 text-green-600' : 'bg-indigo-100 text-indigo-600'}`}>
                                                    {c.name.charAt(0).toUpperCase()}
                                                </div>
                                            )}
                                            <span className="font-bold text-sm truncate max-w-[150px]">{c.name}</span>
                                        </div>
                                        <button onClick={() => handleShareToChat(c.id, c.type)} disabled={sharingTo[c.id] || sharedSuccess[c.id]} className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all ${sharedSuccess[c.id] ? 'bg-green-500 text-white' : sharingTo[c.id] ? 'bg-gray-300 text-gray-500' : 'bg-indigo-600 text-white hover:bg-indigo-700'}`}>
                                            {sharingTo[c.id] ? <div className="icon-loader animate-spin text-sm"></div> : sharedSuccess[c.id] ? <div className="icon-check text-sm"></div> : 'Enviar'}
                                        </button>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            )}

            {pendingLink && (
                <div className="fixed inset-0 z-[300] bg-black/80 flex items-center justify-center p-4 animate-fade-in-up">
                    <div className="bg-gray-800 rounded-2xl p-6 max-w-sm w-full text-center border border-gray-700">
                        <div className="w-16 h-16 bg-indigo-600/20 rounded-full flex items-center justify-center mx-auto mb-4 text-indigo-500"><div className="icon-external-link text-3xl"></div></div>
                        <h3 className="text-xl font-bold text-white mb-2">Sair do Phantora?</h3>
                        <p className="text-gray-300 text-sm mb-6">Você tem certeza que deseja entrar nesse link?</p>
                        <p className="text-xs text-gray-500 mb-6 break-all bg-gray-900 p-2 rounded">{pendingLink.url}</p>
                        <div className="flex gap-3">
                            <button onClick={() => setPendingLink(null)} className="flex-1 py-3 bg-gray-700 text-white rounded-xl font-bold hover:bg-gray-600">Cancelar</button>
                            <button onClick={() => { window.open(pendingLink.url, '_blank'); setPendingLink(null); }} className="flex-1 py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700">Sim, entrar</button>
                        </div>
                    </div>
                </div>
            )}

            {showDiscovery && window.FriendSwipe && <window.FriendSwipe user={user} onClose={() => setShowDiscovery(false)} />}

            {showCamera && window.MediaCapture && (
                <window.MediaCapture onCapture={handleCameraCapture} onClose={() => setShowCamera(false)} />
            )}
        </div>
    );
}

window.SocialNetwork = SocialNetwork;