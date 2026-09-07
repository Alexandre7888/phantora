function ChatPage({ user, embedded = false }) {
    const [mutualFriends, setMutualFriends] = React.useState([]);
    const [searchResults, setSearchResults] = React.useState([]);
    const [loading, setLoading] = React.useState(true);
    const [isSearching, setIsSearching] = React.useState(false);
    const [searchQuery, setSearchQuery] = React.useState('');
    const [showSettings, setShowSettings] = React.useState(false);

    React.useEffect(() => {
        const db = window.firebaseDB;
        if (!db) return;

        const fetchAndSyncMutuals = async () => {
            try {
                const existingContactsSnap = await db.ref(`user_contacts/${user.id}`).once('value');
                const existingContacts = existingContactsSnap.val() || {};

                const userChatsSnap = await db.ref(`user_chats/${user.id}`).once('value');
                const userChats = userChatsSnap.val() || {};
                
                const combinedIds = new Set([...Object.keys(existingContacts), ...Object.keys(userChats)]);
                
                const mutuals = [];
                
                for (const uid of combinedIds) {
                    if (uid === user.id) continue;
                    
                    const uSnap = await db.ref(`users/${uid}`).once('value');
                    const uData = uSnap.val();
                    
                    if (uData) {
                        mutuals.push({
                            id: uid,
                            name: uData.name || uData.username || 'Usuário',
                            avatar: uData.profilePicture || 'https://via.placeholder.com/150',
                            username: uData.username || ''
                        });
                    }
                }
                
                mutuals.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
                setMutualFriends(mutuals);
                setLoading(false);
            } catch (e) {
                console.error("Erro ao sincronizar amigos:", e);
                setLoading(false);
            }
        };

        fetchAndSyncMutuals();
    }, [user.id]);

    React.useEffect(() => {
        const db = window.firebaseDB;
        if (!db) return;

        const performSearch = async () => {
            if (searchQuery.trim().length < 2) {
                setSearchResults([]);
                setIsSearching(false);
                return;
            }

            setIsSearching(true);
            try {
                const usersSnap = await db.ref('users').once('value');
                const usersData = usersSnap.val() || {};
                
                const queryLower = searchQuery.toLowerCase();
                const results = [];

                Object.keys(usersData).forEach(uid => {
                    if (uid === user.id) return;
                    
                    const u = usersData[uid];
                    const name = (u.name || '').toLowerCase();
                    const username = (u.username || '').toLowerCase();
                    
                    if (name.includes(queryLower) || username.includes(queryLower)) {
                        results.push({
                            id: uid,
                            name: u.name || u.username || 'Usuário',
                            username: u.username || '',
                            avatar: u.profilePicture || 'https://via.placeholder.com/150'
                        });
                    }
                });

                setSearchResults(results.slice(0, 15)); // max 15 results
            } catch (error) {
                console.error("Erro na pesquisa:", error);
            } finally {
                setIsSearching(false);
            }
        };

        const debounceTimer = setTimeout(performSearch, 500);
        return () => clearTimeout(debounceTimer);
    }, [searchQuery, user.id]);

    const startSession = async (friend) => {
        const db = window.firebaseDB;
        
        try {
            const sortedIds = [user.id, friend.id].sort();
            const sessionId = `dm_${sortedIds[0]}_${sortedIds[1]}`;
            
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

    const displayList = searchQuery.length > 1 ? searchResults : mutualFriends;

    return (
        <div className={`flex flex-col h-full w-full bg-[#0a0a0f] text-gray-100 overflow-hidden font-sans ${!embedded ? 'h-screen' : ''}`} data-name="chat-page">
            {!embedded && window.AppNavigation && (
                <window.AppNavigation 
                    user={user} 
                    currentView="chat" 
                    showSettingsMenu={() => setShowSettings(true)} 
                />
            )}
            
            <div className="flex flex-1 overflow-hidden relative pb-16 md:pb-0">
            {/* Sidebar (Contatos) */}
            <div className={`flex flex-col w-full ${!embedded ? 'md:w-[380px]' : ''} shrink-0 border-r border-[#1a1a24] bg-[#0c0c12]`}>
                
                
                <div className="p-4 border-b border-[#1a1a24]">
                    <div className="relative bg-[#1a1a24] rounded-xl flex items-center px-4 py-3 border border-transparent focus-within:border-blue-500/50 transition-colors">
                        <div className="icon-search text-gray-400 mr-2 text-lg"></div>
                        <input 
                            type="text" 
                            placeholder="Pesquisar usuários para conversar..." 
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="bg-transparent border-none outline-none text-sm text-gray-200 w-full placeholder-gray-500"
                        />
                        {searchQuery && (
                            <button onClick={() => setSearchQuery('')} className="ml-2 text-gray-500 hover:text-gray-300">
                                <div className="icon-x text-sm"></div>
                            </button>
                        )}
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto custom-scrollbar">
                    {loading || isSearching ? (
                        <div className="flex justify-center p-8">
                            <div className="icon-loader animate-spin text-[#667eea] text-2xl"></div>
                        </div>
                    ) : displayList.length === 0 ? (
                        <div className="text-center p-8 text-gray-500 flex flex-col items-center gap-3">
                            <div className="w-16 h-16 bg-[#1a1a24] rounded-full flex items-center justify-center mb-2 shadow-inner">
                                <div className="icon-search text-2xl text-gray-600"></div>
                            </div>
                            <p className="font-medium text-gray-400">Nenhum usuário encontrado</p>
                            {searchQuery.length < 2 && (
                                <p className="text-sm">Você ainda não tem conversas ativas. Pesquise por alguém para começar.</p>
                            )}
                        </div>
                    ) : (
                        <div className="space-y-1 p-2">
                            {searchQuery.length >= 2 && (
                                <div className="px-3 py-2 text-xs font-bold text-gray-500 uppercase tracking-wider">
                                    Resultados da pesquisa
                                </div>
                            )}
                            {displayList.map(friend => (
                                <div 
                                    key={friend.id}
                                    onClick={() => startSession(friend)}
                                    className="flex items-center justify-between p-3 rounded-xl hover:bg-[#1a1a24] cursor-pointer transition-all border border-transparent hover:border-[#2a2a35] group"
                                >
                                    <div className="flex items-center gap-4">
                                        <div className="relative">
                                            <img src={friend.avatar} className="w-12 h-12 rounded-full object-cover shadow-md border border-gray-800" />
                                            <div className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-green-500 border-2 border-[#0c0c12] rounded-full"></div>
                                        </div>
                                        <div>
                                            <h3 className="font-semibold text-gray-100 group-hover:text-blue-400 transition-colors">{friend.name}</h3>
                                            {friend.username && (
                                                <p className="text-xs text-gray-500">@{friend.username}</p>
                                            )}
                                        </div>
                                    </div>
                                    <div className="w-9 h-9 rounded-full bg-[#1a1a24] group-hover:bg-blue-600 group-hover:text-white text-gray-400 flex items-center justify-center transition-all shadow-sm">
                                        <div className="icon-chevron-right text-sm"></div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Placeholder Conversa (Visível apenas no Desktop, quando não embedado) */}
            {!embedded && (
                <div className="hidden md:flex flex-1 flex-col items-center justify-center bg-[#08080c] relative overflow-hidden">
                    <div className="absolute inset-0 opacity-5" style={{backgroundImage: 'radial-gradient(#3b82f6 1px, transparent 1px)', backgroundSize: '30px 30px'}}></div>
                    <div className="z-10 flex flex-col items-center">
                        <div className="w-24 h-24 bg-gradient-to-tr from-blue-600 to-indigo-600 rounded-full flex items-center justify-center mb-6 shadow-lg shadow-blue-900/20">
                            <div className="icon-message-circle text-4xl text-white"></div>
                        </div>
                        <h2 className="text-2xl font-bold text-white tracking-wide">Mensagens Phantora</h2>
                        <p className="text-gray-400 mt-3 text-center max-w-sm">Conecte-se com seus amigos em tempo real. Selecione ou pesquise um contato para iniciar.</p>
                        <button className="mt-8 px-6 py-2.5 bg-[#1a1a24] hover:bg-[#252530] text-gray-300 rounded-full text-sm font-medium transition-colors border border-[#2a2a35]">
                            Suas conversas são seguras
                        </button>
                    </div>
                </div>
            )}
            
            {showSettings && window.SettingsMenu && (
                <window.SettingsMenu isOpen={true} onClose={() => setShowSettings(false)} initialTab="chat" />
            )}
            </div>
        </div>
    );
}

window.ChatPage = ChatPage;
