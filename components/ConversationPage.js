function ConversationPage({ user }) {
    const [sessionData, setSessionData] = React.useState(null);
    const [messages, setMessages] = React.useState([]);
    const [inputText, setInputText] = React.useState('');
    const [loading, setLoading] = React.useState(true);
    const [error, setError] = React.useState(null);
    const [isBlocked, setIsBlocked] = React.useState(false);
    const [hasBlockedMe, setHasBlockedMe] = React.useState(false);
    const [showMenu, setShowMenu] = React.useState(false);
    const [showInfoPanel, setShowInfoPanel] = React.useState(false);
    const [isOtherUserOnline, setIsOtherUserOnline] = React.useState(false);
    const [contactPrivacy, setContactPrivacy] = React.useState({ hideName: false, hideAvatar: false });
    
    // UI states
    const [isRecording, setIsRecording] = React.useState(false);
    const [recordingTime, setRecordingTime] = React.useState(0);

    // Sidebar states (Desktop)
    const [mutualFriends, setMutualFriends] = React.useState([]);
    const [sidebarLoading, setSidebarLoading] = React.useState(true);
    const [searchQuery, setSearchQuery] = React.useState('');

    const settings = window.SettingsManager ? window.SettingsManager.getSettings() : {};

    const fileInputRef = React.useRef(null);
    const mediaRecorderRef = React.useRef(null);
    const audioChunksRef = React.useRef([]);
    const timerIntervalRef = React.useRef(null);
    const messagesEndRef = React.useRef(null);

    const urlParams = new URLSearchParams(window.location.search);
    const sessionId = urlParams.get('session');
    const targetUserId = urlParams.get('other');

    const filteredFriends = React.useMemo(() => {
        return mutualFriends.filter(f => f.name.toLowerCase().includes(searchQuery.toLowerCase()));
    }, [mutualFriends, searchQuery]);

    // Fetch mutual friends for the sidebar
    React.useEffect(() => {
        const fetchMutuals = async () => {
            const db = window.firebaseDB;
            if (!db) return;

            try {
                const followingSnap = await db.ref(`follows/${user.id}`).once('value');
                const following = followingSnap.val() || {};
                const userChatsSnap = await db.ref(`user_chats/${user.id}`).once('value');
                const userChats = userChatsSnap.val() || {};
                const usersSnap = await db.ref('users').once('value');
                const users = usersSnap.val() || {};

                const contactIds = new Set([...Object.keys(following), ...Object.keys(userChats)]);
                const mutuals = [];

                for (const uid of contactIds) {
                    if (uid === user.id) continue;
                    
                    if (users[uid]) {
                        let canSeeProfile = true;
                        if (window.PrivacyManager) {
                            canSeeProfile = await window.PrivacyManager.checkVisibility(uid, user.id, 'profile');
                        }
                        mutuals.push({
                            id: uid,
                            name: users[uid].name || users[uid].username || 'Usuário',
                            avatar: canSeeProfile ? (users[uid].profilePicture || 'https://via.placeholder.com/150') : 'https://via.placeholder.com/150'
                        });
                    }
                }
                setMutualFriends(mutuals);
            } catch (e) {
                console.error("Erro ao buscar amigos:", e);
            } finally {
                setSidebarLoading(false);
            }
        };

        fetchMutuals();
    }, [user.id]);

    React.useEffect(() => {
        if (!sessionId) {
            setError("Sessão inválida.");
            setLoading(false);
            return;
        }

        const db = window.firebaseDB;
        if (!db) return;

        // Se temos o targetUserId da URL, usamos ele para construir a sessão local
        const targetId = targetUserId || sessionId.replace('dm_', '').replace(user.id, '').replace('_', '');
        
        const sessionRef = db.ref(`user_chats/${user.id}/${targetId}`);
        
        const listener = sessionRef.on('value', (snap) => {
            const data = snap.val();
            if (!data) {
                // Se a sessão não existir no perfil do usuário, pode ser uma entrada direta pela URL
                // Tentamos validar apenas pelos IDs
                if (sessionId && sessionId.includes(user.id)) {
                    // Sessão válida, continuamos
                } else {
                    setError("Sessão não encontrada.");
                    setLoading(false);
                    return;
                }
            }

            const otherUserId = data ? data.otherUserId : targetId;
            
            // Check block status
            db.ref(`blocks/${user.id}/${otherUserId}`).on('value', snap => setIsBlocked(snap.exists()));
            db.ref(`blocks/${otherUserId}/${user.id}`).on('value', snap => setHasBlockedMe(snap.exists()));
            db.ref(`user_specific_privacy/${user.id}/${otherUserId}`).on('value', snap => {
                if (snap.exists()) {
                    setContactPrivacy(snap.val());
                } else {
                    setContactPrivacy({ hideName: false, hideAvatar: false });
                }
            });
            
            // Listen to other user's online status
            db.ref(`status/${otherUserId}/state`).on('value', snap => {
                setIsOtherUserOnline(snap.val() === 'online');
            });

            db.ref(`users/${otherUserId}`).once('value').then(async uSnap => {
                const u = uSnap.val();
                if (u) {
                    let canSeeProfile = true;
                    if (window.PrivacyManager) {
                        canSeeProfile = await window.PrivacyManager.checkVisibility(otherUserId, user.id, 'profile');
                    }
                    
                    setSessionData({
                        id: sessionId,
                        otherUser: {
                            id: otherUserId,
                            name: u.name || u.username || 'Usuário',
                            avatar: canSeeProfile ? (u.profilePicture || 'https://via.placeholder.com/150') : 'https://via.placeholder.com/150'
                        }
                    });
                    setLoading(false);
                }
            });
        });

        return () => {
            sessionRef.off('value', listener);
        };
    }, [sessionId, user.id]);

    React.useEffect(() => {
        if (!sessionData) return;
        const db = window.firebaseDB;
        
        // P2P initialization
        if (window.ChatP2P) {
            window.ChatP2P.initPeer(
                user.id,
                (msg) => {
                    // P2P Message received
                    setMessages(prev => {
                        // Evita duplicatas
                        if (prev.find(m => m.id === msg.id)) return prev;
                        return [...prev, msg].sort((a, b) => a.timestamp - b.timestamp);
                    });
                    setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
                },
                null,
                (status) => {
                    if (status === 'online') {
                        window.ChatP2P.connectToPeer(user.id, sessionData.otherUser.id);
                    }
                }
            );
        }

        const messagesRef = db.ref(`chat_messages/${sessionData.id}`);
        
        const listener = messagesRef.on('value', (snap) => {
            const data = snap.val();
            if (data) {
                const msgs = Object.keys(data).map(key => ({ id: key, ...data[key] }));
                
                // Se eu bloqueei o usuário, ignoro as mensagens que ele manda
                const validMsgs = msgs.filter(m => !(isBlocked && m.senderId !== user.id));

                // Merge with existing local messages to keep P2P and Firebase messages
                setMessages(prev => {
                    const newMsgs = [...prev];
                    validMsgs.forEach(m => {
                        if (!newMsgs.find(existing => existing.id === m.id)) {
                            newMsgs.push(m);
                        }
                    });
                    return newMsgs.sort((a, b) => a.timestamp - b.timestamp);
                });

                // Apagar mensagens que são para nós e acabamos de ler (ou que bloqueamos)
                const updates = {};
                msgs.forEach(msg => {
                    if (msg.senderId !== user.id) {
                        // Apaga permanentemente do servidor após visualizar
                        updates[msg.id] = null;
                    }
                });
                
                if (Object.keys(updates).length > 0) {
                    messagesRef.update(updates);
                }

                setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
            }
        });

        return () => {
            messagesRef.off('value', listener);
        };
    }, [sessionData, user.id]);

    const exitChat = async () => {
        window.location.href = 'chat.html';
    };

    const startSession = async (friend) => {
        const db = window.firebaseDB;
        const sortedIds = [user.id, friend.id].sort();
        const newSessionId = `dm_${sortedIds[0]}_${sortedIds[1]}`;

        await db.ref(`user_chats/${user.id}/${friend.id}`).update({
            sessionId: newSessionId,
            otherUserId: friend.id,
            lastAccessed: Date.now()
        });
        
        await db.ref(`user_chats/${friend.id}/${user.id}`).update({
            sessionId: newSessionId,
            otherUserId: user.id,
            lastAccessed: Date.now()
        });

        window.location.href = `conversation.html?session=${newSessionId}&other=${friend.id}`;
    };

    const handleBlockUser = async () => {
        if (!sessionData) return;
        const db = window.firebaseDB;
        if (isBlocked) {
            await db.ref(`blocks/${user.id}/${sessionData.otherUser.id}`).remove();
        } else {
            await db.ref(`blocks/${user.id}/${sessionData.otherUser.id}`).set(true);
        }
    };

    const togglePrivacy = async (setting) => {
        if (!sessionData) return;
        const db = window.firebaseDB;
        const newValue = !contactPrivacy[setting];
        await db.ref(`user_specific_privacy/${user.id}/${sessionData.otherUser.id}/${setting}`).set(newValue);
    };

    const handleSendMessage = async (type = 'text', mediaUrl = null) => {
        // Se EU bloqueei (isBlocked), não envio. Se FUI bloqueado (hasBlockedMe), posso enviar (mas ele não vai ver).
        if ((!inputText.trim() && !mediaUrl) || !sessionData || isBlocked) return;

        const db = window.firebaseDB;
        const textToSend = inputText.trim();
        if (type === 'text') setInputText('');

        const msgData = {
            senderId: user.id,
            type: type,
            timestamp: Date.now(),
            read: false,
            isHidden: settings.chatNameVisibility === 'none',
            customNickname: settings.chatNickname || ''
        };

        if (type === 'text') msgData.text = textToSend;
        else if (type === 'audio') msgData.audioUrl = mediaUrl;
        else if (type === 'image') {
            msgData.imageUrl = mediaUrl;
            if (textToSend) msgData.text = textToSend;
        }

        try {
            await db.ref(`chat_messages/${sessionData.id}`).push(msgData);
        } catch (e) {
            console.error("Erro ao enviar:", e);
        }
    };

    const handleImageUpload = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onloadend = () => handleSendMessage('image', reader.result);
    };

    const startRecording = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            mediaRecorderRef.current = new MediaRecorder(stream);
            audioChunksRef.current = [];

            mediaRecorderRef.current.ondataavailable = e => {
                if (e.data.size > 0) audioChunksRef.current.push(e.data);
            };

            mediaRecorderRef.current.onstop = async () => {
                const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
                const reader = new FileReader();
                reader.readAsDataURL(audioBlob);
                reader.onloadend = () => handleSendMessage('audio', reader.result);
            };

            mediaRecorderRef.current.start();
            setIsRecording(true);
            setRecordingTime(0);
            timerIntervalRef.current = setInterval(() => setRecordingTime(prev => prev + 1), 1000);
        } catch (err) {
            alert("Não foi possível acessar o microfone.");
        }
    };

    const stopRecording = () => {
        if (mediaRecorderRef.current && isRecording) {
            mediaRecorderRef.current.stop();
            mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
            setIsRecording(false);
            clearInterval(timerIntervalRef.current);
        }
    };

    const cancelRecording = () => {
        if (mediaRecorderRef.current && isRecording) {
            mediaRecorderRef.current.onstop = null;
            mediaRecorderRef.current.stop();
            mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
            setIsRecording(false);
            clearInterval(timerIntervalRef.current);
        }
    };

    const formatTime = (seconds) => {
        const m = Math.floor(seconds / 60).toString().padStart(2, '0');
        const s = (seconds % 60).toString().padStart(2, '0');
        return `${m}:${s}`;
    };

    if (loading) {
        return <div className="h-screen w-full flex items-center justify-center text-white">Carregando...</div>;
    }

    if (error) {
        return (
            <div className="h-screen w-full flex flex-col items-center justify-center bg-[#0a0a0f] text-center p-4">
                <div className="w-20 h-20 bg-red-500/10 rounded-full flex items-center justify-center mb-4 text-red-500">
                    <div className="icon-triangle-alert text-3xl"></div>
                </div>
                <h2 className="text-xl font-bold text-white mb-2">Conversa Indisponível</h2>
                <p className="text-gray-400 mb-6">{error}</p>
                <button onClick={() => window.location.href = 'chat.html'} className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-full transition">
                    Voltar aos Contatos
                </button>
            </div>
        );
    }

    const { otherUser } = sessionData;

    return (
        <div className="flex h-screen w-full bg-[#0a0a0f] text-gray-100 font-sans overflow-hidden">
            
            {/* Sidebar (Desktop Only) */}
            <div className="hidden md:flex flex-col w-[380px] shrink-0 border-r border-[#1a1a24] bg-[#0c0c12]">
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
                    {sidebarLoading ? (
                        <div className="flex justify-center p-8">
                            <div className="icon-loader animate-spin text-[#667eea] text-2xl"></div>
                        </div>
                    ) : filteredFriends.length === 0 ? (
                        <div className="text-center p-8 text-gray-500 flex flex-col items-center gap-3">
                            <p className="text-sm">Nenhum contato encontrado.</p>
                        </div>
                    ) : (
                        <div className="space-y-2 pb-6">
                            {filteredFriends.map(friend => (
                                <div 
                                    key={friend.id}
                                    onClick={() => startSession(friend)}
                                    className={`flex items-center justify-between p-3 rounded-xl cursor-pointer transition-colors border ${friend.id === otherUser.id ? 'bg-[#1a1a24] border-[#2a2a35]' : 'bg-[#13131a] hover:bg-[#1a1a24] border-transparent hover:border-[#2a2a35]'}`}
                                >
                                    <div className="flex items-center gap-4">
                                        <img src={friend.avatar} className="w-10 h-10 rounded-full object-cover shadow-sm border border-gray-800" />
                                        <h3 className="font-semibold text-gray-100 text-sm">{friend.name}</h3>
                                    </div>
                                    <div className="w-6 h-6 rounded-full bg-indigo-600/10 text-indigo-400 flex items-center justify-center">
                                        <div className="icon-message-circle text-xs"></div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Main Chat Area */}
            <div className="flex-1 flex flex-col min-w-0 bg-[#08080c] relative">
                {/* Header */}
                <div className="h-24 pt-6 border-b border-[#1a1a24] bg-[#0c0c12]/90 backdrop-blur-md px-4 flex items-center justify-between z-10 shrink-0">
                    <div className="flex items-center gap-3">
                        <button onClick={exitChat} className="md:hidden text-gray-400 hover:text-white p-2">
                            <div className="icon-arrow-left text-xl"></div>
                        </button>
                        <div className="flex items-center gap-3 cursor-pointer hover:bg-gray-800/50 p-1.5 rounded-xl transition" onClick={() => setShowInfoPanel(true)}>
                            <div className="relative">
                                <img src={otherUser.avatar} className="w-11 h-11 rounded-full object-cover border border-gray-700" />
                                {settings.chatOnlineVisibility !== 'none' && !hasBlockedMe && isOtherUserOnline && (
                                    <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-[#0c0c12] rounded-full"></div>
                                )}
                            </div>
                            <div>
                                <h2 className="font-bold text-white text-[16px]">{otherUser.name}</h2>
                                {settings.chatOnlineVisibility !== 'none' && !hasBlockedMe && isOtherUserOnline && (
                                    <p className="text-[12px] text-green-500 font-medium">Online</p>
                                )}
                            </div>
                        </div>
                    </div>
                    <div className="relative">
                        <button onClick={() => setShowMenu(!showMenu)} className="p-2 text-gray-400 hover:text-white rounded-full hover:bg-[#13131a] transition">
                            <div className="icon-more-vertical text-xl"></div>
                        </button>
                        {showMenu && (
                            <div className="absolute right-0 mt-2 w-48 bg-[#1a1a24] border border-[#2a2a35] rounded-xl shadow-xl overflow-hidden z-50">
                                <button onClick={() => { setShowInfoPanel(true); setShowMenu(false); }} className="w-full text-left px-4 py-3 text-white hover:bg-[#2a2a35] transition font-medium text-sm flex items-center gap-2">
                                    <div className="icon-info text-lg text-gray-400"></div>
                                    Informações
                                </button>
                                <button onClick={() => { handleBlockUser(); setShowMenu(false); }} className="w-full text-left px-4 py-3 text-red-400 hover:bg-[#2a2a35] transition font-medium text-sm flex items-center gap-2">
                                    <div className="icon-ban text-lg"></div>
                                    {isBlocked ? 'Desbloquear Usuário' : 'Bloquear Usuário'}
                                </button>
                            </div>
                        )}
                    </div>
                </div>

                {/* Contact Info Panel Modal (External Component) */}
                <window.ContactInfoModal 
                    isOpen={showInfoPanel} 
                    onClose={() => setShowInfoPanel(false)}
                    otherUser={otherUser}
                    contactPrivacy={contactPrivacy}
                    togglePrivacy={togglePrivacy}
                    isBlocked={isBlocked}
                    hasBlockedMe={hasBlockedMe}
                    handleBlockUser={handleBlockUser}
                />

                {/* Messages */}
                <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4 custom-scrollbar pb-8">
                    {messages.map((msg) => {
                        const isMe = msg.senderId === user.id;
                        const showAvatar = !isMe && !msg.isHidden;
                        const senderName = isMe ? 'Você' : (msg.isHidden ? 'Anônimo' : (msg.customNickname || otherUser.name));
                        
                        return (
                            <div key={msg.id} className={`flex w-full ${isMe ? 'justify-end' : 'justify-start'}`}>
                                <div className={`flex gap-3 max-w-[85%] md:max-w-[70%] ${isMe ? 'flex-row-reverse' : ''} relative`}>
                                    {showAvatar && <img src={otherUser.avatar} className="w-8 h-8 rounded-full object-cover mt-auto mb-1 shrink-0" />}
                                    {msg.isHidden && !isMe && (
                                        <div className="w-8 h-8 rounded-full bg-gray-800 flex items-center justify-center mt-auto mb-1 shrink-0 text-gray-400">
                                            <div className="icon-user text-sm"></div>
                                        </div>
                                    )}
                                    
                                    <div className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                                        {!isMe && <span className="text-[11px] text-gray-500 mb-1 ml-1 font-medium">{senderName}</span>}
                                        
                                        <div className="relative group flex items-center gap-2">
                                            <div className={`relative px-4 py-2.5 rounded-2xl shadow-sm text-[14.5px] leading-relaxed break-words ${isMe ? 'bg-gradient-to-tr from-indigo-600 to-purple-600 text-white rounded-br-sm' : 'bg-[#1a1a24] text-gray-100 rounded-bl-sm border border-gray-800/50'}`}>
                                                {msg.type === 'audio' && (
                                                    <div className="py-1 min-w-[200px]">
                                                        {window.CustomAudioPlayer ? (
                                                            <window.CustomAudioPlayer src={msg.audioUrl} isOwn={isMe} />
                                                        ) : (
                                                            <audio controls src={msg.audioUrl} className="w-full h-10 outline-none" />
                                                        )}
                                                    </div>
                                                )}
                                                {msg.type === 'image' && (
                                                    <div className="mb-1">
                                                        <img src={msg.imageUrl} className="max-w-full rounded-lg max-h-64 object-cover" />
                                                    </div>
                                                )}
                                                {(msg.type === 'text' || (msg.type === 'image' && msg.text)) && <span>{msg.text}</span>}
                                                <div className={`flex items-center justify-end gap-1 mt-1.5 ${isMe ? 'text-indigo-200' : 'text-gray-500'} text-[10px] font-medium`}>
                                                    {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                    {isMe && (
                                                        <div className={`text-[14px] leading-none ${msg.read ? 'text-blue-500' : 'text-indigo-300/60'}`}>
                                                            <div className="icon-check-check"></div>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                    <div ref={messagesEndRef} />
                </div>

                {/* Input Wrapper */}
                <div className="px-3 md:px-6 pb-12 md:pb-16 pt-2 mt-auto bg-transparent shrink-0">
                    {isBlocked ? (
                        <div className="bg-[#1a1a24] border border-[#2a2a35] rounded-2xl p-4 text-center text-gray-400 text-sm">
                            Você bloqueou este usuário. Desbloqueie para enviar mensagens.
                        </div>
                    ) : (
                    <div className="bg-[#0c0c12] border border-[#1a1a24] rounded-3xl p-2 shadow-lg">
                        {isRecording ? (
                            <div className="flex items-center justify-between px-3 py-1 border border-red-500/30 rounded-2xl bg-[#13131a]">
                                <div className="flex items-center gap-3 text-red-500">
                                    <div className="w-3 h-3 rounded-full bg-red-500 animate-pulse"></div>
                                    <span className="font-mono font-bold">{formatTime(recordingTime)}</span>
                                </div>
                                <div className="flex items-center gap-4">
                                    <button onClick={cancelRecording} className="text-gray-400 hover:text-red-500 text-sm font-medium transition">Cancelar</button>
                                    <button onClick={stopRecording} className="w-9 h-9 rounded-full bg-indigo-600 text-white flex items-center justify-center shadow-lg hover:bg-indigo-500 transition-transform active:scale-95">
                                        <div className="icon-send text-sm mr-0.5"></div>
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <div className="flex items-center gap-2 bg-[#13131a] rounded-2xl p-1 pr-2">
                                <input type="file" ref={fileInputRef} onChange={handleImageUpload} accept="image/*" className="hidden" />
                                <button onClick={() => fileInputRef.current?.click()} className="w-10 h-10 rounded-full text-gray-400 hover:text-white hover:bg-gray-800 flex items-center justify-center transition shrink-0">
                                    <div className="icon-paperclip text-xl"></div>
                                </button>
                                <input 
                                    type="text"
                                    value={inputText}
                                    onChange={(e) => setInputText(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && handleSendMessage('text')}
                                    placeholder="Digite uma mensagem..."
                                    className="flex-1 bg-transparent text-white text-[15px] outline-none placeholder-gray-500 py-2.5 min-w-0"
                                />
                                {inputText.trim() ? (
                                    <button 
                                        onClick={() => handleSendMessage('text')}
                                        className="w-10 h-10 rounded-full bg-indigo-600 text-white flex items-center justify-center shadow-md hover:bg-indigo-500 transition-all active:scale-95 shrink-0"
                                    >
                                        <div className="icon-send text-[17px] mr-0.5"></div>
                                    </button>
                                ) : (
                                    <button 
                                        onClick={startRecording}
                                        className="w-10 h-10 rounded-full bg-[#1a1a24] text-gray-300 flex items-center justify-center border border-[#2a2a35] hover:bg-gray-800 transition-colors shrink-0"
                                    >
                                        <div className="icon-mic text-[18px]"></div>
                                    </button>
                                )}
                            </div>
                        )}
                    </div>
                    )}
                </div>

            </div>
        </div>
    );
}

window.ConversationPage = ConversationPage;