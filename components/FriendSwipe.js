function FriendSwipe({ user, onClose }) {
    const [suggestions, setSuggestions] = React.useState([]);
    const [currentIndex, setCurrentIndex] = React.useState(0);
    const [loading, setLoading] = React.useState(true);

    React.useEffect(() => {
        const fetchSuggestions = async () => {
            const db = window.firebaseDB;
            if (!db) return;
            
            const userId = user.id || user.uid;
            if (!userId) {
                setLoading(false);
                return;
            }

            try {
                // Pega a cidade e estado do usuário atual
                const currentUserSnap = await db.ref(`users/${userId}`).once('value').catch(e => {
                    console.warn("Aviso ao ler usuário atual:", e);
                    return null;
                });
                
                const currentUserData = currentUserSnap && currentUserSnap.exists() ? currentUserSnap.val() : {};
                const city = currentUserData.city || user.city;
                const state = currentUserData.state || user.state;

                if (city && state) {
                    // Busca IDs dos usuários na mesma cidade e estado
                    const locationSnap = await db.ref(`location_users/${state}/${city}`).once('value').catch(e => {
                        console.error("Erro ao ler location_users:", e);
                        return null;
                    });
                    
                    if (locationSnap && locationSnap.exists()) {
                        const locationData = locationSnap.val();
                        // Garante que o ID não seja vazio para não consultar a raiz /users acidentalmente
                        const userIds = Object.keys(locationData).filter(id => id && id.trim() !== '' && id !== userId);
                        
                        // Busca os dados completos de cada usuário (trata erro individualmente para não quebrar tudo)
                        const promises = userIds.map(id => 
                            db.ref(`users/${id}`).once('value').catch(e => {
                                console.warn(`Sem permissão para ler perfil ${id}:`, e);
                                return null;
                            })
                        );
                        
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
                console.error("Erro geral no FriendSwipe:", e);
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
                status: 'pending'
            }).catch(console.error);
            // Notificar
            if (window.api && window.api.sendNotification) {
                window.api.sendNotification(targetUser.id, "Novo pedido de amizade", `${user.name || 'Alguém'} quer ser seu amigo!`);
            }
        } else {
            await db.ref(`ignored_suggestions/${userId}/${targetUser.id}`).set(Date.now()).catch(console.error);
        }
        
        setCurrentIndex(prev => prev + 1);
    };

    if (loading) {
        return (
            <div className="fixed inset-0 z-[200] bg-black/80 flex items-center justify-center p-4">
                <div className="icon-loader animate-spin text-4xl text-accent"></div>
            </div>
        );
    }

    const currentProfile = suggestions[currentIndex];

    return (
        <div className="fixed inset-0 z-[200] bg-black/90 flex flex-col items-center justify-center p-4">
            <button onClick={onClose} className="absolute top-6 right-6 text-white hover:text-gray-300">
                <div className="icon-x text-3xl"></div>
            </button>
            
            <h2 className="text-2xl font-bold text-white mb-6">Descobrir Pessoas</h2>
            
            {currentProfile ? (
                <div className="bg-secondary rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl relative">
                    <img 
                        src={currentProfile.profilePicture || 'https://via.placeholder.com/400'} 
                        className="w-full h-80 object-cover"
                    />
                    <div className="p-6 text-center">
                        <h3 className="text-xl font-bold text-primary">{currentProfile.name || currentProfile.username}</h3>
                        {(currentProfile.city || currentProfile.state) && (
                            <p className="text-text-secondary text-sm flex items-center justify-center gap-1 mt-1">
                                <div className="icon-map-pin text-xs"></div> 
                                {currentProfile.city}{currentProfile.city && currentProfile.state ? ', ' : ''}{currentProfile.state}
                            </p>
                        )}
                        
                        <div className="flex justify-center gap-6 mt-6">
                            <button 
                                onClick={() => handleAction(currentProfile, 'ignore')}
                                className="w-14 h-14 rounded-full bg-red-100 text-red-500 flex items-center justify-center hover:bg-red-200 transition-colors shadow-lg"
                            >
                                <div className="icon-x text-2xl"></div>
                            </button>
                            <button 
                                onClick={() => handleAction(currentProfile, 'like')}
                                className="w-14 h-14 rounded-full bg-green-100 text-green-500 flex items-center justify-center hover:bg-green-200 transition-colors shadow-lg"
                            >
                                <div className="icon-check text-2xl"></div>
                            </button>
                        </div>
                    </div>
                </div>
            ) : (
                <div className="text-center text-gray-400">
                    <div className="icon-users text-5xl mx-auto mb-4 opacity-50"></div>
                    <p>Não há mais sugestões no momento.</p>
                </div>
            )}
        </div>
    );
}

window.FriendSwipe = FriendSwipe;