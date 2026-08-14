function ChatPage({ user }) {
    const [mutualFriends, setMutualFriends] = React.useState([]);
    const [loading, setLoading] = React.useState(true);
    const [searchQuery, setSearchQuery] = React.useState('');

    const filteredFriends = React.useMemo(() => {
        return mutualFriends.filter(f => f.name.toLowerCase().includes(searchQuery.toLowerCase()));
    }, [mutualFriends, searchQuery]);

    React.useEffect(() => {
        const db = window.firebaseDB;
        if (!db) return;

        const fetchAndSyncMutuals = async () => {
            try {
                const followingSnap = await db.ref(`follows/${user.id}`).once('value');
                const following = followingSnap.val() || {};
                const userChatsSnap = await db.ref(`user_chats/${user.id}`).once('value');
                const userChats = userChatsSnap.val() || {};
                const usersSnap = await db.ref('users').once('value');
                const users = usersSnap.val() || {};
                
                const existingContactsSnap = await db.ref(`user_contacts/${user.id}`).once('value');
                const existingContacts = existingContactsSnap.val() || {};

                const contactIds = new Set([...Object.keys(following), ...Object.keys(userChats), ...Object.keys(existingContacts)]);
                const mutuals = [];
                const updates = {};

                for (const uid of contactIds) {
                    if (uid === user.id) continue;
                    
                    const existingContact = existingContacts[uid] || {};
                    
                    // Se o contato estiver marcado como bloqueado na lista local, mantemos os dados locais e ignoramos a atualização com os dados da rede social
                    if (existingContact.blocked === true) {
                        mutuals.push({
                            id: uid,
                            name: existingContact.name || 'Usuário',
                            avatar: existingContact.avatar || 'https://via.placeholder.com/150',
                            blocked: true
                        });
                        continue;
                    }

                    if (users[uid]) {
                        let canSeeProfile = true;
                        let canSeeName = true;
                        if (window.PrivacyManager) {
                            canSeeProfile = await window.PrivacyManager.checkVisibility(uid, user.id, 'profile');
                            canSeeName = await window.PrivacyManager.checkVisibility(uid, user.id, 'name');
                        }
                        
                        const whiteImageBase64 = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+ip1sAAAAASUVORK5CYII=";

                        const nameToSet = canSeeName ? (users[uid].name || users[uid].username || 'Usuário') : 'Nome não cadastrado';
                        const avatarToSet = canSeeProfile ? (users[uid].profilePicture || 'https://via.placeholder.com/150') : whiteImageBase64;

                        mutuals.push({
                            id: uid,
                            name: nameToSet,
                            avatar: avatarToSet
                        });

                        updates[uid] = {
                            name: nameToSet,
                            avatar: avatarToSet,
                            updatedAt: Date.now()
                        };
                    } else if (existingContact.name) {
                        // Mantém contatos antigos que talvez não estejam mais na lista de usuários (para não quebrar o chat)
                        mutuals.push({
                            id: uid,
                            name: existingContact.name,
                            avatar: existingContact.avatar
                        });
                    }
                }
                
                // Sincronizar contatos atualizados no Firebase em um nó específico
                try {
                    if (Object.keys(updates).length > 0) {
                        await db.ref(`user_contacts/${user.id}`).update(updates);
                    }
                } catch (syncError) {
                    console.error("Erro ao sincronizar contatos no Firebase:", syncError);
                }
            } catch (e) {
                console.error("Erro ao sincronizar amigos:", e);
            }
        };

        fetchAndSyncMutuals();

        // Listener em tempo real para refletir mudanças do Firebase na interface
        const contactsRef = db.ref(`user_contacts/${user.id}`);
        const handleContactsUpdate = (snapshot) => {
            const data = snapshot.val() || {};
            const contactsList = Object.keys(data).map(key => ({
                id: key,
                name: data[key].name,
                avatar: data[key].avatar,
                updatedAt: data[key].updatedAt
            }));
            
            // Ordenar por nome
            contactsList.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
            
            setMutualFriends(contactsList);
            setLoading(false);
        };

        contactsRef.on('value', handleContactsUpdate);

        return () => {
            contactsRef.off('value', handleContactsUpdate);
        };
    }, [user.id]);

    const startSession = async (friend) => {
        const db = window.firebaseDB;
        
        try {
            const sortedIds = [user.id, friend.id].sort();
            const sessionId = `dm_${sortedIds[0]}_${sortedIds[1]}`;
            
            // Cria o registro da sessão no caminho de ambos os usuários
            await db.ref(`user_chats/${user.id}/${friend.id}`).update({
                sessionId: sessionId,
                otherUserId: friend.id,
                lastAccessed: Date.now()
            });
            
            await db.ref(`user_chats/${friend.id}/${user.id}`).update({
                sessionId: sessionId,
                otherUserId: user.id,
                lastAccessed: Date.now()
            });
            
            window.location.href = `conversation.html?session=${sessionId}&other=${friend.id}`;
        } catch (e) {
            console.error("Erro ao iniciar a conversa:", e);
        }
    };

    return (
        <div className="flex h-screen w-full bg-[#0a0a0f] text-gray-100 overflow-hidden font-sans">
            {/* Sidebar (Contatos) */}
            <div className="flex flex-col w-full md:w-[380px] shrink-0 border-r border-[#1a1a24] bg-[#0c0c12]">
                <div className="p-4 pt-6 flex items-center justify-between border-b border-[#1a1a24]">
                    <div className="flex items-center gap-3">
                        <button onClick={() => window.location.href = 'index.html'} className="text-gray-400 hover:text-white p-2">
                            <div className="icon-arrow-left text-xl"></div>
                        </button>
                        <h1 className="text-xl font-bold text-white tracking-wide">Mensagens</h1>
                    </div>
                </div>
                
                <div className="p-4">
                    <div className="relative bg-[#1a1a24] rounded-xl flex items-center px-4 py-2.5">
                        <div className="icon-search text-gray-400 mr-2 text-lg"></div>
                        <input 
                            type="text" 
                            placeholder="Buscar amigos para conversar..." 
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="bg-transparent border-none outline-none text-sm text-gray-200 w-full placeholder-gray-500"
                        />
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto px-4 custom-scrollbar">
                    {loading ? (
                        <div className="flex justify-center p-8">
                            <div className="icon-loader animate-spin text-[#667eea] text-2xl"></div>
                        </div>
                    ) : filteredFriends.length === 0 ? (
                        <div className="text-center p-8 text-gray-500 flex flex-col items-center gap-3">
                            <div className="w-16 h-16 bg-[#1a1a24] rounded-full flex items-center justify-center">
                                <div className="icon-users text-2xl text-gray-600"></div>
                            </div>
                            <p>Você precisa ter amigos (seguidores mútuos) para iniciar uma conversa.</p>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {filteredFriends.map(friend => (
                                <div 
                                    key={friend.id}
                                    onClick={() => startSession(friend)}
                                    className="flex items-center justify-between p-3 rounded-xl bg-[#13131a] hover:bg-[#1a1a24] cursor-pointer transition-colors border border-transparent hover:border-[#2a2a35]"
                                >
                                    <div className="flex items-center gap-4">
                                        <img src={friend.avatar} className="w-12 h-12 rounded-full object-cover shadow-sm border border-gray-800" />
                                        <h3 className="font-semibold text-gray-100">{friend.name}</h3>
                                    </div>
                                    <div className="w-8 h-8 rounded-full bg-indigo-600/10 text-indigo-400 flex items-center justify-center">
                                        <div className="icon-message-circle text-sm"></div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Placeholder Conversa (Visível apenas no Desktop) */}
            <div className="hidden md:flex flex-1 flex-col items-center justify-center bg-[#08080c]">
                <div className="w-24 h-24 bg-[#13131a] rounded-full flex items-center justify-center mb-6 shadow-lg border border-[#1a1a24]">
                    <div className="icon-message-circle text-4xl text-indigo-500"></div>
                </div>
                <h2 className="text-2xl font-bold text-gray-200">Suas Mensagens</h2>
                <p className="text-gray-500 mt-2 text-center max-w-sm">Selecione um contato na barra lateral para iniciar ou continuar uma conversa.</p>
            </div>
        </div>
    );
}

window.ChatPage = ChatPage;
