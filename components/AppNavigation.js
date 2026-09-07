function AppNavigation({ user, currentView, onViewChange, followerStats = { count: 0 }, showSettingsMenu }) {
    const [navAvatar, setNavAvatar] = React.useState(user?.avatar || 'https://ui-avatars.com/api/?name=U&background=random');
    
    React.useEffect(() => {
        if (user?.id && window.firebaseDB) {
            const avatarRef = window.firebaseDB.ref(`users/${user.id}/avatar`);
            const listener = avatarRef.on('value', (snap) => {
                if (snap.exists()) {
                    setNavAvatar(snap.val());
                } else if (user?.avatar) {
                    setNavAvatar(user.avatar);
                }
            });
            return () => avatarRef.off('value', listener);
        } else if (user?.avatar) {
            setNavAvatar(user.avatar);
        }
    }, [user?.id, user?.avatar]);

    const isOwnChannel = currentView === 'channel';
    const isChat = currentView === 'chat';
    const isFeed = currentView === 'feed';
    const isVideo = currentView === 'video';

    return (
        <React.Fragment>
            {/* Header */}
            <header className="bg-secondary/80 backdrop-blur-lg border-b border-border px-4 py-3 flex items-center justify-between sticky top-0 z-50 transition-colors">
                <div className="flex items-center gap-3">
                    <img 
                        src={navAvatar} 
                        alt="Avatar" 
                        className="w-10 h-10 rounded-full object-cover border-2 border-accent cursor-pointer hover:opacity-80 transition-opacity shrink-0"
                        onClick={() => window.location.href = `canal.html?uid=${user?.id}`}
                    />
                    <div className="flex flex-col justify-center">
                        <h1 className="text-lg font-bold text-primary hidden sm:block leading-none mb-1 text-white">
                            Phantora
                        </h1>
                        <div className="flex flex-col">
                            <span className="text-yellow-500 font-bold text-xs leading-none">{followerStats.count} {followerStats.count === 1 ? 'seguidor' : 'seguidores'}</span>
                            <span className="text-text-muted text-[10px] leading-none mt-1">atualizado agora</span>
                        </div>
                    </div>
                </div>
                
                <div className="flex items-center gap-1 sm:gap-2">
                    <button onClick={() => {
                        if (window.requestUserLocation) window.requestUserLocation();
                        window.location.href = 'discover.html';
                    }} className="p-2 rounded-full text-text-secondary hover:bg-tertiary hover:text-accent transition-colors" title="Descobrir Pessoas">
                        <div className="icon-users text-xl"></div>
                    </button>
                    <button onClick={() => window.location.href = 'search.html'} className="p-2 hidden sm:block rounded-full text-text-secondary hover:bg-tertiary hover:text-text-primary transition-colors" title="Pesquisar">
                        <div className="icon-search text-xl"></div>
                    </button>
                    <button onClick={() => {
                        if(showSettingsMenu) showSettingsMenu();
                    }} className="p-2 rounded-full text-text-secondary hover:bg-tertiary hover:text-text-primary transition-colors" title="Configurações">
                        <div className="icon-settings text-xl"></div>
                    </button>
                    <button onClick={() => window.location.href = 'index.html'} className="p-2 rounded-full text-text-secondary hover:bg-tertiary hover:text-danger transition-colors" title="Sair">
                        <div className="icon-log-out text-xl"></div>
                    </button>
                </div>
            </header>

            {/* Mobile Bottom Navigation */}
            <div className="md:hidden fixed bottom-4 left-1/2 transform -translate-x-1/2 z-[60] bg-secondary/90 backdrop-blur-md border border-border rounded-full px-6 py-3 flex items-center justify-between w-[90%] max-w-[400px] shadow-lg">
                <button onClick={() => { if(onViewChange) onViewChange('feed'); else window.location.href = 'index.html'; }} className={`flex flex-col items-center gap-1 transition-colors active:scale-95 ${isFeed ? 'text-accent' : 'text-text-secondary hover:text-text-primary'}`}>
                    <div className="icon-house text-2xl"></div>
                </button>
                
                <button onClick={() => { if(onViewChange) onViewChange('chat'); else window.location.href = 'chat.html'; }} className={`flex flex-col items-center gap-1 transition-colors active:scale-95 ${isChat ? 'text-accent' : 'text-text-secondary hover:text-text-primary'}`}>
                    <div className="icon-message-circle text-2xl"></div>
                </button>

                <button onClick={() => { window.location.href = 'upload.html'; }} className="flex flex-col items-center justify-center w-12 h-12 rounded-full bg-blue-500 text-white shadow-[0_0_15px_rgba(59,130,246,0.5)] hover:bg-blue-600 transition-colors active:scale-95 -mt-6 border-4 border-primary">
                    <div className="icon-plus text-2xl font-bold"></div>
                </button>

                <button onClick={() => { if(onViewChange) onViewChange('video'); else window.location.href = 'index.html?view=video'; }} className={`flex flex-col items-center gap-1 transition-colors active:scale-95 ${isVideo ? 'text-accent' : 'text-text-secondary hover:text-text-primary'}`}>
                    <div className="icon-circle-play text-2xl"></div>
                </button>
                
                <button onClick={() => { if(onViewChange) onViewChange('channel'); window.location.href = `canal.html?uid=${user?.id}`; }} className={`flex flex-col items-center gap-1 transition-colors active:scale-95 ${isOwnChannel ? 'text-accent' : 'text-text-secondary hover:text-text-primary'}`}>
                    <div className="icon-user text-2xl"></div>
                </button>
            </div>

            {/* Desktop Right Sidebar */}
            <div className="hidden md:flex flex-col fixed right-0 top-[60px] bottom-0 w-20 bg-secondary/90 backdrop-blur-lg border-l border-border z-[40] py-6 items-center gap-6 shadow-lg">
                <button onClick={() => { if(onViewChange) onViewChange('feed'); else window.location.href = 'index.html'; }} className={`p-3 rounded-xl transition-all ${isFeed ? 'bg-accent/20 text-accent' : 'text-text-secondary hover:bg-tertiary hover:text-text-primary'}`} title="Início">
                    <div className="icon-house text-2xl"></div>
                </button>
                
                <button onClick={() => { if(onViewChange) onViewChange('chat'); else window.location.href = 'chat.html'; }} className={`p-3 rounded-xl transition-all ${isChat ? 'bg-accent/20 text-accent' : 'text-text-secondary hover:bg-tertiary hover:text-text-primary'}`} title="Mensagens">
                    <div className="icon-message-circle text-2xl"></div>
                </button>

                <button onClick={() => { window.location.href = 'upload.html'; }} className="w-12 h-12 rounded-xl bg-blue-500 text-white flex items-center justify-center hover:bg-blue-600 transition-all shadow-[0_0_15px_rgba(59,130,246,0.4)]" title="Novo Post">
                    <div className="icon-plus text-2xl font-bold"></div>
                </button>

                <button onClick={() => { if(onViewChange) onViewChange('video'); else window.location.href = 'index.html?view=video'; }} className={`p-3 rounded-xl transition-all ${isVideo ? 'bg-accent/20 text-accent' : 'text-text-secondary hover:bg-tertiary hover:text-text-primary'}`} title="Vídeos">
                    <div className="icon-circle-play text-2xl"></div>
                </button>

                <button onClick={() => { if(onViewChange) onViewChange('channel'); window.location.href = `canal.html?uid=${user?.id}`; }} className={`p-3 rounded-xl transition-all ${isOwnChannel ? 'bg-accent/20 text-accent' : 'text-text-secondary hover:bg-tertiary hover:text-text-primary'}`} title="Meu Canal">
                    <div className="icon-user text-2xl"></div>
                </button>
                
                <button onClick={() => { if(showSettingsMenu) showSettingsMenu(); }} className="p-3 rounded-xl text-text-secondary hover:bg-tertiary hover:text-text-primary transition-all" title="Configurações">
                    <div className="icon-settings text-2xl"></div>
                </button>
            </div>
        </React.Fragment>
    );
}

window.AppNavigation = AppNavigation;