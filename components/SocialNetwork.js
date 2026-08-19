function SocialNetwork({ user, onClose }) {
    const [posts, setPosts] = React.useState([]);
    const [stories, setStories] = React.useState([]);
    
    // Pagination states
    const [lastPostKey, setLastPostKey] = React.useState(null);
    const [hasMorePosts, setHasMorePosts] = React.useState(true);
    const [isLoadingMore, setIsLoadingMore] = React.useState(false);
    
    const [lastVideoKey, setLastVideoKey] = React.useState(null);
    const [hasMoreVideos, setHasMoreVideos] = React.useState(true);
    const [isLoadingMoreVideos, setIsLoadingMoreVideos] = React.useState(false);
    const [activeStory, setActiveStory] = React.useState(null);
    const [editingPostId, setEditingPostId] = React.useState(null);
    const [activeCommentPost, setActiveCommentPost] = React.useState(null);
    const [commentText, setCommentText] = React.useState('');
    
    // Novas funcionalidades
    const [activeVideoFeed, setActiveVideoFeed] = React.useState(null); // null or starting index
    const [infiniteFeed, setInfiniteFeed] = React.useState([]); // array of videos for infinite scroll
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
    const [bufferingVideos, setBufferingVideos] = React.useState({});
    const [userInterests, setUserInterests] = React.useState({});
    const [pendingLink, setPendingLink] = React.useState(null);
    const watchTimers = React.useRef({});
    const viewStartTime = React.useRef(null);
    const likeSoundRef = React.useRef(new Audio('https://actions.google.com/sounds/v1/foley/pop_hollow.ogg'));

    // Upload states
    const [isUploading, setIsUploading] = React.useState(false);
    const [uploadProgress, setUploadProgress] = React.useState(0);
    const [uploadStatus, setUploadStatus] = React.useState('');
    
    // Camera state
    const [showCamera, setShowCamera] = React.useState(false);
    
    // Post Creator Modal
    const [showPostCreator, setShowPostCreator] = React.useState(false);
    const [desktopView, setDesktopView] = React.useState('feed');

    // Chat Component
    const [showChatComponent, setShowChatComponent] = React.useState(false);

    // Profile Modal
    const [selectedUser, setSelectedUser] = React.useState(null);
    
    // Settings and Friends
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

    React.useEffect(() => {
        const db = window.firebaseDB;
        if (!db) return;

        // Parse URL params for direct video opening and quick share
        const params = new URLSearchParams(window.location.search);
        const videoId = params.get('v');
        const fromId = params.get('from');
        
        if (fromId) {
            db.ref(`users/${fromId}`).once('value').then(snap => {
                const uData = snap.val();
                if (uData) {
                    setQuickShareUserId(fromId);
                    setQuickShareUserAvatar(uData.profilePicture || null);
                }
            });
        }

        // Carregar stories (últimas 24h)
        // Pedir localização
        if (navigator.geolocation && !localStorage.getItem('location_saved')) {
            navigator.geolocation.getCurrentPosition(async (pos) => {
                try {
                    const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${pos.coords.latitude}&lon=${pos.coords.longitude}`);
                    const data = await res.json();
                    if (data && data.address && data.address.city) {
                        await db.ref(`users/${user.id}`).update({ city: data.address.city });
                        localStorage.setItem('location_saved', 'true');
                    }
                } catch(e) {
                    console.log("Erro na localização:", e);
                }
            }, () => {
                console.log("Localização negada.");
            });
        }

        const fetchStories = async () => {
            const storiesSnap = await db.ref('posts').orderByChild('type').equalTo('story').once('value');
            if (storiesSnap.exists()) {
                const data = storiesSnap.val();
                const storyPosts = Object.keys(data).map(key => ({ id: key, ...data[key] }))
                    .filter(p => Date.now() - p.timestamp < 24 * 60 * 60 * 1000);
                setStories(storyPosts);
            }
        };
        fetchStories();

        const fetchUserData = async (uid) => {
            if (!uid) return { name: 'Usuário', avatar: 'https://via.placeholder.com/150', username: 'usuario' };
            if (window._userCache && window._userCache[uid]) return window._userCache[uid];
            
            try {
                const snap = await db.ref(`users/${uid}`).once('value');
                const uData = snap.val() || {};
                const result = {
                    name: uData.name || 'Usuário',
                    avatar: uData.profilePicture || uData.avatar || 'https://via.placeholder.com/150',
                    username: uData.username || (uData.name || 'usuario').toLowerCase().replace(/\s/g, ''),
                    isVerified: !!uData.isVerified
                };
                if (!window._userCache) window._userCache = {};
                window._userCache[uid] = result;
                return result;
            } catch(e) {
                return { name: 'Usuário', avatar: 'https://via.placeholder.com/150', username: 'usuario' };
            }
        };

        const processPostsWithUsers = async (data) => {
            const keys = Object.keys(data);
            const postsList = [];
            for (const key of keys) {
                const p = data[key];
                if (p.type === 'story') continue;
                
                const uData = await fetchUserData(p.authorId);
                
                // Process comments
                let processedComments = {};
                if (p.comments) {
                    for (const cId of Object.keys(p.comments)) {
                        const c = p.comments[cId];
                        const cUData = await fetchUserData(c.authorId);
                        processedComments[cId] = {
                            ...c,
                            authorName: cUData.name,
                            authorAvatar: cUData.avatar,
                            authorUsername: cUData.username
                        };
                    }
                }

                postsList.push({
                    id: key,
                    ...p,
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

        // Primeira carga de posts (30 itens)
        const loadInitialPosts = async () => {
            const snap = await db.ref('posts').orderByKey().limitToLast(30).once('value');
            if (snap.exists()) {
                const data = snap.val();
                const keys = Object.keys(data);
                const firstKey = keys[0];
                
                const postsList = await processPostsWithUsers(data);

                if (keys.length < 30) setHasMorePosts(false);
                setLastPostKey(firstKey);
                
                if (window.sortFeedByAlgorithm) {
                    const sorted = await window.sortFeedByAlgorithm(user.id, postsList);
                    setPosts(sorted);
                } else {
                    setPosts(postsList.reverse());
                }
            } else {
                setPosts([]);
                setHasMorePosts(false);
            }
        };
        loadInitialPosts();

        const followsRef = db.ref(`follows/${user.id}`);
        const followsListener = followsRef.on('value', (snap) => {
            setFollowing(snap.val() || {});
        });
        
        // Fetch Suggestions
        const fetchSuggestions = async () => {
            try {
                const usersSnap = await db.ref('users').limitToLast(20).once('value');
                if (usersSnap.exists()) {
                    const usersData = usersSnap.val();
                    const suggestions = [];
                    Object.keys(usersData).forEach(uid => {
                        if (uid !== user.id) {
                            suggestions.push({
                                id: uid,
                                ...usersData[uid]
                            });
                        }
                    });
                    // Shuffle and pick 5
                    setFriendSuggestions(suggestions.sort(() => 0.5 - Math.random()).slice(0, 5));
                }
            } catch (err) {
                console.warn("Erro ao carregar sugestões de amigos (verifique permissões):", err);
            }
        };
        fetchSuggestions();

        return () => {
            followsRef.off('value', followsListener);
        };
    }, [user.id]);

    // Função para carregar mais posts no feed principal (30 itens)
    const loadMorePosts = async () => {
        if (!hasMorePosts || isLoadingMore || !lastPostKey) return;
        setIsLoadingMore(true);
        
        try {
            const db = window.firebaseDB;
            const snap = await db.ref('posts').orderByKey().endBefore(lastPostKey).limitToLast(30).once('value');
            
            if (snap.exists()) {
                const data = snap.val();
                const keys = Object.keys(data);
                
                if (keys.length === 0) {
                    setHasMorePosts(false);
                    return;
                }
                
                const firstKey = keys[0];
                const newPostsList = keys.map(key => ({
                    id: key,
                    ...data[key],
                    likesCount: data[key].likes ? Object.keys(data[key].likes).length : 0,
                    hasLiked: data[key].likes ? !!data[key].likes[user.id] : false,
                    commentsCount: data[key].comments ? Object.keys(data[key].comments).length : 0,
                })).filter(p => p.type !== 'story');

                setLastPostKey(firstKey);
                
                let sortedNewPosts = newPostsList.reverse();
                if (window.sortFeedByAlgorithm) {
                    sortedNewPosts = await window.sortFeedByAlgorithm(user.id, newPostsList);
                }
                
                setPosts(prev => [...prev, ...sortedNewPosts]);
                
                if (keys.length < 30) setHasMorePosts(false);
            } else {
                setHasMorePosts(false);
            }
        } catch (error) {
            console.error("Erro ao carregar mais posts:", error);
        } finally {
            setIsLoadingMore(false);
        }
    };

    // Scroll listener para o feed principal
    const handleScroll = (e) => {
        const { scrollTop, clientHeight, scrollHeight } = e.target;
        if (scrollHeight - scrollTop <= clientHeight + 300) { // 300px antes do final
            loadMorePosts();
        }
    };

    // Handle opening direct video from URL once posts are loaded
    React.useEffect(() => {
        if (posts.length > 0 && activeVideoFeed === null) {
            const params = new URLSearchParams(window.location.search);
            const videoId = params.get('v');
            if (videoId) {
                const vPosts = posts.filter(p => p.type === 'video' || (p.mediaUrl && (p.mediaUrl.match(/\.(mp4|webm|ogg|mov)$/i) || p.mediaUrl.includes('file-'))));
                const idx = vPosts.findIndex(p => p.id === videoId);
                if (idx !== -1) {
                    setInfiniteFeed([...vPosts]);
                    setActiveVideoFeed(idx);
                } else {
                    // If not found in video posts, filter all posts to find it
                    const post = posts.find(p => p.id === videoId);
                    if (post) {
                        setSearchQuery('');
                        setFilterType('all');
                        // Optional: Scroll to post logic could go here
                        setTimeout(() => {
                            const postElement = document.getElementById(`post-${videoId}`);
                            if (postElement) postElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
                        }, 500);
                    }
                }
            }
        }
    }, [posts, activeVideoFeed]);

    // Handle Video Feed scroll logic
    const videoContainerRef = React.useRef(null);
    const videoPostsRef = React.useRef([]);

    React.useEffect(() => {
        if (activeVideoFeed !== null && videoContainerRef.current) {
            let observer = null;
            
            const initTimer = setTimeout(() => {
                const container = videoContainerRef.current;
                if (!container) return;
                
                const videoEl = container.children[activeVideoFeed];
                if (videoEl) {
                    container.scrollTo({ top: videoEl.offsetTop, behavior: 'instant' });
                }

                observer = new IntersectionObserver((entries) => {
                    entries.forEach(entry => {
                        const idx = Number(entry.target.dataset.index);
                        const video = entry.target.querySelector('video');
                        
                        if (entry.isIntersecting) {
                            setActiveVideoFeed(idx);
                            if (video && video.paused) {
                                video.play().catch(e => {
                                    console.warn("Autoplay bloqueado pelo navegador:", e);
                                    const container = video.closest('[data-index]');
                                    if (container) {
                                        const overlay = container.querySelector('.play-icon-overlay');
                                        if (overlay) overlay.style.opacity = '1';
                                    }
                                });
                            }
                            
                            // Análises: Registrar tempo do vídeo anterior
                            if (activeVideoFeed !== null && activeVideoFeed !== idx) {
                                const prevVideo = infiniteFeed[activeVideoFeed];
                                if (prevVideo && viewStartTime.current) {
                                    const timeSpent = Date.now() - viewStartTime.current;
                                    // Reportar view
                                    const db = window.firebaseDB;
                                    if (db && timeSpent > 1000) { // pelo menos 1 segundo
                                        try {
                                            db.ref(`video_analytics/${prevVideo.authorId}/${prevVideo.id}`).push({
                                                watchTimeMs: timeSpent,
                                                timestamp: Date.now(),
                                                viewerId: 'anonymous' // Anônimo como pedido
                                            }).catch(err => console.warn('Erro ao salvar analytics:', err.message));
                                        } catch(e) {
                                            console.warn('Erro ao tentar salvar analytics:', e);
                                        }
                                    }
                                }
                            }
                            
                            viewStartTime.current = Date.now();

                            // Infinite scroll logic para vídeos: carrega mais 10
                            if (idx >= infiniteFeed.length - 2 && !isLoadingMoreVideos && hasMoreVideos) {
                                setIsLoadingMoreVideos(true);
                                
                                // Buscar mais 10 vídeos no firebase se não tivermos em cache
                                const loadMoreVids = async () => {
                                    try {
                                        const db = window.firebaseDB;
                                        let query = db.ref('posts').orderByKey();
                                        if (lastVideoKey) {
                                            query = query.endBefore(lastVideoKey);
                                        }
                                        const snap = await query.limitToLast(30).once('value'); // busca mais pois precisamos filtrar por vídeo
                                        
                                        if (snap.exists()) {
                                            const data = snap.val();
                                            const keys = Object.keys(data);
                                            if (keys.length === 0) {
                                                setHasMoreVideos(false);
                                                return;
                                            }
                                            
                                            setLastVideoKey(keys[0]);
                                            
                                            const rawVids = keys.map(key => ({
                                                id: key, ...data[key],
                                                likesCount: data[key].likes ? Object.keys(data[key].likes).length : 0,
                                                hasLiked: data[key].likes ? !!data[key].likes[user.id] : false,
                                                commentsCount: data[key].comments ? Object.keys(data[key].comments).length : 0,
                                            })).filter(p => p.type === 'video' || (p.mediaUrl && (p.mediaUrl.match(/\.(mp4|webm|ogg|mov)$/i) || (p.mediaUrl.includes('file-') && p.mediaUrl.includes('-mp4')))));
                                            
                                            // Se não achou vídeos suficientes, pega do cache/algoritmo
                                            let finalVids = rawVids.slice(0, 10);
                                            if (finalVids.length < 10) {
                                                let recommended = window.AlgorithmManager ? window.AlgorithmManager.getRecommendedVideos(user.id, videoPostsRef.current) : videoPostsRef.current;
                                                if (recommended.length === 0) recommended = videoPostsRef.current;
                                                finalVids = [...finalVids, ...recommended.slice(0, 10 - finalVids.length)];
                                            }
                                            
                                            const appended = finalVids.map((v, i) => ({...v, uniqueKey: `${v.id}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}_${i}`}));
                                            
                                            setInfiniteFeed(prev => {
                                                const newFeed = [...prev, ...appended];
                                                const unique = [];
                                                const seen = new Set();
                                                for (const item of newFeed) {
                                                    if (!seen.has(item.uniqueKey)) {
                                                        seen.add(item.uniqueKey);
                                                        unique.push(item);
                                                    }
                                                }
                                                return unique;
                                            });
                                        } else {
                                            setHasMoreVideos(false);
                                            // Fallback para repetir os recomendados se a base acabou
                                            let recommended = window.AlgorithmManager ? window.AlgorithmManager.getRecommendedVideos(user.id, videoPostsRef.current) : videoPostsRef.current;
                                            if (recommended.length > 0) {
                                                const appended = recommended.slice(0, 10).map((v, i) => ({...v, uniqueKey: `${v.id}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}_${i}`}));
                                                setInfiniteFeed(prev => [...prev, ...appended]);
                                            }
                                        }
                                    } catch (err) {
                                        console.error(err);
                                    } finally {
                                        setIsLoadingMoreVideos(false);
                                    }
                                };
                                loadMoreVids();
                            }

                        } else {
                            if (video && !video.paused) {
                                video.pause();
                            }
                        }
                    });
                }, {
                    root: container,
                    threshold: 0.6
                });

                // Observe all current children
                const observeChildren = () => {
                    Array.from(container.children).forEach(child => {
                        observer.observe(child);
                    });
                };
                observeChildren();
                
                // Set up mutation observer to watch for new appended children
                const mutationObserver = new MutationObserver(() => observeChildren());
                mutationObserver.observe(container, { childList: true });

            }, 50);

            return () => {
                clearTimeout(initTimer);
                if (observer) observer.disconnect();
            };
        }
    }, [activeVideoFeed !== null, infiniteFeed.length]);

    // Update URL when active video changes
    React.useEffect(() => {
        if (posts.length === 0) return;
        if (activeVideoFeed !== null && infiniteFeed[activeVideoFeed]) {
            const currentVid = infiniteFeed[activeVideoFeed].id;
            const params = new URLSearchParams(window.location.search);
            const fromId = params.get('from');
            const newUrl = `${window.location.origin}${window.location.pathname}?v=${currentVid}${fromId ? `&from=${fromId}` : ''}`;
            window.history.replaceState({ path: newUrl }, '', newUrl);
        } else if (activeVideoFeed === null && window.location.search.includes('v=')) {
            const newUrl = `${window.location.origin}${window.location.pathname}`;
            window.history.replaceState({ path: newUrl }, '', newUrl);
        }
    }, [activeVideoFeed, posts.length]);

    const toggleFollow = async (targetId) => {
        const db = window.firebaseDB;
        if (!db) return;
        if (following[targetId]) {
            await db.ref(`follows/${user.id}/${targetId}`).remove();
            showToast("Você deixou de seguir este usuário.");
        } else {
            await db.ref(`follows/${user.id}/${targetId}`).set(true);
            showToast("Você agora está seguindo este usuário!");
        }
    };

    const getYoutubeId = (url) => {
        if (!url) return null;
        const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
        const match = url.match(regExp);
        return (match && match[2].length === 11) ? match[2] : null;
    };

    const comprimirImagem = (file) => {
        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = (event) => {
                const img = new Image();
                img.src = event.target.result;
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    let width = img.width;
                    let height = img.height;
                    const MAX_WIDTH = 1080;
                    if (width > MAX_WIDTH) {
                        height = Math.round((height * MAX_WIDTH) / width);
                        width = MAX_WIDTH;
                    }
                    canvas.width = width;
                    canvas.height = height;
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0, width, height);
                    const base64Comprimido = canvas.toDataURL('image/jpeg', 0.4); 
                    resolve({ base64: base64Comprimido, type: 'image/jpeg' });
                };
            };
        });
    };

    const comprimirVideo = async (file) => {
        try {
            const { FFmpeg } = await import('https://unpkg.com/@ffmpeg/ffmpeg@0.12.10/dist/esm/index.js');
            const { fetchFile } = await import('https://unpkg.com/@ffmpeg/util@0.12.1/dist/esm/index.js');
            
            const ffmpeg = new FFmpeg();
            await ffmpeg.load({
                coreURL: 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm/ffmpeg-core.js'
            });

            setUploadStatus('Processando e reduzindo tamanho do vídeo...');
            ffmpeg.on('progress', ({ progress }) => {
                setUploadProgress(Math.round(progress * 100));
            });

            const inputName = 'input.mp4';
            const outputName = 'output.mp4';
            await ffmpeg.writeFile(inputName, await fetchFile(file));
            await ffmpeg.exec([
                '-i', inputName,
                '-vf', 'scale=480:-2', 
                '-vcodec', 'libx264',
                '-crf', '32',          
                '-b:v', '400k',        
                '-b:a', '64k',         
                outputName
            ]);
            const data = await ffmpeg.readFile(outputName);
            const videoBlob = new Blob([data.buffer], { type: 'video/mp4' });
            
            return new Promise((resolve) => {
                const reader = new FileReader();
                reader.onloadend = () => {
                    resolve({ base64: reader.result, type: 'video/mp4' });
                };
                reader.readAsDataURL(videoBlob);
            });
        } catch (e) {
            console.error(e);
            setUploadStatus('Compressão falhou. Lendo original...');
            return null; // Fallback
        }
    };

    const processFile = async (file) => {
        if (!file) return;

        // Limite de 5MB (5 * 1024 * 1024 bytes)
        const MAX_SIZE = 5 * 1024 * 1024;
        if (file.size > MAX_SIZE) {
            showToast("O arquivo não pode ter mais que 5MB.");
            return;
        }

        setIsUploading(true);
        setUploadProgress(0);
        setUploadStatus('Iniciando processamento...');

        const FIREBASE_DB_URL = 'https://data-7dc04-default-rtdb.firebaseio.com';
        const PUTER_WORKER_URL = 'https://cdn-phantora-api.puter.work';
        
        const idAleatorio = (crypto.randomUUID ? crypto.randomUUID().replace(/-/g, '').substring(0, 12) : Math.random().toString(36).substring(2, 14));
        const timestamp = Date.now();
        const extOriginalLimpa = file.name.split('.').pop().toLowerCase().replace(/[\.\$\#\[\]\/]/g, '');
        
        let nomeAleatorio = '';
        let base64Data = '';
        let contentTypeFinal = '';
        let finalPostType = 'image';

        try {
            if (file.type.startsWith('image/')) {
                nomeAleatorio = `file-${timestamp}-${idAleatorio}-jpg`;
                setUploadStatus('Comprimindo imagem...');
                const resultado = await comprimirImagem(file);
                base64Data = resultado.base64;
                contentTypeFinal = resultado.type;
                finalPostType = 'image';
            } 
            else if (file.type.startsWith('video/')) {
                nomeAleatorio = `file-${timestamp}-${idAleatorio}-mp4`;
                finalPostType = 'video';
                const resultadoVideo = await comprimirVideo(file);
                
                if (resultadoVideo) {
                    base64Data = resultadoVideo.base64;
                    contentTypeFinal = resultadoVideo.type;
                } else {
                    setUploadStatus('Convertendo vídeo para formato suportado...');
                    base64Data = await new Promise((resolve) => {
                        const reader = new FileReader();
                        reader.onload = (ev) => resolve(ev.target.result);
                        reader.readAsDataURL(file);
                    });
                    contentTypeFinal = file.type;
                }
            } 
            else {
                nomeAleatorio = `file-${timestamp}-${idAleatorio}-${extOriginalLimpa}`;
                setUploadStatus('Lendo arquivo original...');
                base64Data = await new Promise((resolve) => {
                    const reader = new FileReader();
                    reader.onload = (ev) => resolve(ev.target.result);
                    reader.readAsDataURL(file);
                });
                contentTypeFinal = file.type || 'application/octet-stream';
            }

            setUploadStatus('Enviando para os servidores...');
            const urlDiretaFirebase = `${FIREBASE_DB_URL}/arquivos/${encodeURIComponent(nomeAleatorio)}.json`;

            const response = await fetch(urlDiretaFirebase, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    base64: base64Data,
                    contentType: contentTypeFinal
                })
            });

            if (response.ok) {
                setUploadStatus('Upload concluído!');
                const linkVisualizacao = `${PUTER_WORKER_URL}/cdn/${encodeURIComponent(nomeAleatorio)}`;
                setPostMediaUrl(linkVisualizacao);
                setPostType(finalPostType);
                showToast("Mídia anexada com sucesso!");
            } else {
                const errText = await response.text();
                setUploadStatus(`Erro no upload: ${errText}`);
                showToast("Erro ao fazer upload da mídia.");
            }
        } catch (error) {
            setUploadStatus(`Erro: ${error.message}`);
            showToast("Erro no processamento da mídia.");
        } finally {
            setTimeout(() => {
                setIsUploading(false);
                setUploadStatus('');
                setUploadProgress(0);
            }, 2000);
        }
    };

    const handleFileUpload = (e) => {
        processFile(e.target.files[0]);
    };

    const handleCameraCapture = (file, type) => {
        setShowCamera(false);
        processFile(file);
    };

    const deletarArquivoCDN = async (urlDaMidia) => {
        if (!urlDaMidia || !urlDaMidia.includes('cdn-phantora-api.puter.work')) return;
        const partes = urlDaMidia.split("/");
        const filename = partes[partes.length - 1];
        
        try {
            const response = await fetch("https://cdn-phantora-api.puter.work/manage", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    key: "phantora-secret-key-123",
                    action: "delete",
                    filename: filename
                })
            });
            const data = await response.json();
            return data;
        } catch (error) {
            console.error("Erro ao deletar do CDN:", error);
            return { success: false, error: error.message };
        }
    };

    const handleDeletePost = async (postId) => {
        if (window.confirm("Deseja realmente excluir esta publicação?")) {
            const post = posts.find(p => p.id === postId);
            if (post) {
                if (post.mediaUrl) await deletarArquivoCDN(post.mediaUrl);
                if (post.mediaUrls) {
                    for (const url of post.mediaUrls) await deletarArquivoCDN(url);
                }
                if (post.textCdnUrl) await deletarArquivoCDN(post.textCdnUrl);
                if (post.audioUrl) await deletarArquivoCDN(post.audioUrl);
                if (post.audioId) await window.firebaseDB.ref(`audios/${post.audioId}`).remove();
                if (post.pollCdnUrl) await deletarArquivoCDN(post.pollCdnUrl);
            }
            
            await window.firebaseDB.ref(`posts/${postId}`).remove();
            showToast("Post excluído!");
        }
    };

    const handleLike = async (postId, hasLiked, isInfiniteFeed = false, uniqueKey = null) => {
        const db = window.firebaseDB;
        if (!db) return;

        // Atualização otimista na interface do feed infinito
        if (isInfiniteFeed && uniqueKey) {
            setInfiniteFeed(prev => prev.map(p => {
                if (p.uniqueKey === uniqueKey) {
                    return {
                        ...p,
                        hasLiked: !hasLiked,
                        likesCount: !hasLiked ? p.likesCount + 1 : Math.max(0, p.likesCount - 1)
                    };
                }
                return p;
            }));

            if (!hasLiked) {
                try {
                    if (likeSoundRef.current) {
                        likeSoundRef.current.currentTime = 0;
                        likeSoundRef.current.volume = 0.6;
                        const playPromise = likeSoundRef.current.play();
                        if (playPromise !== undefined) {
                            playPromise.catch(e => console.log('Erro ao tocar som de like:', e));
                        }
                    }
                } catch (e) {}
            }
        }

        const likeRef = db.ref(`posts/${postId}/likes/${user.id}`);
        try {
            if (hasLiked) {
                await likeRef.remove();
            } else {
                await likeRef.set(true);
                
                const post = posts.find(p => p.id === postId);
                if (post && post.hashtags && window.updateAlgorithmProfile) {
                    window.updateAlgorithmProfile(user.id, 'like', post.hashtags, 2);
                }
            }
        } catch (error) {
            console.error("Erro ao curtir:", error);
            showToast("Erro ao processar a curtida.");
        }
    };

    const handleAddComment = async (postId) => {
        if (!commentText.trim()) return;
        const db = window.firebaseDB;
        
        try {
            await db.ref(`posts/${postId}/comments`).push({
                authorId: user.id,
                authorName: user.name,
                authorAvatar: user.avatar || '',
                text: commentText.trim(),
                timestamp: Date.now()
            });
            setCommentText('');
            showToast("Comentário adicionado!");
        } catch (e) {
            console.error(e);
            showToast("Erro ao comentar.");
        }
    };

    const handleDeleteComment = async (postId, commentId) => {
        if (window.confirm("Apagar este comentário?")) {
            await window.firebaseDB.ref(`posts/${postId}/comments/${commentId}`).remove();
            showToast("Comentário apagado.");
        }
    };

    const handleShareToChat = async (chatId, type) => {
        if (!postToShare || !window.firebaseDB) return;
        
        setSharingTo(prev => ({ ...prev, [chatId]: true }));
        
        try {
            const targetId = contacts.find(c => c.id === chatId)?.targetId || chatId;
            const refPath = type === 'group' ? `groups/${chatId}/messages` : `chats/${[user.id, targetId].sort().join('_')}/messages`;
            const shareUrl = `${window.location.origin}${window.location.pathname.replace('chat.html', 'index.html').replace('social.html', 'index.html')}?v=${postToShare.id}&from=${user.id}`;
            
            const msgData = {
                senderId: user.id,
                senderName: user.name,
                type: 'shared_video',
                postUrl: shareUrl,
                mediaUrl: postToShare.mediaUrl,
                postTitle: postToShare.content ? postToShare.content.substring(0, 50) + '...' : 'Vídeo',
                postAuthor: postToShare.authorName,
                timestamp: Date.now()
            };
            
            await window.firebaseDB.ref(refPath).push(msgData);
            
            // Update last message
            const chatUpdate = { lastMessage: `🎬 Vídeo compartilhado`, timestamp: Date.now() };
            if (type === 'group') {
                const groupSnap = await window.firebaseDB.ref(`groups/${chatId}/members`).once('value');
                const members = groupSnap.val() || {};
                for (const uid of Object.keys(members)) {
                    await window.firebaseDB.ref(`users/${uid}/chats/${chatId}`).update(chatUpdate);
                }
            } else {
                const targetId = contacts.find(c => c.id === chatId)?.targetId || chatId;
                await window.firebaseDB.ref(`users/${user.id}/chats/${chatId}`).update(chatUpdate);
                if (targetId !== user.id) {
                    await window.firebaseDB.ref(`users/${targetId}/chats/${chatId}`).update(chatUpdate);
                }
            }

            setSharedSuccess(prev => ({ ...prev, [chatId]: true }));
            setTimeout(() => {
                setSharedSuccess(prev => ({ ...prev, [chatId]: false }));
            }, 2000);
            
        } catch (e) {
            console.error(e);
            showToast("Erro ao compartilhar.");
        } finally {
            setSharingTo(prev => ({ ...prev, [chatId]: false }));
        }
    };

    const handleShare = (post) => {
        setPostToShare(post);
        setShowShareModal(true);
    };

    const handleQuickShare = async () => {
        if (!quickShareUserId || isQuickSharing || activeVideoFeed === null) return;
        const currentPost = videoPostsRef.current[activeVideoFeed];
        if (!currentPost) return;

        setIsQuickSharing(true);
        try {
            // Find chat id with that user
            const chatSnap = await window.firebaseDB.ref(`users/${user.id}/chats`).once('value');
            let targetChatId = null;
            if (chatSnap.exists()) {
                const chats = chatSnap.val();
                for (const [cId, cData] of Object.entries(chats)) {
                    if (cData.targetId === quickShareUserId || cId === quickShareUserId) {
                        targetChatId = cId;
                        break;
                    }
                }
            }
            if (!targetChatId) targetChatId = quickShareUserId; // fallback
            
            const refPath = `chats/${[user.id, quickShareUserId].sort().join('_')}/messages`;
            const shareUrl = `${window.location.origin}${window.location.pathname}?v=${currentPost.id}&from=${user.id}`;
            
            await window.firebaseDB.ref(refPath).push({
                senderId: user.id,
                senderName: user.name,
                type: 'shared_video',
                postUrl: shareUrl,
                mediaUrl: currentPost.mediaUrl,
                postTitle: currentPost.content ? currentPost.content.substring(0, 50) + '...' : 'Vídeo',
                postAuthor: currentPost.authorName,
                timestamp: Date.now()
            });

            await window.firebaseDB.ref(`users/${user.id}/chats/${targetChatId}`).update({ lastMessage: `🎬 Vídeo compartilhado`, timestamp: Date.now() });
            await window.firebaseDB.ref(`users/${quickShareUserId}/chats/${targetChatId}`).update({ lastMessage: `🎬 Vídeo compartilhado`, timestamp: Date.now() });

            setQuickShareSuccess(true);
            setTimeout(() => setQuickShareSuccess(false), 2500);
        } catch (e) {
            console.error(e);
        } finally {
            setIsQuickSharing(false);
        }
    };

    const handleExport = () => {
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(posts));
        const downloadAnchorNode = document.createElement('a');
        downloadAnchorNode.setAttribute("href",     dataStr);
        downloadAnchorNode.setAttribute("download", "phantora_posts_backup.json");
        document.body.appendChild(downloadAnchorNode);
        downloadAnchorNode.click();
        downloadAnchorNode.remove();
        showToast("Dados exportados!");
    };

    const handleImport = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = async (event) => {
            try {
                const importedPosts = JSON.parse(event.target.result);
                if (window.confirm("Isso adicionará os posts importados ao servidor. Continuar?")) {
                    const db = window.firebaseDB;
                    for (const post of importedPosts) {
                        const { id, likesCount, hasLiked, commentsCount, ...postData } = post;
                        await db.ref('posts').push(postData);
                    }
                    showToast("Dados importados com sucesso!");
                }
            } catch (err) {
                showToast("Erro ao ler o arquivo JSON.");
            }
        };
        reader.readAsText(file);
    };

    const getRelativeTime = (timestamp) => {
        const diffInSeconds = Math.floor((now - timestamp) / 1000);
        if (diffInSeconds < 60) return "agora mesmo";
        const diffInMinutes = Math.floor(diffInSeconds / 60);
        if (diffInMinutes < 60) return `há ${diffInMinutes} min`;
        const diffInHours = Math.floor(diffInMinutes / 60);
        if (diffInHours < 24) return `há ${diffInHours} h`;
        const diffInDays = Math.floor(diffInHours / 24);
        return `há ${diffInDays} d`;
    };



    const renderTextWithHashtags = (text) => {
        if (!text) return null;
        const words = text.split(/(\s+)/);
        return words.map((word, i) => {
            if (word.startsWith('#') && word.length > 1) {
                return <span key={i} onClick={(e) => { e.stopPropagation(); setActiveHashtag(word); setSearchQuery(word); setFilterType('all'); setActiveVideoFeed(null); }} className="text-purple-400 font-bold cursor-pointer hover:underline z-10 relative drop-shadow-sm">{word}</span>;
            }
            if (word.startsWith('@') && word.length > 1) {
                const username = word.substring(1);
                return <span key={i} onClick={async (e) => { 
                    e.stopPropagation(); 
                    const db = window.firebaseDB;
                    let targetId = username; 
                    let aliasId = `c_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
                    await db.ref(`chat_aliases/${aliasId}`).set({ realId: targetId });
                    window.location.href = `chat.html?c=${aliasId}`; 
                }} className="text-pink-400 font-bold cursor-pointer hover:underline z-10 relative drop-shadow-sm">{word}</span>;
            }
            if (word.match(/^https?:\/\/[^\s]+$/i)) {
                return <a key={i} href={word} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="text-blue-400 font-bold hover:underline z-10 relative break-all drop-shadow-sm">{word}</a>;
            }
            return word;
        });
    };

    const allItems = [...posts].sort((a, b) => b.timestamp - a.timestamp);

    const filteredPosts = allItems.filter(post => {
        const searchLower = searchQuery.toLowerCase();
        const matchesSearch = post.content?.toLowerCase().includes(searchLower) || 
                              post.authorName?.toLowerCase().includes(searchLower) ||
                              (post.hashtags && post.hashtags.some(h => h.toLowerCase().includes(searchLower)));
        const matchesType = filterType === 'all' || post.type === filterType || (filterType === 'image' && post.type === 'video'); // Agrupando mídias
        return matchesSearch && matchesType;
    });

    const videoPosts = filteredPosts.filter(p => p.type === 'video' || (p.mediaUrl && (p.mediaUrl.match(/\.(mp4|webm|ogg|mov)$/i) || (p.mediaUrl.includes('file-') && p.mediaUrl.includes('-mp4')))));
    videoPostsRef.current = videoPosts;

    const isDark = theme === 'dark';
    const bgClass = 'bg-primary text-primary';
    const cardBg = 'bg-secondary border border-border rounded-xl shadow-card hover:-translate-y-0.5 hover:shadow-lg transition-all duration-200';
    const textMuted = 'text-text-secondary';
    const headerBg = 'bg-secondary/80 backdrop-blur-lg border-b border-border';

    return (
        <div className={`fixed inset-0 ${bgClass} font-sans z-50 flex flex-col animate-fade-in transition-colors duration-300`} data-name="social-network" data-file="components/SocialNetwork.js">
            {toast && (
                <div className="fixed top-20 left-1/2 transform -translate-x-1/2 z-[70] bg-tertiary text-primary px-4 py-2 rounded-lg shadow-lg text-sm flex items-center gap-2 animate-fade-in-up border border-border">
                    <div className="icon-info text-accent"></div>
                    {toast}
                </div>
            )}

            <header className={`${headerBg} px-4 py-3 flex items-center justify-between sticky top-0 z-10 transition-colors`}>
                <div className="flex items-center gap-3">
                    <img 
                        src={user.avatar || 'https://via.placeholder.com/150'} 
                        alt="Avatar" 
                        className="w-10 h-10 rounded-full object-cover border-2 border-accent cursor-pointer hover:opacity-80 transition-opacity"
                        onClick={() => window.location.href = `canal.html?uid=${user.id}`}
                    />
                    <h1 className={`text-lg font-bold text-primary hidden sm:block`}>
                        Phantora
                    </h1>
                </div>
                
                <div className="flex items-center gap-1 sm:gap-2">
                    <button onClick={() => setShowDiscovery(true)} className={`p-2 rounded-full text-text-secondary hover:bg-tertiary hover:text-accent transition-colors`} title="Descobrir Pessoas">
                        <div className="icon-users text-xl"></div>
                    </button>
                    <button onClick={() => window.location.href = 'search.html'} className={`p-2 hidden sm:block rounded-full text-text-secondary hover:bg-tertiary hover:text-text-primary transition-colors`} title="Pesquisar">
                        <div className="icon-search text-xl"></div>
                    </button>
                    <button onClick={() => setShowSettings(true)} className={`p-2 rounded-full text-text-secondary hover:bg-tertiary hover:text-text-primary transition-colors`} title="Configurações">
                        <div className="icon-settings text-xl"></div>
                    </button>
                    <button onClick={onClose} className={`p-2 rounded-full text-text-secondary hover:bg-tertiary hover:text-danger transition-colors`} title="Sair">
                        <div className="icon-log-out text-xl"></div>
                    </button>
                </div>
            </header>

            {/* Navigation Menus */}
            {/* Mobile Bottom Navigation */}
            <div className="md:hidden fixed bottom-4 left-1/2 transform -translate-x-1/2 z-[40] bg-secondary/90 backdrop-blur-md border border-border rounded-full px-6 py-3 flex items-center gap-8 shadow-lg">
                <button onClick={() => { setDesktopView('feed'); setActiveVideoFeed(null); window.scrollTo(0,0); }} className={`flex flex-col items-center gap-1 transition-colors active:scale-95 ${desktopView === 'feed' ? 'text-accent' : 'text-text-secondary hover:text-text-primary'}`}>
                    <div className="icon-house text-2xl"></div>
                </button>
                
                <button onClick={() => setDesktopView('chat')} className={`flex flex-col items-center gap-1 transition-colors active:scale-95 ${desktopView === 'chat' ? 'text-accent' : 'text-text-secondary hover:text-text-primary'}`}>
                    <div className="icon-message-circle text-2xl"></div>
                </button>

                <button onClick={() => {
                    if (videoPostsRef.current.length > 0) {
                        const initialList = videoPostsRef.current.map(v => ({...v, uniqueKey: v.id}));
                        setInfiniteFeed(initialList);
                        let startIdx = 0;
                        setActiveVideoFeed(startIdx);
                    } else {
                        showToast("Nenhum vídeo disponível no momento.");
                    }
                }} className="flex flex-col items-center gap-1 text-text-secondary hover:text-text-primary transition-colors active:scale-95">
                    <div className="icon-circle-play text-2xl"></div>
                </button>
            </div>

            {/* Desktop Right Sidebar */}
            <div className="hidden md:flex flex-col fixed right-0 top-[60px] bottom-0 w-20 bg-secondary/90 backdrop-blur-lg border-l border-border z-[40] py-6 items-center gap-8 shadow-lg">
                <button onClick={() => { setDesktopView('feed'); setActiveVideoFeed(null); window.scrollTo(0,0); }} className={`p-3 rounded-xl transition-all ${desktopView === 'feed' ? 'bg-accent/20 text-accent' : 'text-text-secondary hover:bg-tertiary hover:text-text-primary'}`} title="Início">
                    <div className="icon-house text-2xl"></div>
                </button>
                
                <button onClick={() => setDesktopView('chat')} className={`p-3 rounded-xl transition-all ${desktopView === 'chat' ? 'bg-accent/20 text-accent' : 'text-text-secondary hover:bg-tertiary hover:text-text-primary'}`} title="Mensagens">
                    <div className="icon-message-circle text-2xl"></div>
                </button>

                <button onClick={() => {
                    if (videoPostsRef.current.length > 0) {
                        setDesktopView('feed');
                        const initialList = videoPostsRef.current.map(v => ({...v, uniqueKey: v.id}));
                        setInfiniteFeed(initialList);
                        setActiveVideoFeed(0);
                    } else {
                        showToast("Nenhum vídeo disponível no momento.");
                    }
                }} className="p-3 rounded-xl text-text-secondary hover:bg-tertiary hover:text-text-primary transition-all" title="Vídeos">
                    <div className="icon-circle-play text-2xl"></div>
                </button>

                <div className="mt-auto">
                    <button onClick={() => setShowPostCreator(true)} className="p-3 rounded-xl bg-accent text-white hover:bg-accent-hover transition-all shadow-accent" title="Novo Post">
                        <div className="icon-plus text-2xl"></div>
                    </button>
                </div>
            </div>
            
            {showSettings && window.SettingsMenu && (
                <window.SettingsMenu isOpen={true} onClose={() => setShowSettings(false)} />
            )}

            {/* Stories Section */}
            {stories.length > 0 && (
                <div className="w-full max-w-2xl mx-auto p-4 md:px-6 pt-4 pb-0">
                    <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-hide">
                        {stories.map((story, i) => (
                            <div key={story.id} onClick={() => setActiveStory(i)} className="flex flex-col items-center gap-1 cursor-pointer group flex-shrink-0">
                                <div className="w-16 h-16 rounded-full p-[2px] bg-gradient-to-tr from-yellow-400 to-indigo-600">
                                    <img src={story.authorAvatar || 'https://via.placeholder.com/150'} className="w-full h-full rounded-full object-cover border-2 border-[var(--dark-surface)] group-hover:scale-105 transition-transform" />
                                </div>
                                <span className={`text-xs font-medium max-w-[64px] truncate text-text-primary`}>{(story.authorName || 'Usuário').split(' ')[0]}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Story Viewer Modal */}
            {activeStory !== null && stories[activeStory] && (
                <div className="fixed inset-0 z-[150] bg-black flex flex-col animate-fade-in">
                    <div className="absolute top-0 left-0 w-full h-1 flex gap-1 z-10 px-1 pt-1">
                        {stories.map((s, idx) => (
                            <div key={s.id} className="flex-1 h-1 bg-white/30 rounded-full overflow-hidden">
                                <div className={`h-full bg-white transition-all ${idx < activeStory ? 'w-full' : idx === activeStory ? 'w-full animate-[progress_5s_linear]' : 'w-0'}`} style={{ animationDuration: '5s' }}></div>
                            </div>
                        ))}
                    </div>
                    <div className="absolute top-4 left-4 z-10 flex items-center gap-3">
                        <img src={stories[activeStory].authorAvatar || 'https://via.placeholder.com/150'} className="w-10 h-10 rounded-full border border-white" />
                        <span className="text-white font-bold">{stories[activeStory].authorName || 'Usuário'}</span>
                        <span className="text-white/70 text-xs">{getRelativeTime(stories[activeStory].timestamp || Date.now())}</span>
                    </div>
                    <button onClick={() => setActiveStory(null)} className="absolute top-4 right-4 z-10 text-white p-2">
                        <div className="icon-x text-2xl"></div>
                    </button>
                    
                    <div className="flex-1 flex items-center justify-center relative cursor-pointer">
                        <div className="absolute left-0 top-0 w-1/3 h-full z-10" onClick={(e) => { e.stopPropagation(); setActiveStory(prev => prev > 0 ? prev - 1 : prev); }}></div>
                        <div className="absolute right-0 top-0 w-1/3 h-full z-10" onClick={(e) => { e.stopPropagation(); setActiveStory(prev => prev < stories.length - 1 ? prev + 1 : null); }}></div>
                        
                        {(stories[activeStory].mediaUrl?.match(/\.(mp4|webm|ogg|mov)$/i) || stories[activeStory].type === 'video') ? (
                            <video src={stories[activeStory].mediaUrl} autoPlay playsInline className="max-w-full max-h-full object-contain" onEnded={() => setActiveStory(prev => prev < stories.length - 1 ? prev + 1 : null)} />
                        ) : (
                            <img src={stories[activeStory].mediaUrl} className="max-w-full max-h-full object-contain" />
                        )}
                        {stories[activeStory].content && (
                            <div className="absolute bottom-20 left-0 w-full text-center p-4">
                                <span className="bg-black/50 text-white px-4 py-2 rounded-xl text-lg font-bold backdrop-blur-sm inline-block">{stories[activeStory].content}</span>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Profile Modal */}
            {selectedUser && (
                <div className="fixed inset-0 z-[80] bg-black/50 flex items-center justify-center p-4 animate-fade-in-up">
                    <div className={`${isDark ? 'bg-gray-800 text-white' : 'bg-white text-gray-800'} w-full max-w-sm rounded-2xl shadow-xl overflow-hidden`}>
                        <div className="p-6 text-center relative">
                            <button onClick={() => setSelectedUser(null)} className="absolute top-4 right-4 p-1 text-gray-400 hover:text-gray-600 rounded-full">
                                <div className="icon-x text-xl"></div>
                            </button>
                            <img src={selectedUser.avatar || 'https://via.placeholder.com/150'} alt="Profile" className="w-24 h-24 rounded-full object-cover mx-auto border-4 border-indigo-100 mb-4" />
                            <h3 className="text-xl font-bold">{selectedUser.name || 'Usuário'}</h3>
                            <p className={`text-sm ${textMuted} mb-6`}>@{(selectedUser.name || 'usuario').toLowerCase().replace(/\s/g, '')}</p>
                            

                        </div>
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
                        {/* Search Redirect Button */}
                        <div className={`p-4 ${cardBg} mb-6 max-w-2xl mx-auto`}>
                    <button onClick={() => setShowPostCreator(true)} className="w-full flex items-center gap-3 pl-4 pr-4 py-3 rounded-lg border border-border bg-primary text-text-muted hover:border-border-active transition-colors">
                        <div className="icon-plus text-accent text-lg"></div>
                        <span className="font-semibold text-text-primary">Criar nova publicação...</span>
                    </button>
                </div>

                {friendSuggestions.length > 0 && (
                    <div className="mb-6">
                        <h3 className="text-sm font-bold text-text-secondary mb-3 flex items-center gap-2">
                            <div className="icon-user-plus"></div> 
                            Sugestões de Amigos
                        </h3>
                        <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-hide">
                            {friendSuggestions.map(s => (
                                <div key={s.id} className={`${cardBg} p-4 flex flex-col items-center min-w-[140px] flex-shrink-0`}>
                                    <img src={s.profilePicture || 'https://via.placeholder.com/150'} className="w-16 h-16 rounded-full object-cover mb-2 border border-border" />
                                    <span className="font-bold text-sm text-center truncate w-full">{s.name || s.username || 'Usuário'}</span>
                                    <span className="text-xs text-text-muted mb-3">@{s.username || (s.name || 'usuario').toLowerCase().replace(/\s/g, '')}</span>
                                    <button 
                                        onClick={() => toggleFollow(s.id)}
                                        className={`w-full py-1.5 rounded-lg text-xs font-bold transition-colors ${following[s.id] ? 'bg-tertiary text-text-primary' : 'bg-accent text-white hover:bg-accent-hover'}`}
                                    >
                                        {following[s.id] ? 'Seguindo' : 'Seguir'}
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {filteredPosts.length === 0 ? (
                    <div className={`text-center mt-10 ${textMuted}`}>
                        <div className="icon-image text-4xl mb-3 opacity-50 mx-auto"></div>
                        <p>Nenhuma publicação encontrada.</p>
                    </div>
                ) : (
                    filteredPosts.map(post => (
                        <div key={post.id} id={`post-${post.id}`} className={cardBg}>
                            <div className="p-4 flex justify-between items-start">
                                <div className="flex items-center gap-3">
                                    <div 
                                        className="cursor-pointer"
                                        onClick={() => window.location.href = `channel.html?uid=${post.authorId}`}
                                    >
                                        {post.authorAvatar ? (
                                            <img src={post.authorAvatar} alt="Avatar" className="w-11 h-11 rounded-full object-cover border border-border shadow-sm" />
                                        ) : (
                                            <div className="w-11 h-11 rounded-full bg-tertiary flex items-center justify-center text-primary font-bold border border-border shadow-sm">
                                                {(post.authorName || '?').charAt(0).toUpperCase()}
                                            </div>
                                        )}
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <h3 
                                                className="font-bold text-base hover:text-accent cursor-pointer transition-colors"
                                                onClick={() => window.location.href = `channel.html?uid=${post.authorId}`}
                                            >
                                                {post.authorName || 'Usuário'}
                                            </h3>
                                            {post.authorId !== user.id && (
                                                <button 
                                                    onClick={() => toggleFollow(post.authorId)}
                                                    className={`text-xs px-2 py-0.5 rounded-md border font-semibold transition-colors ${following[post.authorId] ? 'border-border text-text-secondary hover:text-danger hover:border-danger hover:bg-danger/10' : 'border-accent text-accent hover:bg-accent hover:text-white'}`}
                                                >
                                                    {following[post.authorId] ? 'Seguindo' : 'Seguir'}
                                                </button>
                                            )}
                                        </div>
                                        <div className={`flex items-center gap-2 text-sm ${textMuted}`}>
                                            <span>{getRelativeTime(post.timestamp)}</span>
                                            {post.editedAt && <span>(editado)</span>}
                                        </div>
                                    </div>
                                </div>
                                
                                {post.authorId === user.id && (
                                    <div className="flex gap-2">
                                        <button onClick={() => handleDeletePost(post.id)} className={`${textMuted} hover:text-danger p-1 transition-colors`}>
                                            <div className="icon-trash text-sm"></div>
                                        </button>
                                    </div>
                                )}
                            </div>
                            
                            {post.title && (
                                <div className="px-4 pt-2 pb-1 font-bold text-lg break-words text-primary">
                                    {post.title}
                                </div>
                            )}
                            {(post.content || post.textContent) && (
                                <div className="px-4 pb-3 whitespace-pre-wrap text-[15px] break-words text-indigo-50 font-medium leading-relaxed">
                                    {renderTextWithHashtags(post.content || post.textContent)}
                                </div>
                            )}

                            {(() => {
                                if (post.type === 'poll') {
                                    if (post.pollData || post.question || post.pollCdnUrl) {
                                        return <PollViewer key={`poll-${post.id}`} post={post} user={user} />;
                                    }
                                    return null;
                                }
                                
                                if (post.type === 'carousel' && post.mediaUrls) {
                                    return (
                                        <div className="flex overflow-x-auto snap-x snap-mandatory hide-scrollbar">
                                            {post.mediaUrls.map((mUrl, idx) => {
                                                const isVid = mUrl.match(/\.(mp4|webm|ogg|mov)$/i) || mUrl.includes('video') || mUrl.includes('mp4');
                                                if (isVid) {
                                                    return (
                                                        <div key={idx} className="w-full shrink-0 snap-center relative bg-black flex justify-center items-center group cursor-pointer" onClick={(e) => {
                                                            const vid = e.currentTarget.querySelector('video');
                                                            if (vid) {
                                                                if (vid.paused) vid.play();
                                                                else vid.pause();
                                                            }
                                                        }}>
                                                            <video src={mUrl} className="w-full max-h-[500px] object-contain opacity-90 group-hover:opacity-100 transition" playsInline loop></video>
                                                            <div className="absolute inset-0 flex items-center justify-center pointer-events-none group-hover:opacity-0 transition-opacity">
                                                                <div className="w-16 h-16 bg-black/50 rounded-full flex items-center justify-center backdrop-blur-sm">
                                                                    <div className="icon-play text-white text-3xl ml-1"></div>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    );
                                                }
                                                return <img key={idx} src={mUrl} className="w-full shrink-0 snap-center max-h-[500px] object-contain bg-black" loading="lazy" />;
                                            })}
                                        </div>
                                    );
                                }

                                const url = post.mediaUrl || (post.mediaUrls && post.mediaUrls[0]);
                                if (!url) return null;
                                
                                const ytId = getYoutubeId(url);
                                if (ytId) {
                                    return (
                                        <div className="relative w-full bg-black flex justify-center items-center overflow-hidden" style={{ aspectRatio: '16/9' }}>
                                            <iframe 
                                                src={`https://www.youtube.com/embed/${ytId}`} 
                                                title="YouTube video player" 
                                                frameBorder="0" 
                                                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
                                                allowFullScreen
                                                className="w-full h-full absolute inset-0"
                                            ></iframe>
                                            <div className="absolute top-2 right-2 z-10 p-1 bg-white/90 backdrop-blur-sm rounded-lg shadow-lg">
                                                <img src="https://app.trickle.so/storage/public/images/usr_21422c7c08000001/b834fb47-4387-40bb-b8aa-c983117d9d5a.webp" alt="YouTube" className="w-6 h-6 object-contain pointer-events-none" />
                                            </div>
                                        </div>
                                    );
                                }
                                
                                const isVideo = post.type === 'video' || url.match(/\.(mp4|webm|ogg|mov)$/i) || (url.includes('file-') && url.includes('-mp4'));
                                
                                if (isVideo) {
                                    return (
                                        <div className="w-full bg-black flex justify-center items-center relative cursor-pointer group" onClick={() => {
                                            const idx = videoPosts.findIndex(vp => vp.id === post.id);
                                            const startIdx = idx !== -1 ? idx : 0;
                                            
                                            // Ensure infinite feed starts with our initial list
                                            const initialList = videoPosts.map(v => ({...v, uniqueKey: v.id}));
                                            setInfiniteFeed(initialList);
                                            setActiveVideoFeed(startIdx);
                                        }}>
                                            <video src={url} playsInline preload="metadata" className="w-full max-h-96 object-cover opacity-90 group-hover:opacity-100 transition"></video>
                                            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                                <div className="w-16 h-16 bg-black/50 rounded-full flex items-center justify-center backdrop-blur-sm group-hover:scale-110 transition-transform">
                                                    <div className="icon-play text-white text-3xl ml-1"></div>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                }
                                
                                if (post.type === 'image' || url) {
                                    return <img src={url} alt="Post media" className={`w-full max-h-[500px] object-contain bg-primary border-t border-b border-border`} loading="lazy" />;
                                }
                                
                                if (post.type === 'poll' && post.pollCdnUrl) {
                                    return <PollViewer key={`poll-${post.id}`} post={post} user={user} />;
                                }

                                return null;
                            })()}

                            <div className={`px-4 py-3 border-t flex items-center justify-between border-border ${textMuted}`}>
                                <div className="flex items-center gap-6">
                                        <button 
                                            onClick={() => handleLike(post.id, post.hasLiked)} 
                                            className={`flex items-center gap-2 transition-colors ${post.hasLiked ? 'text-danger' : 'hover:text-danger'}`}
                                        >
                                            <div className={`icon-heart text-xl ${post.hasLiked ? 'fill-current' : ''}`}></div>
                                            <span className="text-sm font-semibold">{post.likesCount}</span>
                                        </button>
                                        
                                        <button 
                                            onClick={() => setActiveCommentPost(activeCommentPost === post.id ? null : post.id)}
                                            className="flex items-center gap-2 hover:text-accent transition-colors"
                                        >
                                            <div className="icon-message-circle text-xl"></div>
                                            <span className="text-sm font-semibold">{post.commentsCount}</span>
                                        </button>
                                    </div>
                                    
                                <button onClick={() => handleShare(post)} className="hover:text-accent transition-colors">
                                    <div className="icon-share-2 text-xl"></div>
                                </button>
                            </div>

                            {/* Comentários */}

                            {activeCommentPost === post.id && (
                                <div className={`p-4 border-t bg-tertiary/30 border-border`}>
                                    <div className="flex gap-2 mb-4">
                                        <input 
                                            type="text" 
                                            value={commentText}
                                            onChange={(e) => setCommentText(e.target.value)}
                                            placeholder="Escreva um comentário..."
                                            className={`flex-1 rounded-lg px-4 py-2 text-sm outline-none border focus:border-accent focus:shadow-[0_0_0_3px_rgba(124,58,237,0.15)] bg-primary border-border text-primary transition-all`}
                                            onKeyDown={(e) => e.key === 'Enter' && handleAddComment(post.id)}
                                        />
                                        <button 
                                            onClick={() => handleAddComment(post.id)}
                                            disabled={!commentText.trim()}
                                            className="bg-accent text-white px-4 py-2 rounded-lg font-semibold disabled:opacity-50 hover:bg-accent-hover transition-colors active:scale-95"
                                        >
                                            Enviar
                                        </button>
                                    </div>
                                    
                                    <div className="space-y-4 max-h-64 overflow-y-auto pr-2 custom-scrollbar">
                                        {post.comments && Object.keys(post.comments).map(cId => {
                                            const comment = post.comments[cId];
                                            return (
                                                <div key={cId} className="flex gap-3 group">
                                                    {comment.authorAvatar ? (
                                                        <img src={comment.authorAvatar} className="w-8 h-8 rounded-full object-cover shadow-sm border border-border" />
                                                    ) : (
                                                        <div className="w-8 h-8 rounded-full bg-tertiary flex items-center justify-center text-xs font-bold text-primary shrink-0 border border-border">
                                                            {(comment.authorName || '?').charAt(0)}
                                                        </div>
                                                    )}
                                                    <div className={`px-4 py-3 rounded-2xl rounded-tl-sm text-sm flex-1 bg-secondary border border-border shadow-sm`}>
                                                        <div className="flex justify-between items-start mb-1">
                                                            <span className="font-bold block text-sm text-primary">{comment.authorName || 'Usuário'}</span>
                                                            {(comment.authorId === user.id || post.authorId === user.id) && (
                                                                <button onClick={() => handleDeleteComment(post.id, cId)} className="opacity-0 group-hover:opacity-100 text-danger hover:text-red-400 text-xs transition-opacity">
                                                                    <div className="icon-trash"></div>
                                                                </button>
                                                            )}
                                                        </div>
                                                        <span className="text-text-primary leading-relaxed">{comment.text}</span>
                                                        <span className={`block text-[11px] mt-2 text-text-secondary`}>{getRelativeTime(comment.timestamp)}</span>
                                                    </div>
                                                </div>
                                            )
                                        })}
                                        {(!post.comments || Object.keys(post.comments).length === 0) && (
                                            <p className={`text-center text-sm py-4 text-text-muted`}>Seja o primeiro a comentar.</p>
                                        )}
                                    </div>
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
                    <div className="text-center py-4 text-text-muted text-sm">
                        Você chegou ao fim do feed.
                    </div>
                )}
                    </>
                )}
            </div>

            {/* Fullscreen TikTok Style Video Feed */}
            {activeVideoFeed !== null && window.VideoFeed && (
                <window.VideoFeed
                    initialVideos={infiniteFeed}
                    initialActiveIndex={activeVideoFeed}
                    onClose={() => {
                        setActiveVideoFeed(null);
                        const newUrl = `${window.location.origin}${window.location.pathname}`;
                        window.history.replaceState({ path: newUrl }, '', newUrl);
                    }}
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
                <div className="fixed inset-0 z-[120] bg-black/60 flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fade-in-up">
                    <div className={`${isDark ? 'bg-gray-800 text-white' : 'bg-white text-gray-800'} w-full max-w-sm rounded-t-2xl sm:rounded-2xl shadow-xl overflow-hidden max-h-[80vh] flex flex-col`}>
                        <div className={`p-4 border-b flex justify-between items-center ${isDark ? 'border-gray-700' : 'border-gray-100'}`}>
                            <h3 className="font-bold text-lg">Compartilhar com...</h3>
                            <button onClick={() => setShowShareModal(false)} className="text-gray-400 hover:text-gray-600">
                                <div className="icon-x text-xl"></div>
                            </button>
                        </div>
                        
                        <div className="p-4 flex gap-4 overflow-x-auto pb-4 border-b border-gray-100 dark:border-gray-700 scrollbar-hide">
                            <button onClick={() => {
                                const shareUrl = `${window.location.origin}${window.location.pathname}?v=${postToShare.id}`;
                                navigator.clipboard.writeText(shareUrl);
                                showToast("Link copiado!");
                            }} className="flex flex-col items-center gap-2 min-w-[70px]">
                                <div className={`w-12 h-12 rounded-full flex items-center justify-center text-xl ${isDark ? 'bg-gray-700 text-gray-300' : 'bg-gray-100 text-gray-600'}`}>
                                    <div className="icon-link"></div>
                                </div>
                                <span className="text-xs font-medium text-center">Copiar Link</span>
                            </button>
                            <button onClick={() => {
                                const shareUrl = `${window.location.origin}${window.location.pathname}?v=${postToShare.id}`;
                                const text = `Confira este vídeo no Phantora: ${shareUrl}`;
                                window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`);
                            }} className="flex flex-col items-center gap-2 min-w-[70px]">
                                <div className="w-12 h-12 rounded-full bg-green-500 text-white flex items-center justify-center text-xl">
                                    <div className="icon-message-circle"></div>
                                </div>
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
                                                <img src={c.avatar} className="w-10 h-10 rounded-full object-cover" />
                                            ) : (
                                                <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold ${c.type === 'group' ? 'bg-green-100 text-green-600' : 'bg-indigo-100 text-indigo-600'}`}>
                                                    {c.name.charAt(0).toUpperCase()}
                                                </div>
                                            )}
                                            <span className="font-bold text-sm truncate max-w-[150px]">{c.name}</span>
                                        </div>
                                        <button 
                                            onClick={() => handleShareToChat(c.id, c.type)}
                                            disabled={sharingTo[c.id] || sharedSuccess[c.id]}
                                            className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all ${
                                                sharedSuccess[c.id] 
                                                    ? 'bg-green-500 text-white' 
                                                    : sharingTo[c.id] 
                                                        ? 'bg-gray-300 text-gray-500' 
                                                        : 'bg-indigo-600 text-white hover:bg-indigo-700'
                                            }`}
                                        >
                                            {sharingTo[c.id] ? (
                                                <div className="icon-loader animate-spin text-sm"></div>
                                            ) : sharedSuccess[c.id] ? (
                                                <div className="icon-check text-sm"></div>
                                            ) : 'Enviar'}
                                        </button>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Modal Confirmação de Link */}
            {pendingLink && (
                <div className="fixed inset-0 z-[300] bg-black/80 flex items-center justify-center p-4 animate-fade-in-up">
                    <div className="bg-gray-800 rounded-2xl p-6 max-w-sm w-full text-center border border-gray-700">
                        <div className="w-16 h-16 bg-indigo-600/20 rounded-full flex items-center justify-center mx-auto mb-4 text-indigo-500">
                            <div className="icon-external-link text-3xl"></div>
                        </div>
                        <h3 className="text-xl font-bold text-white mb-2">Sair do Phantora?</h3>
                        <p className="text-gray-300 text-sm mb-6">Você tem certeza que deseja entrar nesse link?</p>
                        <p className="text-xs text-gray-500 mb-6 break-all bg-gray-900 p-2 rounded">{pendingLink.url}</p>
                        
                        <div className="flex gap-3">
                            <button 
                                onClick={() => setPendingLink(null)} 
                                className="flex-1 py-3 bg-gray-700 text-white rounded-xl font-bold hover:bg-gray-600"
                            >
                                Cancelar
                            </button>
                            <button 
                                onClick={() => {
                                    // Registrar clique no analytics
                                    const db = window.firebaseDB;
                                    if(db) {
                                        try {
                                            db.ref(`video_analytics/${pendingLink.authorId}/${pendingLink.videoId}_clicks`).push({
                                                timestamp: Date.now(),
                                                url: pendingLink.url
                                            }).catch(e => console.warn('Erro analytics clique:', e.message));
                                        } catch (e) {}
                                    }
                                    window.open(pendingLink.url, '_blank');
                                    setPendingLink(null);
                                }} 
                                className="flex-1 py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700"
                            >
                                Sim, entrar
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Friend Discovery Modal */}
            {showDiscovery && window.FriendSwipe && (
                <window.FriendSwipe user={user} onClose={() => setShowDiscovery(false)} />
            )}

            {/* Modal de Criação de Post (PostCreator) */}
            {showPostCreator && (
                <PostCreator 
                    user={user} 
                    onClose={() => setShowPostCreator(false)} 
                    onUploadComplete={() => {
                        setShowPostCreator(false);
                        setFilterType('all');
                    }} 
                />
            )}



            {/* Renderização da Câmera por cima do Modal */}
            {showCamera && (
                <CameraCapture 
                    onCapture={handleCameraCapture} 
                    onClose={() => setShowCamera(false)} 
                />
            )}
        </div>
    );
}

window.SocialNetwork = SocialNetwork;