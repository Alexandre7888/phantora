function DiscoverPage({ user }) {
    const [suggestions, setSuggestions] = React.useState([]);
    const [currentIndex, setCurrentIndex] = React.useState(0);
    const [loading, setLoading] = React.useState(true);
    const [toast, setToast] = React.useState(null);

    const showToast = (msg) => {
        setToast(msg);
        setTimeout(() => setToast(null), 3000);
    };

    React.useEffect(() => {
        const fetchSuggestions = async () => {
            if (!user) {
                setLoading(false);
                return;
            }

            const db = window.firebaseDB;
            if (!db) return;
            
            const userId = user.id || user.uid;
            if (!userId) {
                setLoading(false);
                return;
            }

            try {
                const currentUserSnap = await db.ref(`users/${userId}`).once('value').catch(() => null);
                const currentUserData = currentUserSnap && currentUserSnap.exists() ? currentUserSnap.val() : {};
                const city = currentUserData.city || user.city;
                const state = currentUserData.state || user.state;

                if (city && state) {
                    const locationSnap = await db.ref(`location_users/${state}/${city}`).once('value').catch(() => null);
                    if (locationSnap && locationSnap.exists()) {
                        const locationData = locationSnap.val();
                        const userIds = Object.keys(locationData).filter(id => id && id.trim() !== '' && id !== userId);
                        
                        const promises = userIds.map(id => db.ref(`users/${id}`).once('value').catch(() => null));
                        const snaps = await Promise.all(promises);
                        
                        const list = snaps
                            .filter(snap => snap && snap.exists())
                            .map(snap => ({ id: snap.key, ...snap.val() }));
                            
                        setSuggestions(list.sort(() => 0.5 - Math.random()));
                    } else {
                        setSuggestions([]);
                    }
                } else {
                    setSuggestions([]);
                }
            } catch (e) {
                console.error("Erro ao buscar pessoas:", e);
            }
            setLoading(false);
        };
        fetchSuggestions();
    }, [user]);

    const handleAction = async (targetUser, action) => {
        const db = window.firebaseDB;
        if (!db) return;
        
        const userId = user.id || user.uid;
        if (!userId) return;
        
        if (action === 'like') {
            await db.ref(`friend_requests/${targetUser.id}/${userId}`).set({
                timestamp: Date.now(),
                status: 'pending',
                requesterName: user.name || user.username || 'Alguém',
                requesterAvatar: user.profilePicture || 'https://via.placeholder.com/150'
            }).catch(console.error);
            showToast(`Pedido de amizade enviado para ${targetUser.name || targetUser.username}`);
        } else {
            await db.ref(`ignored_suggestions/${userId}/${targetUser.id}`).set(Date.now()).catch(console.error);
        }
        
        setCurrentIndex(prev => prev + 1);
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-primary flex items-center justify-center p-4">
                <div className="icon-loader animate-spin text-4xl text-accent"></div>
            </div>
        );
    }

    const currentProfile = suggestions[currentIndex];

    return (
        <div className="min-h-screen bg-primary flex flex-col font-sans animate-fade-in pb-20">
            {toast && (
                <div className="fixed top-20 left-1/2 transform -translate-x-1/2 z-[70] bg-tertiary text-text-primary px-4 py-2 rounded-lg shadow-lg text-sm flex items-center gap-2 animate-fade-in-up border border-border">
                    <div className="icon-info text-accent"></div>
                    {toast}
                </div>
            )}

            <header className="bg-secondary/80 backdrop-blur-lg border-b border-border px-4 py-4 flex items-center sticky top-0 z-10">
                <button onClick={() => window.location.href = 'index.html'} className="text-text-secondary hover:text-text-primary mr-4">
                    <div className="icon-arrow-left text-2xl"></div>
                </button>
                <h1 className="text-xl font-bold text-text-primary">Descobrir Pessoas</h1>
            </header>

            <main className="flex-1 flex flex-col items-center justify-center p-4 sm:p-6 w-full max-w-md mx-auto relative">
                {currentProfile ? (
                    <div className="bg-secondary rounded-3xl w-full overflow-hidden shadow-2xl border border-border flex flex-col relative animate-fade-in-up">
                        <div className="w-full h-96 relative">
                            <img 
                                src={currentProfile.profilePicture || 'https://via.placeholder.com/400'} 
                                className="w-full h-full object-cover absolute inset-0"
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-secondary via-transparent to-transparent"></div>
                        </div>
                        <div className="p-6 text-center relative z-10 -mt-16">
                            <h3 className="text-2xl font-bold text-text-primary">{currentProfile.name || currentProfile.username}</h3>
                            <p className="text-text-muted text-sm mb-2">@{currentProfile.username || (currentProfile.name || 'usuario').toLowerCase().replace(/\s/g, '')}</p>
                            
                            {(currentProfile.city || currentProfile.state) && (
                                <p className="text-text-secondary text-sm flex items-center justify-center gap-1 mt-1 bg-tertiary/50 py-1 px-3 rounded-full inline-flex">
                                    <div className="icon-map-pin text-xs text-accent"></div> 
                                    {currentProfile.city}{currentProfile.city && currentProfile.state ? ', ' : ''}{currentProfile.state}
                                </p>
                            )}
                            
                            <div className="flex justify-center gap-6 mt-8">
                                <button 
                                    onClick={() => handleAction(currentProfile, 'ignore')}
                                    className="w-16 h-16 rounded-full bg-tertiary border border-border text-danger flex items-center justify-center hover:bg-danger/10 hover:border-danger transition-all shadow-lg active:scale-95"
                                >
                                    <div className="icon-x text-3xl"></div>
                                </button>
                                <button 
                                    onClick={() => handleAction(currentProfile, 'like')}
                                    className="w-16 h-16 rounded-full bg-accent text-white flex items-center justify-center hover:bg-accent-hover transition-all shadow-accent active:scale-95"
                                >
                                    <div className="icon-check text-3xl"></div>
                                </button>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="text-center text-text-secondary flex flex-col items-center">
                        <div className="w-24 h-24 bg-tertiary rounded-full flex items-center justify-center mb-6">
                            <div className="icon-users text-4xl text-text-muted"></div>
                        </div>
                        <h2 className="text-xl font-bold text-text-primary mb-2">Fim da linha!</h2>
                        <p className="text-text-muted max-w-xs">Não há mais pessoas próximas para descobrir no momento. Volte mais tarde.</p>
                        <button onClick={() => window.location.href = 'index.html'} className="mt-8 px-6 py-2 bg-tertiary text-text-primary rounded-lg font-semibold hover:bg-border transition-colors">
                            Voltar ao Início
                        </button>
                    </div>
                )}
            </main>
        </div>
    );
}

window.DiscoverPage = DiscoverPage;