function FriendRequestNotification({ user }) {
    const [requests, setRequests] = React.useState([]);

    React.useEffect(() => {
        if (!user || !user.id || !window.firebaseDB) return;

        const requestsRef = window.firebaseDB.ref(`friend_requests/${user.id}`);
        const listener = requestsRef.on('value', (snapshot) => {
            if (snapshot.exists()) {
                const data = snapshot.val();
                const reqList = Object.keys(data).map(key => ({
                    id: key,
                    ...data[key]
                })).filter(req => req.status === 'pending');
                setRequests(reqList);
            } else {
                setRequests([]);
            }
        });

        return () => {
            requestsRef.off('value', listener);
        };
    }, [user]);

    const handleAccept = async (requesterId) => {
        const db = window.firebaseDB;
        if (!db) return;

        try {
            // Aceitar: ambos se seguem
            await db.ref(`follows/${user.id}/${requesterId}`).set(true);
            await db.ref(`follows/${requesterId}/${user.id}`).set(true);

            // Remover notificação
            await db.ref(`friend_requests/${user.id}/${requesterId}`).remove();
            
            // Criar chat opcional
            const chatId = [user.id, requesterId].sort().join('_');
            const chatUpdateUser = { targetId: requesterId, type: 'private', lastMessage: "Vocês agora são amigos!", timestamp: Date.now() };
            const chatUpdateRequester = { targetId: user.id, type: 'private', lastMessage: "Vocês agora são amigos!", timestamp: Date.now() };
            
            await db.ref(`users/${user.id}/chats/${chatId}`).set(chatUpdateUser);
            await db.ref(`users/${requesterId}/chats/${chatId}`).set(chatUpdateRequester);

        } catch (error) {
            console.error("Erro ao aceitar amizade:", error);
        }
    };

    const handleReject = async (requesterId) => {
        const db = window.firebaseDB;
        if (!db) return;

        try {
            await db.ref(`friend_requests/${user.id}/${requesterId}`).remove();
        } catch (error) {
            console.error("Erro ao rejeitar amizade:", error);
        }
    };

    if (requests.length === 0) return null;

    return (
        <div className="fixed top-20 right-4 z-[100] flex flex-col gap-3 max-w-sm w-[calc(100%-2rem)] md:w-full">
            {requests.map(req => (
                <div key={req.id} className="bg-secondary border border-border shadow-xl rounded-2xl p-4 flex items-center gap-3 animate-slide-up relative overflow-hidden group">
                    <div className="absolute left-0 top-0 bottom-0 w-1 bg-accent"></div>
                    <img 
                        src={req.requesterAvatar || 'https://via.placeholder.com/150'} 
                        className="w-12 h-12 rounded-full object-cover border border-border"
                    />
                    <div className="flex-1 min-w-0">
                        <p className="text-sm text-text-primary font-medium">
                            <span className="font-bold block text-base truncate">{req.requesterName}</span>
                            enviou um pedido de amizade!
                        </p>
                        <div className="flex gap-2 mt-2">
                            <button 
                                onClick={() => handleAccept(req.id)}
                                className="flex-1 bg-accent text-white py-1.5 rounded-lg text-xs font-bold hover:bg-accent-hover transition-colors"
                            >
                                Aceitar
                            </button>
                            <button 
                                onClick={() => handleReject(req.id)}
                                className="flex-1 bg-tertiary text-text-secondary py-1.5 rounded-lg text-xs font-bold hover:bg-border transition-colors border border-border"
                            >
                                Recusar
                            </button>
                        </div>
                    </div>
                </div>
            ))}
        </div>
    );
}

window.FriendRequestNotification = FriendRequestNotification;