function VideoFeed({ 
    initialVideos, 
    initialActiveIndex, 
    onClose, 
    user, 
    following, 
    toggleFollow, 
    handleLike, 
    handleShare, 
    quickShareUserId, 
    quickShareUserAvatar, 
    handleQuickShare, 
    isQuickSharing, 
    quickShareSuccess, 
    renderTextWithHashtags, 
    getRelativeTime 
}) {
    const [infiniteFeed, setInfiniteFeed] = React.useState(initialVideos || []);
    const [activeVideoFeed, setActiveVideoFeed] = React.useState(initialActiveIndex !== null ? initialActiveIndex : 0);
    const [isLoadingMoreVideos, setIsLoadingMoreVideos] = React.useState(false);
    const [hasMoreVideos, setHasMoreVideos] = React.useState(true);
    const [bufferingVideos, setBufferingVideos] = React.useState({});
    const [pendingLink, setPendingLink] = React.useState(null);
    const [isMuted, setIsMuted] = React.useState(false);
    const [showVideoComments, setShowVideoComments] = React.useState(null);
    const [commentText, setCommentText] = React.useState('');
    const [subTarget, setSubTarget] = React.useState(null);
    
    const videoContainerRef = React.useRef(null);
    const viewStartTime = React.useRef(null);

    React.useEffect(() => {
        if (infiniteFeed.length > 0) {
            const currentVid = infiniteFeed[activeVideoFeed]?.id;
            if (currentVid) {
                const params = new URLSearchParams(window.location.search);
                const fromId = params.get('from');
                const newUrl = `${window.location.origin}${window.location.pathname}?v=${currentVid}${fromId ? `&from=${fromId}` : ''}`;
                window.history.replaceState({ path: newUrl }, '', newUrl);
            }
        }
    }, [activeVideoFeed, infiniteFeed]);

    React.useEffect(() => {
        if (videoContainerRef.current && infiniteFeed.length > 0) {
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
                                    setIsMuted(true);
                                    video.muted = true;
                                    video.play().catch(() => {
                                        const overlay = entry.target.querySelector('.play-icon-overlay');
                                        if (overlay) overlay.style.opacity = '1';
                                    });
                                });
                            }
                            
                            if (activeVideoFeed !== null && activeVideoFeed !== idx) {
                                const prevVideo = infiniteFeed[activeVideoFeed];
                                if (prevVideo && viewStartTime.current) {
                                    const timeSpent = Date.now() - viewStartTime.current;
                                    const db = window.firebaseDB;
                                    if (db && timeSpent > 1000) {
                                        try {
                                            db.ref(`video_analytics/${prevVideo.authorId}/${prevVideo.id}`).push({
                                                watchTimeMs: timeSpent,
                                                timestamp: Date.now(),
                                                viewerId: 'anonymous'
                                            }).catch(() => {});
                                        } catch(e) {}
                                    }
                                }
                            }
                            
                            viewStartTime.current = Date.now();

                            if (idx >= infiniteFeed.length - 2 && !isLoadingMoreVideos && hasMoreVideos) {
                                loadMoreVideos();
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

                const observeChildren = () => {
                    Array.from(container.children).forEach(child => observer.observe(child));
                };
                observeChildren();
                
                const mutationObserver = new MutationObserver(() => observeChildren());
                mutationObserver.observe(container, { childList: true });

            }, 50);

            return () => {
                clearTimeout(initTimer);
                if (observer) observer.disconnect();
            };
        }
    }, [infiniteFeed.length, activeVideoFeed]);

    const loadMoreVideos = async () => {
        if (isLoadingMoreVideos || !hasMoreVideos) return;
        setIsLoadingMoreVideos(true);

        try {
            const db = window.firebaseDB;
            if (!db) return;

            let query = db.ref('posts').orderByKey();

            if (infiniteFeed.length > 0) {
                const lastItemKey = infiniteFeed[infiniteFeed.length - 1].id; 
                query = query.endBefore(lastItemKey);
            }

            const snap = await query.limitToLast(20).once('value');

            if (snap.exists()) {
                const data = snap.val();
                const keys = Object.keys(data);

                if (keys.length === 0) {
                    setHasMoreVideos(false);
                    return;
                }

                const rawVids = keys.map(key => {
                    const item = data[key];
                    let videoUrl = item.videoUrl || (typeof item.mediaUrl === 'string' ? item.mediaUrl : '');
                    
                    if (!videoUrl && item.mediaUrls && Array.isArray(item.mediaUrls) && item.mediaUrls.length > 0) {
                        const first = item.mediaUrls[0];
                        videoUrl = typeof first === 'string' ? first : (first && first.url ? first.url : '');
                    }

                    return {
                        id: key,
                        ...item,
                        likesCount: item.likes ? Object.keys(item.likes).length : 0,
                        hasLiked: item.likes ? !!item.likes[user.id] : false,
                        commentsCount: item.comments ? Object.keys(item.comments).length : 0,
                        mediaUrl: videoUrl || ''
                    };
                }).filter(item => {
                    return (item.type === 'video' || item.type === 'short') && item.mediaUrl;
                });

                const newVideos = rawVids.reverse().map((v, i) => ({
                    ...v,
                    uniqueKey: `${v.id}_${Date.now()}_${i}`
                }));

                setInfiniteFeed(prev => {
                    const combined = [...prev, ...newVideos];
                    const unique = [];
                    const seen = new Set();
                    for (const item of combined) {
                        if (!seen.has(item.uniqueKey)) {
                            seen.add(item.uniqueKey);
                            unique.push(item);
                        }
                    }
                    return unique;
                });

                if (keys.length < 20) {
                    setHasMoreVideos(false);
                }

            } else {
                setHasMoreVideos(false);
            }
        } catch (err) {
            console.error("Erro ao carregar mais vídeos:", err);
        } finally {
            setIsLoadingMoreVideos(false);
        }
    };

    const toggleMute = (e) => {
        e.stopPropagation();
        const newMutedState = !isMuted;
        setIsMuted(newMutedState);
        document.querySelectorAll('video').forEach(vid => {
            vid.muted = newMutedState;
        });
    };

    return (
        <div className="fixed inset-0 bg-black z-[90] flex flex-col animate-fade-in-up">
            {/* Header controls */}
            <div className="absolute top-0 left-0 right-0 z-[100] p-4 flex justify-between items-start pointer-events-none bg-gradient-to-b from-black/60 to-transparent">
                <button onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    document.querySelectorAll('video').forEach(vid => {
                        if (!vid.paused) vid.pause();
                    });
                    onClose();
                }} className="text-white bg-black/40 hover:bg-black/60 p-3 rounded-full backdrop-blur-md cursor-pointer pointer-events-auto transition-all">
                    <div className="icon-arrow-left text-xl"></div>
                </button>
                
                <button onClick={toggleMute} className="text-white bg-black/40 hover:bg-black/60 p-3 rounded-full backdrop-blur-md cursor-pointer pointer-events-auto transition-all">
                    <div className={`text-xl ${isMuted ? 'icon-volume-x text-red-400' : 'icon-volume-2'}`}></div>
                </button>
            </div>
            
            <div ref={videoContainerRef} className="flex-1 w-full h-full snap-y snap-mandatory overflow-y-scroll no-scrollbar bg-black relative">
                {infiniteFeed.map((vPost, index) => (
                    <div key={vPost.uniqueKey || vPost.id} data-index={index} className="w-full h-full snap-start snap-always relative flex items-center justify-center bg-black">
                        {activeVideoFeed !== null && Math.abs(index - activeVideoFeed) <= 2 ? (
                            <>
                                <video 
                                    src={vPost.mediaUrl || (vPost.mediaUrls && (typeof vPost.mediaUrls[0] === 'object' ? vPost.mediaUrls[0].url : vPost.mediaUrls[0]))} 
                                    className="w-full h-full object-contain md:object-cover mx-auto pointer-events-none transition-opacity duration-300 bg-black" 
                                    loop 
                                    playsInline 
                                    muted={isMuted}
                                    preload={Math.abs(index - activeVideoFeed) <= 1 ? "auto" : "none"}
                                    autoPlay={index === activeVideoFeed}
                                    id={`tiktok-video-${index}`}
                                    onWaiting={() => setBufferingVideos(prev => ({...prev, [index]: true}))}
                                    onPlaying={() => setBufferingVideos(prev => ({...prev, [index]: false}))}
                                    onCanPlay={() => setBufferingVideos(prev => ({...prev, [index]: false}))}
                                    onLoadStart={() => setBufferingVideos(prev => ({...prev, [index]: true}))}
                                    onLoadedData={() => setBufferingVideos(prev => ({...prev, [index]: false}))}
                                />
                                {bufferingVideos[index] && (
                                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
                                        <div className="w-16 h-16 bg-black/30 rounded-full flex items-center justify-center backdrop-blur-lg border border-white/10">
                                            <div className="icon-loader animate-spin text-white text-3xl"></div>
                                        </div>
                                    </div>
                                )}
                            </>
                        ) : (
                            <div className="w-full h-full flex items-center justify-center mx-auto bg-black" id={`tiktok-video-${index}-placeholder`}>
                                <div className="w-16 h-16 bg-black/30 rounded-full flex items-center justify-center backdrop-blur-lg border border-white/10">
                                    <div className="icon-loader animate-spin text-white/50 text-3xl"></div>
                                </div>
                            </div>
                        )}
                        
                        <div 
                            className="absolute inset-0 z-10 cursor-pointer flex items-center justify-center" 
                            onClick={(e) => {
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
                            <div className="opacity-0 transition-opacity duration-300 play-icon-overlay pointer-events-none transform scale-150">
                                <div className="w-24 h-24 bg-black/50 rounded-full flex items-center justify-center backdrop-blur-md shadow-2xl border border-white/20">
                                    <div className="icon-play text-white text-5xl ml-2 opacity-90"></div>
                                </div>
                            </div>
                        </div>
                        
                        <style dangerouslySetInnerHTML={{__html:`
                            .paused-overlay .play-icon-overlay { opacity: 1 !important; transform: scale(1); }
                        `}} />

                        {/* Nova Interface - Layout dividido entre Info (Esq) e Ações (Dir) */}
                        <div className="absolute inset-0 pointer-events-none flex flex-row items-end justify-between z-20 pb-4 px-4 bg-gradient-to-t from-black/80 via-black/20 to-transparent">
                            
                            {/* Info do Autor e Legenda (Esquerda) */}
                            <div className="flex-1 pr-16 text-white pointer-events-auto pb-4 max-w-[80%]">
                                <h3 
                                    className="font-bold text-lg hover:underline cursor-pointer flex items-center gap-2 drop-shadow-md" 
                                    onClick={() => window.location.href = `canal.html?uid=${vPost.authorId}`}
                                >
                                    @{(vPost.authorName || 'usuario').replace(/\s/g, '').toLowerCase()}
                                    {vPost.isVerified && <div className="icon-badge-check text-blue-400 text-sm"></div>}
                                </h3>
                                
                                {vPost.title && (
                                    <p className="text-sm mt-2 font-medium drop-shadow-md">{vPost.title}</p>
                                )}
                                
                                <div className="text-[15px] mt-2 text-gray-100 line-clamp-3 leading-snug font-light drop-shadow-md">
                                    {renderTextWithHashtags(vPost.content)}
                                </div>
                                
                                {/* Info de Som/Música - Opcional se existir, ou estático */}
                                <div className="flex items-center gap-2 mt-4 text-xs font-medium text-white/80 bg-black/30 w-max px-3 py-1.5 rounded-full backdrop-blur-md border border-white/10">
                                    <div className="icon-music text-sm animate-pulse"></div>
                                    <span className="marquee-text overflow-hidden whitespace-nowrap max-w-[150px]">
                                        Som original - {vPost.authorName || 'Autor'}
                                    </span>
                                </div>
                            </div>

                            {/* Botões de Ação (Direita) */}
                            <div className="flex flex-col items-center gap-5 pb-6 pointer-events-auto">
                                
                                {/* Assinar Canal */}
                                {vPost.authorId !== user.id && (
                                    <button 
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setSubTarget({ id: vPost.authorId, name: vPost.authorName, avatar: vPost.authorAvatar });
                                        }}
                                        className="flex flex-col items-center gap-1 active:scale-95 transition-transform"
                                    >
                                        <div className="w-12 h-[72px] bg-sky-400 hover:bg-sky-500 rounded-full flex flex-col items-center justify-center shadow-lg border-2 border-white/20">
                                            <div className="icon-star text-white text-xl mb-1"></div>
                                            <span className="text-[10px] font-bold text-white uppercase tracking-tighter" style={{writingMode: 'vertical-rl'}}>Assinar</span>
                                        </div>
                                    </button>
                                )}

                                {/* Avatar do Autor com botão de seguir */}
                                <div className="relative mb-4">
                                    <div className="w-12 h-12 rounded-full border-2 border-white p-[2px] bg-white/20 backdrop-blur-sm cursor-pointer shadow-lg" onClick={() => window.location.href = `canal.html?uid=${vPost.authorId}`}>
                                        <img src={vPost.authorAvatar || 'https://via.placeholder.com/150'} className="w-full h-full rounded-full object-cover"/>
                                    </div>
                                    {vPost.authorId !== user.id && !following[vPost.authorId] && (
                                        <button 
                                            onClick={() => toggleFollow(vPost.authorId)} 
                                            className="absolute -bottom-2.5 left-1/2 transform -translate-x-1/2 bg-[#ef4444] hover:bg-red-600 transition-colors rounded-full w-6 h-6 flex items-center justify-center border-2 border-white z-10 shadow-md"
                                        >
                                            <div className="icon-plus text-[12px] text-white font-bold"></div>
                                        </button>
                                    )}
                                </div>
                                
                                {/* Curtir */}
                                <button onClick={(e) => { 
                                    e.stopPropagation(); 
                                    handleLike(vPost.id, vPost.hasLiked, true, vPost.uniqueKey);
                                    setInfiniteFeed(prev => prev.map(p => {
                                        if (p.uniqueKey === vPost.uniqueKey) {
                                            return {
                                                ...p,
                                                hasLiked: !vPost.hasLiked,
                                                likesCount: !vPost.hasLiked ? p.likesCount + 1 : Math.max(0, p.likesCount - 1)
                                            };
                                        }
                                        return p;
                                    }));
                                }} className="flex flex-col items-center gap-1.5 group active:scale-90 transition-transform">
                                    <div className={`w-11 h-11 rounded-full flex items-center justify-center transition-all ${vPost.hasLiked ? 'text-[#ef4444]' : 'text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]'}`}>
                                        <div className={`text-3xl ${vPost.hasLiked ? 'icon-heart fill-current' : 'icon-heart'}`}></div>
                                    </div>
                                    <span className="text-xs text-white font-semibold drop-shadow-md">{vPost.likesCount}</span>
                                </button>
                                
                                {/* Comentar */}
                                <button onClick={(e) => { e.stopPropagation(); setShowVideoComments(vPost); }} className="flex flex-col items-center gap-1.5 group active:scale-90 transition-transform">
                                    <div className="w-11 h-11 rounded-full flex items-center justify-center text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">
                                        <div className="icon-message-circle text-3xl"></div>
                                    </div>
                                    <span className="text-xs text-white font-semibold drop-shadow-md">{vPost.commentsCount}</span>
                                </button>
                                
                                {/* Compartilhar */}
                                <div className="relative group">
                                    <button onClick={(e) => { e.stopPropagation(); handleShare(vPost); }} className="w-11 h-11 rounded-full flex items-center justify-center text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)] active:scale-90 transition-transform">
                                        <div className="icon-share-2 text-[26px]"></div>
                                    </button>
                                    <span className="text-xs text-white font-semibold drop-shadow-md text-center w-full block mt-1">Compartilhar</span>
                                </div>

                                {/* Disco de música girando */}
                                <div className="mt-4 animate-spin" style={{ animationDuration: '4s' }}>
                                    <div className="w-11 h-11 rounded-full bg-gray-900 border-[8px] border-gray-800 flex items-center justify-center overflow-hidden shadow-[0_0_15px_rgba(0,0,0,0.8)]">
                                        <img src={vPost.authorAvatar || 'https://via.placeholder.com/150'} className="w-full h-full object-cover opacity-80" />
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Quick Share flutuante se houver um usuário selecionado */}
                        {quickShareUserId && (
                            <div className="absolute bottom-28 right-20 z-[110] pointer-events-auto animate-slide-up">
                                <button 
                                    onClick={() => handleQuickShare(vPost)}
                                    disabled={isQuickSharing || quickShareSuccess}
                                    className="bg-[#7c3aed] hover:bg-[#6d28d9] text-white rounded-full pl-2 pr-4 py-2.5 flex items-center gap-3 shadow-[0_0_20px_rgba(124,58,237,0.4)] transform transition-transform active:scale-95 disabled:opacity-90 border border-white/20 backdrop-blur-md"
                                >
                                    <div className="w-8 h-8 rounded-full overflow-hidden border border-white/30">
                                        <img src={quickShareUserAvatar || 'https://via.placeholder.com/150'} className="w-full h-full object-cover" />
                                    </div>
                                    <span className="font-bold text-sm tracking-wide">
                                        {isQuickSharing ? 'Enviando...' : quickShareSuccess ? 'Enviado!' : 'Enviar'}
                                    </span>
                                </button>
                            </div>
                        )}

                        {/* Barra de progresso visual de loading extra */}
                        {index === infiniteFeed.length - 1 && isLoadingMoreVideos && (
                            <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-[#7c3aed] to-transparent animate-pulse z-50"></div>
                        )}
                    </div>
                ))}
            </div>

            {/* Modal de Assinatura */}
            {subTarget && (
                <window.ChannelSubscription
                    creatorId={subTarget.id}
                    creatorName={subTarget.name}
                    creatorAvatar={subTarget.avatar}
                    db={window.firebaseDB}
                    onClose={() => setSubTarget(null)}
                />
            )}

            {/* Overlay de Comentários do Vídeo (Bottom Sheet) */}
            {showVideoComments && (
                <div className="fixed inset-0 z-[200] flex flex-col justify-end pointer-events-auto">
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
                                                <div className="w-8 h-8 rounded-full bg-[#7c3aed] flex items-center justify-center text-xs font-bold text-white shrink-0">
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
                                                                const updatedPost = {...showVideoComments};
                                                                delete updatedPost.comments[cId];
                                                                updatedPost.commentsCount = Object.keys(updatedPost.comments).length;
                                                                setShowVideoComments(updatedPost);
                                                                
                                                                setInfiniteFeed(prev => prev.map(p => {
                                                                    if (p.id === updatedPost.id) {
                                                                        return {...p, comments: updatedPost.comments, commentsCount: updatedPost.commentsCount};
                                                                    }
                                                                    return p;
                                                                }));
                                                            }
                                                        }} className="text-gray-500 hover:text-red-500 text-xs">
                                                            <div className="icon-trash"></div>
                                                        </button>
                                                    )}
                                                </div>
                                                <p className="text-sm text-gray-100 mt-1">{comment.text}</p>
                                                <span className="text-[10px] text-gray-500 mt-1 block">{getRelativeTime ? getRelativeTime(comment.timestamp) : new Date(comment.timestamp).toLocaleTimeString()}</span>
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
                                    className="flex-1 rounded-full px-4 py-2.5 text-sm outline-none bg-gray-800 text-white border border-gray-700 focus:border-[#7c3aed]"
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
                                            const newComment = {
                                                authorId: user.id,
                                                authorName: user.name,
                                                authorAvatar: user.avatar || '',
                                                text: commentText.trim(),
                                                timestamp: Date.now()
                                            };
                                            setCommentText('');
                                            const updatedPost = {...showVideoComments};
                                            if (!updatedPost.comments) updatedPost.comments = {};
                                            updatedPost.comments[newRef.key] = newComment;
                                            updatedPost.commentsCount = Object.keys(updatedPost.comments).length;
                                            setShowVideoComments(updatedPost);
                                            
                                            setInfiniteFeed(prev => prev.map(p => {
                                                if (p.id === updatedPost.id) {
                                                    return {...p, comments: updatedPost.comments, commentsCount: updatedPost.commentsCount};
                                                }
                                                return p;
                                            }));
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
                                            const newComment = {
                                                authorId: user.id,
                                                authorName: user.name,
                                                authorAvatar: user.avatar || '',
                                                text: commentText.trim(),
                                                timestamp: Date.now()
                                            };
                                            setCommentText('');
                                            const updatedPost = {...showVideoComments};
                                            if (!updatedPost.comments) updatedPost.comments = {};
                                            updatedPost.comments[newRef.key] = newComment;
                                            updatedPost.commentsCount = Object.keys(updatedPost.comments).length;
                                            setShowVideoComments(updatedPost);
                                            
                                            setInfiniteFeed(prev => prev.map(p => {
                                                if (p.id === updatedPost.id) {
                                                    return {...p, comments: updatedPost.comments, commentsCount: updatedPost.commentsCount};
                                                }
                                                return p;
                                            }));
                                        }
                                    }}
                                    disabled={!commentText.trim()}
                                    className="bg-[#7c3aed] text-white p-2.5 rounded-full disabled:opacity-50 hover:bg-[#6d28d9]"
                                >
                                    <div className="icon-send text-sm"></div>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal de confirmação de links externos */}
            {pendingLink && (
                <div className="fixed inset-0 z-[300] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in-up">
                    <div className="bg-[#1a1a24] rounded-2xl p-6 max-w-sm w-full text-center border border-[#2a2a40] shadow-2xl">
                        <div className="w-16 h-16 bg-[#7c3aed]/20 rounded-full flex items-center justify-center mx-auto mb-4 text-[#7c3aed]">
                            <div className="icon-external-link text-3xl"></div>
                        </div>
                        <h3 className="text-xl font-bold text-white mb-2">Sair do Phantora?</h3>
                        <p className="text-gray-300 text-sm mb-6">Você tem certeza que deseja entrar nesse link?</p>
                        <div className="bg-[#0c0c14] p-3 rounded-lg border border-[#2a2a40] mb-6">
                            <p className="text-xs text-gray-400 break-all text-left font-mono">{pendingLink.url}</p>
                        </div>
                        
                        <div className="flex gap-3">
                            <button onClick={() => setPendingLink(null)} className="flex-1 py-3 bg-[#2a2a40] text-white rounded-xl font-semibold hover:bg-[#3a3a55] transition-colors">Cancelar</button>
                            <button onClick={() => { window.open(pendingLink.url, '_blank'); setPendingLink(null); }} className="flex-1 py-3 bg-[#7c3aed] text-white rounded-xl font-semibold hover:bg-[#6d28d9] transition-colors shadow-lg shadow-purple-500/20">Acessar</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
window.VideoFeed = VideoFeed;