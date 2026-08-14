function SocialNetwork({ user, onClose }) {
    const [posts, setPosts] = React.useState([]);
    const [stories, setStories] = React.useState([]);
    const [activeStory, setActiveStory] = React.useState(null);
    const [editingPostId, setEditingPostId] = React.useState(null);
    const [activeCommentPost, setActiveCommentPost] = React.useState(null);
    const [commentText, setCommentText] = React.useState('');
    
    // Novas funcionalidades
    const [activeVideoFeed, setActiveVideoFeed] = React.useState(null); // null or starting index
    const [infiniteFeed, setInfiniteFeed] = React.useState([]); // array of videos for infinite scroll
    const [showVideoComments, setShowVideoComments] = React.useState(null);
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
    const [activeHashtag, setActiveHashtag] = React.useState(null);
    const [filterType, setFilterType] = React.useState('all');
    const [theme, setTheme] = React.useState(localStorage.getItem('social_theme') || 'light');
    const [toast, setToast] = React.useState(null);
    const [now, setNow] = React.useState(Date.now());
    const [following, setFollowing] = React.useState({});
    const [userInterests, setUserInterests] = React.useState({});
    const [pendingLink, setPendingLink] = React.useState(null);
    const watchTimers = React.useRef({});
    const viewStartTime = React.useRef(null);
    const likeSoundRef = React.useRef(new Audio('https://alexandre7888.github.io/phantora/assets/47313572-ui-sounds-pack-2-sound-1-358893.mp3'));

    // Upload states
    const [isUploading, setIsUploading] = React.useState(false);
    const [uploadProgress, setUploadProgress] = React.useState(0);
    const [uploadStatus, setUploadStatus] = React.useState('');
    
    // Camera state
    const [showCamera, setShowCamera] = React.useState(false);
    
    // Post Creator Modal
    const [showPostCreator, setShowPostCreator] = React.useState(false);

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

        const postsRef = db.ref('posts');
        const listener = postsRef.on('value', async (snapshot) => {
            const data = snapshot.val();
            if (data) {
                const postsList = Object.keys(data).map(key => ({
                    id: key,
                    ...data[key],
                    likesCount: data[key].likes ? Object.keys(data[key].likes).length : 0,
                    hasLiked: data[key].likes ? !!data[key].likes[user.id] : false,
                    commentsCount: data[key].comments ? Object.keys(data[key].comments).length : 0,
                }));
                
                const normalPosts = postsList.filter(p => p.type !== 'story');
                const storyPosts = postsList.filter(p => p.type === 'story' && (Date.now() - p.timestamp < 24 * 60 * 60 * 1000));
                
                setStories(storyPosts);

                if (window.sortFeedByAlgorithm) {
                    const sorted = await window.sortFeedByAlgorithm(user.id, normalPosts);
                    setPosts([...sorted]);
                } else {
                    setPosts(normalPosts);
                }
            } else {
                setPosts([]);
                setStories([]);
            }
        });

        const followsRef = db.ref(`follows/${user.id}`);
        const followsListener = followsRef.on('value', (snap) => {
            setFollowing(snap.val() || {});
        });
        
        // Fetch Suggestions
        const fetchSuggestions = async () => {
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
        };
        fetchSuggestions();

        return () => {
            postsRef.off('value', listener);
            followsRef.off('value', followsListener);
        };
    }, [user.id]);

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
                                video.play().catch(e => console.log("Autoplay bloqueado", e));
                            }
                            
                            // Análises: Registrar tempo do vídeo anterior
                            if (activeVideoFeed !== null && activeVideoFeed !== idx) {
                                const prevVideo = infiniteFeed[activeVideoFeed];
                                if (prevVideo && viewStartTime.current) {
                                    const timeSpent = Date.now() - viewStartTime.current;
                                    // Reportar view
                                    const db = window.firebaseDB;
                                    if (db && timeSpent > 1000) { // pelo menos 1 segundo
                                        db.ref(`video_analytics/${prevVideo.authorId}/${prevVideo.id}`).push({
                                            watchTimeMs: timeSpent,
                                            timestamp: Date.now(),
                                            viewerId: 'anonymous' // Anônimo como pedido
                                        });
                                    }
                                }
                            }
                            
                            viewStartTime.current = Date.now();

                            // Infinite scroll logic: if we are near the end, append more videos
                            if (idx >= infiniteFeed.length - 2) {
                                let recommended = window.AlgorithmManager ? window.AlgorithmManager.getRecommendedVideos(user.id, videoPostsRef.current) : videoPostsRef.current;
                                if (recommended.length === 0) recommended = videoPostsRef.current; // Fallback
                                
                                // Generate unique keys for appended videos
                                const appended = recommended.map((v, i) => ({...v, uniqueKey: `${v.id}_${Date.now()}_${i}`}));
                                setInfiniteFeed(prev => [...prev, ...appended]);
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
                        onClick={() => window.location.href = `channel.html?uid=${user.id}`}
                    />
                    <h1 className={`text-lg font-bold text-primary hidden sm:block`}>
                        Phantora
                    </h1>
                </div>
                
                <div className="flex items-center gap-1 sm:gap-2">
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

            {/* Floating Bottom Navigation */}
            <div className="fixed bottom-4 left-1/2 transform -translate-x-1/2 z-[40] bg-secondary/90 backdrop-blur-md border border-border rounded-full px-6 py-3 flex items-center gap-8 shadow-lg">
                <button onClick={() => { setActiveVideoFeed(null); window.scrollTo(0,0); }} className="flex flex-col items-center gap-1 text-accent transition-colors active:scale-95">
                    <div className="icon-house text-2xl"></div>
                </button>
                
                <button onClick={() => window.location.href = 'chat.html'} className="flex flex-col items-center gap-1 text-text-secondary hover:text-text-primary transition-colors active:scale-95">
                    <div className="icon-message-circle text-2xl"></div>
                </button>

                <button onClick={() => {
                    if (videoPostsRef.current.length > 0) {
                        const initialList = videoPostsRef.current.map(v => ({...v, uniqueKey: v.id}));
                        setInfiniteFeed(initialList);
                        
                        const lastWatched = localStorage.getItem('last_watched_video_id');
                        let startIdx = 0;
                        if (lastWatched) {
                            const idx = initialList.findIndex(v => v.id === lastWatched);
                            if (idx !== -1) startIdx = idx;
                        }
                        
                        setActiveVideoFeed(startIdx);
                    } else {
                        showToast("Nenhum vídeo disponível no momento.");
                    }
                }} className="flex flex-col items-center gap-1 text-text-secondary hover:text-text-primary transition-colors active:scale-95">
                    <div className="icon-circle-play text-2xl"></div>
                </button>
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

            <div className="flex-1 overflow-y-auto p-4 md:p-6 pb-24 max-w-2xl mx-auto w-full space-y-6">
                
                {/* Search Redirect Button */}
                <div className={`p-4 ${cardBg} mb-6`}>
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
            </div>

            {/* Fullscreen TikTok Style Video Feed */}
            {activeVideoFeed !== null && (
                <div className="fixed inset-0 bg-black z-[90] flex flex-col animate-fade-in-up">
                    <button onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        document.querySelectorAll('video').forEach(vid => {
                            if (!vid.paused) vid.pause();
                        });
                        setActiveVideoFeed(null);
                        const newUrl = `${window.location.origin}${window.location.pathname}`;
                        window.history.replaceState({ path: newUrl }, '', newUrl);
                    }} className="absolute top-4 left-4 z-[100] text-white bg-black/50 p-2 rounded-full backdrop-blur-sm hover:bg-black/70 cursor-pointer" style={{ zIndex: 9999 }}>
                        <div className="icon-arrow-left text-2xl"></div>
                    </button>
                    
                    <div ref={videoContainerRef} className="flex-1 w-full h-full snap-y snap-mandatory overflow-y-scroll no-scrollbar bg-black relative">
                        {infiniteFeed.map((vPost, index) => {
                            return (
                            <div key={vPost.uniqueKey || vPost.id} data-index={index} className="w-full h-full snap-start snap-always relative flex items-center justify-center bg-black">
                                <video 
                                    src={vPost.mediaUrl} 
                                    className="w-full h-full object-contain md:object-cover max-w-md mx-auto pointer-events-none" 
                                    loop 
                                    playsInline 
                                    autoPlay={index === activeVideoFeed}
                                    id={`tiktok-video-${index}`}
                                />
                                
                                {/* Overlay Invisível para Pausar se o vídeo não pegar o clique */}
                                <div 
                                    className="absolute inset-0 z-10 cursor-pointer flex items-center justify-center" 
                                    onClick={(e) => {
                                        // Apenas executa se não for originado do controle remoto da TV
                                        if (e.detail === 0 && e.clientX === 0 && e.clientY === 0) return;
                                        
                                        e.preventDefault();
                                        e.stopPropagation();
                                        const vid = document.getElementById(`tiktok-video-${index}`);
                                        if (vid) {
                                            if (vid.paused) {
                                                vid.play().catch(err => console.error("Play failed", err));
                                                e.currentTarget.classList.remove('paused-overlay');
                                            } else {
                                                vid.pause();
                                                e.currentTarget.classList.add('paused-overlay');
                                            }
                                        }
                                    }}
                                >
                                    <div className="opacity-0 transition-opacity duration-200 play-icon-overlay pointer-events-none">
                                        <div className="w-24 h-24 bg-black/40 rounded-full flex items-center justify-center backdrop-blur-sm">
                                            <div className="icon-play text-white text-5xl ml-2 opacity-90"></div>
                                        </div>
                                    </div>
                                </div>
                                
                                <style dangerouslySetInnerHTML={{__html:`
                                    .paused-overlay .play-icon-overlay { opacity: 1 !important; }
                                `}} />

                                {/* Overlays de Texto e Links no Vídeo */}
                                <div className="absolute inset-0 max-w-md mx-auto pointer-events-none z-10 overflow-hidden">
                                    {vPost.overlays && vPost.overlays.map(t => (
                                        <div key={`txt_${t.id}`} className="absolute transform -translate-x-1/2 -translate-y-1/2 font-bold text-center drop-shadow-md" style={{ left: `${t.x}%`, top: `${t.y}%`, color: t.color, fontSize: '5vh' }}>
                                            {t.text}
                                        </div>
                                    ))}
                                    {vPost.links && vPost.links.map(l => (
                                        <div 
                                            key={`lnk_${l.id}`} 
                                            className="absolute transform -translate-x-1/2 -translate-y-1/2 pointer-events-auto"
                                            style={{ left: `${l.x}%`, top: `${l.y}%` }}
                                        >
                                            <button 
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setPendingLink({ url: l.url, videoId: vPost.id, authorId: vPost.authorId });
                                                }}
                                                className="bg-white/90 backdrop-blur text-indigo-600 px-4 py-2 rounded-lg font-bold text-sm shadow-lg flex items-center gap-2 hover:scale-105 transition"
                                            >
                                                <div className="icon-link"></div> {l.text}
                                            </button>
                                        </div>
                                    ))}
                                </div>

                                {/* Overlay UI */}
                                <div className="absolute inset-0 max-w-md mx-auto pointer-events-none flex flex-col justify-end p-4 pb-8 bg-gradient-to-t from-black/80 via-transparent to-transparent z-20">
                                    <div className="flex items-end justify-between w-full">
                                        {/* Info area */}
                                        <div className="flex-1 pr-14 text-white pointer-events-auto">
                                            <h3 className="font-bold text-lg hover:underline cursor-pointer" onClick={() => { window.location.href = `channel.html?uid=${vPost.authorId}`; }}>@{(vPost.authorName || 'usuario').replace(/\s/g, '').toLowerCase()}</h3>
                                            <p className="text-sm mt-2 font-medium">{vPost.title}</p>
                                            <div className="text-sm mt-1 text-gray-200 line-clamp-3">
                                                {renderTextWithHashtags(vPost.content)}
                                            </div>
                                            
                                            <div className="flex items-center gap-2 mt-4 bg-white/10 w-fit px-3 py-1.5 rounded-full backdrop-blur-sm cursor-pointer hover:bg-white/20 transition">
                                                <div className="icon-music text-xs animate-pulse"></div>
                                                <span className="text-xs font-medium truncate max-w-[150px]">Som original - {vPost.authorName || 'Desconhecido'}</span>
                                            </div>
                                        </div>

                                        {/* Actions Side */}
                                        <div className="flex flex-col items-center gap-5 pb-2 pointer-events-auto">
                                            <div className="relative">
                                                <img src={vPost.authorAvatar || 'https://via.placeholder.com/150'} className="w-12 h-12 rounded-full border-2 border-white object-cover cursor-pointer" onClick={() => { window.location.href = `channel.html?uid=${vPost.authorId}`; }}/>
                                                {vPost.authorId !== user.id && !following[vPost.authorId] && (
                                                    <button onClick={() => toggleFollow(vPost.authorId)} className="absolute -bottom-2 left-1/2 transform -translate-x-1/2 bg-red-500 rounded-full w-5 h-5 flex items-center justify-center border border-white">
                                                        <div className="icon-plus text-[10px] text-white"></div>
                                                    </button>
                                                )}
                                            </div>
                                            
                                            <button onClick={(e) => { e.stopPropagation(); handleLike(vPost.id, vPost.hasLiked, true, vPost.uniqueKey); }} className="flex flex-col items-center gap-1 group">
                                                <div className={`w-10 h-10 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center group-hover:bg-black/60 transition ${vPost.hasLiked ? 'text-red-500' : 'text-white'}`}>
                                                    <div className={`icon-heart text-2xl ${vPost.hasLiked ? 'fill-current' : ''}`}></div>
                                                </div>
                                                <span className="text-xs text-white font-medium">{vPost.likesCount}</span>
                                            </button>
                                            
                                            <button onClick={(e) => {
                                                e.stopPropagation();
                                                setShowVideoComments(vPost);
                                            }} className="flex flex-col items-center gap-1 group">
                                                <div className="w-10 h-10 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center group-hover:bg-black/60 transition text-white">
                                                    <div className="icon-message-circle text-2xl"></div>
                                                </div>
                                                <span className="text-xs text-white font-medium">{vPost.commentsCount}</span>
                                            </button>
                                            
                                            <button onClick={(e) => { 
                                                e.stopPropagation(); 
                                                showToast("Preparando Remix...");
                                            }} className="flex flex-col items-center gap-1 group">
                                                <div className="w-10 h-10 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center group-hover:bg-black/60 transition text-white">
                                                    <div className="icon-wand-sparkles text-2xl"></div>
                                                </div>
                                                <span className="text-xs text-white font-medium">Remix</span>
                                            </button>

                                            <div className="relative group mt-2">
                                                <button className="w-10 h-10 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center hover:bg-black/60 transition text-white">
                                                    <div className="icon-more-vertical text-xl"></div>
                                                </button>
                                                <div className="absolute right-12 bottom-0 bg-black/80 backdrop-blur-md rounded-xl p-2 hidden group-hover:flex flex-col gap-2 w-48">
                                                    <button onClick={(e) => { e.stopPropagation(); handleShare(vPost); }} className="text-xs text-white px-3 py-2 hover:bg-white/20 rounded flex items-center gap-2">
                                                        <div className="icon-share-2"></div> Compartilhar
                                                    </button>
                                                    <div className="h-px bg-gray-700 my-1"></div>
                                                    <button onClick={(e) => {
                                                        e.stopPropagation();
                                                        if(window.updateAlgorithmProfile) {
                                                            window.updateAlgorithmProfile(user.id, 'dislike', vPost.hashtags, -5);
                                                        }
                                                        
                                                        const newFeed = infiniteFeed.filter(p => p.uniqueKey !== vPost.uniqueKey);
                                                        setInfiniteFeed(newFeed);
                                                        showToast("Marcado como não interessado");
                                                        
                                                    }} className="text-xs text-white px-3 py-2 hover:bg-white/20 rounded flex items-center gap-2">
                                                        <div className="icon-thumbs-down"></div> Não interessado
                                                    </button>
                                                </div>
                                            </div>

                                            {vPost.allowDownload !== false && (
                                                <button onClick={async () => {
                                                    try {
                                                        showToast("Iniciando download...");
                                                        const response = await fetch(vPost.mediaUrl);
                                                        const blob = await response.blob();
                                                        const url = window.URL.createObjectURL(blob);
                                                        const a = document.createElement('a');
                                                        a.style.display = 'none';
                                                        a.href = url;
                                                        a.download = `phantora_video_${vPost.id}.mp4`;
                                                        document.body.appendChild(a);
                                                        a.click();
                                                        window.URL.revokeObjectURL(url);
                                                        document.body.removeChild(a);
                                                        showToast("Download concluído!");
                                                    } catch (e) {
                                                        console.error("Erro no download:", e);
                                                        showToast("Baixando via link alternativo...");
                                                        const a = document.createElement('a');
                                                        a.href = vPost.mediaUrl;
                                                        a.target = "_blank";
                                                        a.download = `phantora_video_${vPost.id}.mp4`;
                                                        document.body.appendChild(a);
                                                        a.click();
                                                        document.body.removeChild(a);
                                                    }
                                                }} className="flex flex-col items-center gap-1 group mt-2">
                                                    <div className="w-8 h-8 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center group-hover:bg-black/60 transition text-white">
                                                        <div className="icon-download text-lg"></div>
                                                    </div>
                                                </button>
                                            )}

                                            <div 
                                                onClick={() => {
                                                    const audioId = vPost.audioId || `default_${vPost.id}`;
                                                    window.location.href = `audio.html?id=${audioId}`;
                                                }}
                                                className="w-10 h-10 rounded-full border-4 border-gray-800 animate-[spin_4s_linear_infinite] mt-2 overflow-hidden flex-shrink-0 cursor-pointer relative"
                                            >
                                                <img src={vPost.audioCover || vPost.authorAvatar || 'https://via.placeholder.com/150'} className="w-full h-full object-cover"/>
                                                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                                    <div className="w-2 h-2 bg-gray-900 rounded-full"></div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                    
                                    {quickShareUserId && (
                                        <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 z-[110] pointer-events-auto">
                                            <button 
                                                onClick={handleQuickShare}
                                                disabled={isQuickSharing || quickShareSuccess}
                                                className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-full pl-2 pr-4 py-2 flex items-center gap-3 shadow-xl transform transition-transform active:scale-95 disabled:opacity-90"
                                            >
                                                {isQuickSharing ? (
                                                    <div className="icon-loader text-xl animate-spin ml-1"></div>
                                                ) : quickShareSuccess ? (
                                                    <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center">
                                                        <svg className="w-5 h-5 text-white animate-[stroke_0.6s_ease-out_forwards]" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7"></path>
                                                        </svg>
                                                    </div>
                                                ) : (
                                                    <div className="relative">
                                                        <img src={quickShareUserAvatar || 'https://via.placeholder.com/150'} className="w-8 h-8 rounded-full object-cover border border-white" />
                                                        <div className="absolute -bottom-1 -right-1 bg-white rounded-full w-4 h-4 flex items-center justify-center">
                                                            <div className="icon-share text-[10px] text-indigo-600"></div>
                                                        </div>
                                                    </div>
                                                )}
                                                <span className="font-bold text-sm">
                                                    {isQuickSharing ? 'Compartilhando...' : quickShareSuccess ? 'Enviado!' : 'Compartilhar de volta'}
                                                </span>
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                            );
                        })}
                    </div>

                    {/* Overlay de Comentários do Vídeo (Bottom Sheet) */}
                    {showVideoComments && (
                        <div className="absolute inset-0 z-[200] flex flex-col justify-end pointer-events-auto">
                            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowVideoComments(null)}></div>
                            <div className="relative bg-gray-900 w-full h-[60vh] rounded-t-2xl flex flex-col shadow-2xl border-t border-gray-800 animate-fade-in-up">
                                <div className="p-4 border-b border-gray-800 flex justify-between items-center shrink-0">
                                    <h3 className="font-bold text-white">Comentários ({showVideoComments.commentsCount})</h3>
                                    <button onClick={() => setShowVideoComments(null)} className="text-gray-400 hover:text-white p-1">
                                        <div className="icon-x text-xl"></div>
                                    </button>
                                </div>
                                <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
                                    {showVideoComments.comments && Object.keys(showVideoComments.comments).length > 0 ? (
                                        Object.keys(showVideoComments.comments).map(cId => {
                                            const comment = showVideoComments.comments[cId];
                                            return (
                                                <div key={cId} className="flex gap-3">
                                                    {comment.authorAvatar ? (
                                                        <img src={comment.authorAvatar} className="w-8 h-8 rounded-full object-cover shrink-0" />
                                                    ) : (
                                                        <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center text-xs font-bold text-white shrink-0">
                                                            {(comment.authorName || '?').charAt(0)}
                                                        </div>
                                                    )}
                                                    <div className="flex-1">
                                                        <div className="flex justify-between items-start">
                                                            <span className="font-bold text-sm text-gray-300">{comment.authorName || 'Usuário'}</span>
                                                            {(comment.authorId === user.id || showVideoComments.authorId === user.id) && (
                                                                <button onClick={async () => {
                                                                    if (window.confirm("Apagar este comentário?")) {
                                                                        await window.firebaseDB.ref(`posts/${showVideoComments.id}/comments/${cId}`).remove();
                                                                        // Update local state to reflect deletion immediately
                                                                        const updatedPost = {...showVideoComments};
                                                                        delete updatedPost.comments[cId];
                                                                        updatedPost.commentsCount = Object.keys(updatedPost.comments).length;
                                                                        setShowVideoComments(updatedPost);
                                                                    }
                                                                }} className="text-gray-500 hover:text-red-500 text-xs">
                                                                    <div className="icon-trash"></div>
                                                                </button>
                                                            )}
                                                        </div>
                                                        <p className="text-sm text-gray-100 mt-1">{comment.text}</p>
                                                        <span className="text-[10px] text-gray-500 mt-1 block">{getRelativeTime(comment.timestamp)}</span>
                                                    </div>
                                                </div>
                                            );
                                        })
                                    ) : (
                                        <p className="text-center text-gray-500 text-sm mt-8">Nenhum comentário ainda. Seja o primeiro a comentar!</p>
                                    )}
                                </div>
                                <div className="p-4 border-t border-gray-800 shrink-0 bg-gray-900 pb-8">
                                    <div className="flex gap-2">
                                        <input 
                                            type="text" 
                                            value={commentText}
                                            onChange={(e) => setCommentText(e.target.value)}
                                            placeholder="Adicionar comentário..."
                                            className="flex-1 rounded-full px-4 py-2.5 text-sm outline-none bg-gray-800 text-white border border-gray-700 focus:border-indigo-500"
                                            onKeyDown={async (e) => {
                                                if (e.key === 'Enter' && commentText.trim()) {
                                                    const db = window.firebaseDB;
                                                    const newRef = await db.ref(`posts/${showVideoComments.id}/comments`).push({
                                                        authorId: user.id,
                                                        authorName: user.name,
                                                        authorAvatar: user.avatar || '',
                                                        text: commentText.trim(),
                                                        timestamp: Date.now()
                                                    });
                                                    setCommentText('');
                                                    // O listener global vai atualizar o post, mas podemos atualizar o local para ser instantâneo
                                                    const updatedPost = {...showVideoComments};
                                                    if (!updatedPost.comments) updatedPost.comments = {};
                                                    updatedPost.comments[newRef.key] = {
                                                        authorId: user.id,
                                                        authorName: user.name,
                                                        authorAvatar: user.avatar || '',
                                                        text: commentText.trim(),
                                                        timestamp: Date.now()
                                                    };
                                                    updatedPost.commentsCount = Object.keys(updatedPost.comments).length;
                                                    setShowVideoComments(updatedPost);
                                                }
                                            }}
                                        />
                                        <button 
                                            onClick={async () => {
                                                if(commentText.trim()) {
                                                    const db = window.firebaseDB;
                                                    const newRef = await db.ref(`posts/${showVideoComments.id}/comments`).push({
                                                        authorId: user.id,
                                                        authorName: user.name,
                                                        authorAvatar: user.avatar || '',
                                                        text: commentText.trim(),
                                                        timestamp: Date.now()
                                                    });
                                                    setCommentText('');
                                                    const updatedPost = {...showVideoComments};
                                                    if (!updatedPost.comments) updatedPost.comments = {};
                                                    updatedPost.comments[newRef.key] = {
                                                        authorId: user.id,
                                                        authorName: user.name,
                                                        authorAvatar: user.avatar || '',
                                                        text: commentText.trim(),
                                                        timestamp: Date.now()
                                                    };
                                                    updatedPost.commentsCount = Object.keys(updatedPost.comments).length;
                                                    setShowVideoComments(updatedPost);
                                                }
                                            }}
                                            disabled={!commentText.trim()}
                                            className="bg-indigo-600 text-white p-2.5 rounded-full disabled:opacity-50 hover:bg-indigo-700"
                                        >
                                            <div className="icon-send text-sm"></div>
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
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
                                        db.ref(`video_analytics/${pendingLink.authorId}/${pendingLink.videoId}_clicks`).push({
                                            timestamp: Date.now(),
                                            url: pendingLink.url
                                        });
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