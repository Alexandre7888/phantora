function DiscoverPage({ user }) {
    const [suggestions, setSuggestions] = React.useState([]);
    const [currentIndex, setCurrentIndex] = React.useState(0);
    const [loading, setLoading] = React.useState(true);
    const [error, setError] = React.useState('');
    const [toast, setToast] = React.useState(null);
    const [isActing, setIsActing] = React.useState(false);

    const showToast = React.useCallback((message, type = 'info') => {
        setToast({ message, type });
    }, []);

    React.useEffect(() => {
        if (!toast) return undefined;
        const timeout = window.setTimeout(() => setToast(null), 3500);
        return () => window.clearTimeout(timeout);
    }, [toast]);

    const loadSuggestions = React.useCallback(async () => {
        if (!user) {
            setLoading(false);
            return;
        }

        const db = window.firebaseDB;
        const userId = user.id || user.uid;
        if (!db || !userId) {
            setError('Não foi possível carregar as sugestões. Atualize a página e tente novamente.');
            setLoading(false);
            return;
        }

        setLoading(true);
        setError('');
        setCurrentIndex(0);
        try {
            const currentUserSnap = await db.ref(`users/${userId}`).once('value');
            const currentUser = currentUserSnap.exists() ? currentUserSnap.val() : user;
            const city = currentUser.city || user.city;
            const state = currentUser.state || user.state;

            if (!city || !state) {
                setSuggestions([]);
                return;
            }

            const [locationSnap, ignoredSnap] = await Promise.all([
                db.ref(`location_users/${state}/${city}`).once('value'),
                db.ref(`ignored_suggestions/${userId}`).once('value')
            ]);
            const ignored = ignoredSnap.exists() ? ignoredSnap.val() : {};
            const userIds = locationSnap.exists()
                ? Object.keys(locationSnap.val()).filter((id) => id && id !== userId && !ignored[id])
                : [];
            const profiles = await Promise.all(userIds.map(async (id) => {
                const snap = await db.ref(`users/${id}`).once('value');
                return snap.exists() ? { id: snap.key, ...snap.val() } : null;
            }));

            const shuffled = profiles.filter(Boolean);
            for (let i = shuffled.length - 1; i > 0; i -= 1) {
                const j = Math.floor(Math.random() * (i + 1));
                [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
            }
            setSuggestions(shuffled);
        } catch (loadError) {
            console.error('Erro ao buscar pessoas:', loadError);
            setError('Não foi possível atualizar as sugestões agora. Tente novamente.');
            setSuggestions([]);
        } finally {
            setLoading(false);
        }
    }, [user]);

    React.useEffect(() => {
        loadSuggestions();
    }, [loadSuggestions]);

    const handleAction = async (targetUser, action) => {
        const db = window.firebaseDB;
        const userId = user && (user.id || user.uid);
        if (!db || !userId || isActing) return;

        setIsActing(true);
        try {
            if (action === 'like') {
                await db.ref(`friend_requests/${targetUser.id}/${userId}`).set({
                    timestamp: Date.now(),
                    status: 'pending',
                    requesterName: user.name || user.username || 'Alguém',
                    requesterAvatar: user.profilePicture || ''
                });
                showToast(`Pedido enviado para ${profileName(targetUser)}.`, 'success');
            } else {
                await db.ref(`ignored_suggestions/${userId}/${targetUser.id}`).set(Date.now());
                showToast('Sugestão removida.', 'info');
            }
            setCurrentIndex((index) => index + 1);
        } catch (actionError) {
            console.error('Erro ao atualizar sugestão:', actionError);
            showToast('Não foi possível salvar sua ação. Tente novamente.', 'error');
        } finally {
            setIsActing(false);
        }
    };

    if (loading) {
        return <LoadingScreen />;
    }

    if (!user) {
        return <EmptyState icon="icon-log-in" title="Entre para descobrir pessoas" description="Faça login na Phantora para ver sugestões da sua região." actionLabel="Ir para o início" onAction={() => { window.location.href = 'index.html'; }} />;
    }

    const currentProfile = suggestions[currentIndex];
    return (
        <div className="min-h-screen bg-primary font-sans text-text-primary">
            <header className="sticky top-0 z-20 border-b border-border bg-primary/85 backdrop-blur-xl">
                <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-4 sm:px-6">
                    <button onClick={() => { window.location.href = 'index.html'; }} className="inline-flex items-center gap-2 rounded-lg px-2 py-2 text-sm font-medium text-text-secondary transition hover:bg-tertiary hover:text-text-primary focus:outline-none focus:ring-2 focus:ring-accent" aria-label="Voltar ao início">
                        <span className="icon-arrow-left text-xl" aria-hidden="true"></span><span className="hidden sm:inline">Início</span>
                    </button>
                    <div className="text-center"><p className="text-sm font-bold text-text-primary">Descobrir</p><p className="text-xs text-text-muted">Pessoas perto de você</p></div>
                    <button onClick={loadSuggestions} className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-text-secondary transition hover:bg-tertiary hover:text-text-primary focus:outline-none focus:ring-2 focus:ring-accent" aria-label="Atualizar sugestões"><span className="icon-refresh-cw text-lg" aria-hidden="true"></span></button>
                </div>
            </header>

            <main className="mx-auto flex min-h-[calc(100vh-64px)] w-full max-w-md flex-col justify-center px-4 py-8 sm:px-6">
                {toast && <div role="status" className={`fixed left-1/2 top-20 z-30 flex -translate-x-1/2 items-center gap-2 rounded-xl border px-4 py-3 text-sm shadow-lg ${toast.type === 'error' ? 'border-danger/40 bg-danger/15 text-red-100' : 'border-border bg-tertiary text-text-primary'}`}><span className={toast.type === 'success' ? 'icon-check-circle text-success' : 'icon-info text-accent'} aria-hidden="true"></span>{toast.message}</div>}
                {error ? <EmptyState icon="icon-wifi-off" title="Não foi possível carregar" description={error} actionLabel="Tentar novamente" onAction={loadSuggestions} /> : currentProfile ? <ProfileCard profile={currentProfile} position={currentIndex + 1} total={suggestions.length} isActing={isActing} onAction={handleAction} /> : <EmptyState icon="icon-users" title="Você viu todas as sugestões" description="Novas pessoas aparecerão aqui quando estiverem disponíveis na sua região." actionLabel="Atualizar" onAction={loadSuggestions} />}
            </main>
        </div>
    );
}

function profileName(profile) { return profile.name || profile.username || 'esta pessoa'; }

function LoadingScreen() { return <div className="flex min-h-screen items-center justify-center bg-primary"><div className="flex flex-col items-center gap-3 text-text-secondary"><span className="icon-loader animate-spin text-3xl text-accent" aria-hidden="true"></span><span className="text-sm">Buscando pessoas para você...</span></div></div>; }

function EmptyState({ icon, title, description, actionLabel, onAction }) { return <section className="rounded-3xl border border-border bg-secondary p-8 text-center shadow-card"><div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-violet-500/10"><span className={`${icon} text-3xl text-accent-light`} aria-hidden="true"></span></div><h1 className="mt-6 text-xl font-bold text-text-primary">{title}</h1><p className="mt-2 text-sm leading-6 text-text-secondary">{description}</p><button onClick={onAction} className="mt-7 rounded-xl bg-accent px-5 py-3 text-sm font-semibold text-white transition hover:bg-accent-hover focus:outline-none focus:ring-2 focus:ring-accent-light">{actionLabel}</button></section>; }

function ProfileCard({ profile, position, total, isActing, onAction }) {
    const [imageError, setImageError] = React.useState(false);
    const name = profileName(profile);
    const username = profile.username || name.toLowerCase().replace(/\s+/g, '');
    const location = [profile.city, profile.state].filter(Boolean).join(', ');
    return <article className="overflow-hidden rounded-3xl border border-border bg-secondary shadow-card"><div className="relative h-[25rem] bg-tertiary">{profile.profilePicture && !imageError ? <img src={profile.profilePicture} alt={`Foto de perfil de ${name}`} className="h-full w-full object-cover" onError={() => setImageError(true)} /> : <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-violet-600/40 to-indigo-800/40"><span className="icon-user-round text-7xl text-violet-200/80" aria-hidden="true"></span></div>}<div className="absolute inset-0 bg-gradient-to-t from-secondary via-secondary/15 to-transparent"></div><div className="absolute left-5 top-5 rounded-full border border-white/10 bg-black/30 px-3 py-1 text-xs font-medium text-white backdrop-blur">Sugestão {position} de {total}</div></div><div className="relative -mt-20 px-6 pb-7 text-center"><h1 className="text-2xl font-bold text-white">{name}</h1><p className="mt-1 text-sm text-text-muted">@{username}</p>{location && <p className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-tertiary px-3 py-1.5 text-sm text-text-secondary"><span className="icon-map-pin text-accent" aria-hidden="true"></span>{location}</p>}<p className="mt-5 text-sm leading-6 text-text-secondary">Conheça essa pessoa e envie um pedido de amizade para começar uma nova conexão.</p><div className="mt-7 flex items-center justify-center gap-5"><button disabled={isActing} onClick={() => onAction(profile, 'ignore')} className="flex h-14 w-14 items-center justify-center rounded-full border border-border bg-tertiary text-danger transition hover:border-danger hover:bg-danger/10 disabled:cursor-not-allowed disabled:opacity-50" aria-label={`Pular ${name}`}><span className="icon-x text-2xl" aria-hidden="true"></span></button><button disabled={isActing} onClick={() => onAction(profile, 'like')} className="flex h-14 min-w-36 items-center justify-center gap-2 rounded-full bg-accent px-5 text-sm font-semibold text-white shadow-accent transition hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50"><span className="icon-user-plus text-lg" aria-hidden="true"></span>{isActing ? 'Enviando...' : 'Conectar'}</button></div></div></article>;
}

window.DiscoverPage = DiscoverPage;
