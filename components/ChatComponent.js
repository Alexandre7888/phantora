function ChatComponent({ user, onClose }) {
    const [mutualFriends, setMutualFriends] = React.useState([]);
    const [activeChat, setActiveChat] = React.useState(null);
    const [messages, setMessages] = React.useState([]);
    const [inputText, setInputText] = React.useState('');
    const [loading, setLoading] = React.useState(true);
    
    // Chat Options State
    const [showOptions, setShowOptions] = React.useState(false);
    const [showSettings, setShowSettings] = React.useState(false);
    const [showNicknameModal, setShowNicknameModal] = React.useState(false);
    const [newNickname, setNewNickname] = React.useState('');
    const [nicknames, setNicknames] = React.useState({});
    
    // Chat Privacy Settings
    const [chatSettings, setChatSettings] = React.useState({ hideIdentity: false });
    const [remoteSettings, setRemoteSettings] = React.useState({});
    
    // Phase 1 Features State
    const [remoteTyping, setRemoteTyping] = React.useState(false);
    const [remoteStatus, setRemoteStatus] = React.useState({ online: false, lastSeen: null });
    
    // Audio Recording State
    const [isRecording, setIsRecording] = React.useState(false);
    const [recordingTime, setRecordingTime] = React.useState(0);
    const mediaRecorderRef = React.useRef(null);
    const audioChunksRef = React.useRef([]);
    const timerIntervalRef = React.useRef(null);

    const messagesEndRef = React.useRef(null);
    const typingTimeoutRef = React.useRef(null);

    React.useEffect(() => {
        const fetchMutuals = async () => {
            const db = window.firebaseDB;
            if (!db) return;

            try {
                const followingSnap = await db.ref(`follows/${user.id}`).once('value');
                const following = followingSnap.val() || {};
                const mutuals = [];
                const usersSnap = await db.ref('users').once('value');
                const users = usersSnap.val() || {};

                for (const uid of Object.keys(following)) {
                    const followedBackSnap = await db.ref(`follows/${uid}/${user.id}`).once('value');
                    if (followedBackSnap.exists() && users[uid]) {
                        let canSeeProfile = true;
                        if (window.PrivacyManager) {
                            canSeeProfile = await window.PrivacyManager.checkVisibility(uid, user.id, 'profile');
                        }
                        
                        mutuals.push({
                            id: uid,
                            name: users[uid].chatNickname || users[uid].name || users[uid].username || 'Usuário',
                            avatar: canSeeProfile ? (users[uid].profilePicture || 'https://via.placeholder.com/150') : 'https://via.placeholder.com/150'
                        });
                    }
                }
                setMutualFriends(mutuals);
            } catch (e) {
                console.error("Erro ao buscar amigos mútuos:", e);
            } finally {
                setLoading(false);
            }
        };

        fetchMutuals();

        const params = new URLSearchParams(window.location.search);
        const chatId = params.get('chat');
        if (chatId) {
            window.firebaseDB.ref(`users/${chatId}`).once('value').then(async snap => {
                const u = snap.val();
                if (u) {
                    let canSeeProfile = true;
                    if (window.PrivacyManager) {
                        canSeeProfile = await window.PrivacyManager.checkVisibility(chatId, user.id, 'profile');
                    }
                    
                    setActiveChat({
                        id: chatId,
                        name: u.chatNickname || u.name || u.username || 'Usuário',
                        avatar: canSeeProfile ? (u.profilePicture || 'https://via.placeholder.com/150') : 'https://via.placeholder.com/150'
                    });
                }
            });
        }
    }, [user.id]);

    React.useEffect(() => {
        const url = new URL(window.location);
        if (activeChat) {
            url.searchParams.set('chat', activeChat.id);
        } else {
            url.searchParams.delete('chat');
        }
        window.history.pushState({}, '', url);
    }, [activeChat]);

    React.useEffect(() => {
        if (!activeChat) return;

        const db = window.firebaseDB;
        if (!db) return;

        const chatId = [user.id, activeChat.id].sort().join('_');
        
        // Listen for messages
        const messagesRef = db.ref(`chats/${chatId}/messages`);
        const listener = messagesRef.on('value', (snap) => {
            const data = snap.val();
            if (data) {
                const msgs = Object.keys(data).map(key => ({
                    id: key,
                    ...data[key]
                }));
                
                // Mark unread messages as seen if I'm the receiver
                let updated = false;
                msgs.forEach(msg => {
                    if (msg.senderId !== user.id && msg.status !== 'seen') {
                        db.ref(`chats/${chatId}/messages/${msg.id}`).update({ status: 'seen' });
                        updated = true;
                    }
                });

                setMessages(msgs);
                if (!updated) {
                    setTimeout(() => {
                        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
                    }, 100);
                }
            } else {
                setMessages([]);
            }
        });

        // Listen for remote typing
        const typingRef = db.ref(`chats/${chatId}/typing/${activeChat.id}`);
        const typingListener = typingRef.on('value', snap => {
            setRemoteTyping(!!snap.val());
        });

        // Listen for remote status
        const statusRef = db.ref(`users/${activeChat.id}/status`);
        const statusListener = statusRef.on('value', snap => {
            if (snap.val()) setRemoteStatus(snap.val());
        });

        return () => {
            messagesRef.off('value', listener);
            typingRef.off('value', typingListener);
            statusRef.off('value', statusListener);
        };
    }, [activeChat, user.id]);

    const handleTyping = (e) => {
        setInputText(e.target.value);
        if (!activeChat) return;
        
        const db = window.firebaseDB;
        const chatId = [user.id, activeChat.id].sort().join('_');
        db.ref(`chats/${chatId}/typing/${user.id}`).set(true);

        if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = setTimeout(() => {
            db.ref(`chats/${chatId}/typing/${user.id}`).set(false);
        }, 1500);
    };

    const encryptText = (text, chatId) => {
        try {
            if (window.CryptoUtils) {
                return window.CryptoUtils.encrypt(text, chatId);
            } else if (window.CryptoJS) {
                return window.CryptoJS.AES.encrypt(text, chatId).toString();
            }
        } catch(err) {
            console.error("Erro na criptografia:", err);
        }
        return "ERRO_CRIPTOGRAFIA: " + text;
    };

    const decryptText = (encrypted, chatId) => {
        try {
            if (window.CryptoUtils) {
                return window.CryptoUtils.decrypt(encrypted, chatId);
            }
        } catch(err) {}
        return encrypted;
    };

    const handleSendMessage = async (textToSend = inputText, type = 'text', mediaUrl = null) => {
        if ((!textToSend.trim() && !mediaUrl) || !activeChat) return;

        const db = window.firebaseDB;
        if (!db) return;

        const chatId = [user.id, activeChat.id].sort().join('_');
        
        if (type === 'text') setInputText('');
        
        db.ref(`chats/${chatId}/typing/${user.id}`).set(false);

        const encryptedText = type === 'text' ? encryptText(textToSend.trim(), chatId) : '';

        const msgData = {
            senderId: user.id,
            type: type,
            timestamp: Date.now(),
            status: 'sent'
        };

        if (type === 'text') {
            msgData.text = encryptedText;
        } else if (type === 'audio') {
            msgData.audioUrl = mediaUrl; // Presumindo CDN Pantora URL ou base64
        }

        try {
            await db.ref(`chats/${chatId}/messages`).push(msgData);

            await db.ref(`users/${user.id}/chats/${activeChat.id}`).update({
                lastMessage: type === 'audio' ? '🎵 Áudio' : encryptedText,
                timestamp: Date.now()
            });
            await db.ref(`users/${activeChat.id}/chats/${user.id}`).update({
                lastMessage: type === 'audio' ? '🎵 Áudio' : encryptedText,
                timestamp: Date.now()
            });
        } catch (e) {
            console.error("Erro ao enviar mensagem:", e);
        }
    };

    // --- Audio Recording Logic ---
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
                const file = new File([audioBlob], `audio_${Date.now()}.webm`, { type: 'audio/webm' });
                
                let audioUrl = "";
                try {
                    if (window.api && window.api.uploadToCDN) {
                        // Tenta usar a CDN Phantora primariamente
                        audioUrl = await window.api.uploadToCDN(file, user.id, 'audios_chat');
                    } else if (window.uploadMedia) {
                        audioUrl = await window.uploadMedia(audioBlob);
                    }
                } catch(e) { 
                    console.error("Erro no upload de áudio:", e); 
                }
                
                if (!audioUrl) {
                    // Fallback para base64 apenas se tudo falhar
                    const reader = new FileReader();
                    reader.readAsDataURL(audioBlob);
                    reader.onloadend = () => {
                        handleSendMessage('', 'audio', reader.result);
                    };
                    return;
                }

                handleSendMessage('', 'audio', audioUrl);
            };

            mediaRecorderRef.current.start();
            setIsRecording(true);
            setRecordingTime(0);
            
            timerIntervalRef.current = setInterval(() => {
                setRecordingTime(prev => prev + 1);
            }, 1000);

        } catch (err) {
            console.error("Erro ao acessar microfone", err);
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
            mediaRecorderRef.current.onstop = null; // Prevent sending
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

    const renderMessageStatus = (msg) => {
        if (msg.senderId !== user.id) return null;
        if (msg.status === 'seen') return <div className="icon-check-check text-blue-400 text-xs ml-1"></div>;
        if (msg.status === 'delivered') return <div className="icon-check-check text-gray-300 text-xs ml-1"></div>;
        return <div className="icon-check text-gray-300 text-xs ml-1"></div>;
    };

    const renderDateSeparator = (timestamp, prevTimestamp) => {
        const date = new Date(timestamp).toLocaleDateString();
        const prevDate = prevTimestamp ? new Date(prevTimestamp).toLocaleDateString() : null;
        
        if (date !== prevDate) {
            const today = new Date().toLocaleDateString();
            const yesterday = new Date(Date.now() - 86400000).toLocaleDateString();
            let label = date;
            if (date === today) label = "Hoje";
            else if (date === yesterday) label = "Ontem";
            
            return (
                <div className="flex justify-center my-4">
                    <span className="bg-tertiary/50 text-text-muted text-xs font-medium px-3 py-1 rounded-full border border-border">
                        {label}
                    </span>
                </div>
            );
        }
        return null;
    };

    return (
        <div className="fixed inset-0 bg-primary z-[80] flex flex-col animate-fade-in-up">
            <div className="bg-secondary border-b border-border p-3 flex items-center gap-3 shrink-0">
                <button onClick={() => activeChat ? setActiveChat(null) : onClose()} className="p-2 rounded-full text-text-secondary hover:text-text-primary hover:bg-tertiary transition-colors">
                    <div className="icon-arrow-left text-xl"></div>
                </button>
                {activeChat ? (
                    <div className="flex items-center justify-between w-full">
                        <div className="flex items-center gap-3">
                            <div className="relative">
                                <img src={activeChat.avatar} className="w-10 h-10 rounded-full object-cover border border-border" />
                                {remoteStatus.online && (
                                    <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-secondary rounded-full"></div>
                                )}
                            </div>
                            <div className="flex flex-col">
                                <h2 className="font-bold text-primary leading-tight">{activeChat.name}</h2>
                                <span className="text-xs text-text-muted">
                                    {remoteTyping ? (
                                        <span className="text-accent animate-pulse">digitando...</span>
                                    ) : remoteStatus.online ? (
                                        <span className="text-green-500">Online</span>
                                    ) : remoteStatus.lastSeen ? (
                                        `Visto por último às ${new Date(remoteStatus.lastSeen).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}`
                                    ) : 'Offline'}
                                </span>
                            </div>
                        </div>
                        <button onClick={() => setShowSettings(true)} className="p-2 rounded-full text-text-secondary hover:text-text-primary hover:bg-tertiary transition-colors">
                            <div className="icon-more-vertical text-xl"></div>
                        </button>
                    </div>
                ) : (
                    <h2 className="font-bold text-lg text-primary">Mensagens</h2>
                )}
            </div>

            <div className="flex-1 overflow-hidden relative bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] bg-opacity-5">
                {activeChat ? (
                    <div className="absolute inset-0 flex flex-col bg-primary/95 backdrop-blur-sm">
                        <div className="flex-1 overflow-y-auto p-4 space-y-4">
                            {messages.length === 0 ? (
                                <div className="text-center text-text-muted mt-10">
                                    <div className="icon-message-circle text-4xl mb-2 opacity-50 mx-auto"></div>
                                    <p>Nenhuma mensagem ainda. Dê um oi!</p>
                                </div>
                            ) : (
                                messages.map((msg, idx) => {
                                    const isMe = msg.senderId === user.id;
                                    const chatId = [user.id, activeChat.id].sort().join('_');
                                    let displayText = msg.text;
                                    
                                    if (msg.type === 'text') {
                                        displayText = decryptText(msg.text, chatId);
                                    }

                                    return (
                                        <React.Fragment key={msg.id}>
                                            {renderDateSeparator(msg.timestamp, idx > 0 ? messages[idx-1].timestamp : null)}
                                            
                                            <div className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                                                <div className={`max-w-[80%] rounded-2xl p-3 shadow-sm ${isMe ? 'bg-accent text-white rounded-br-sm' : 'bg-secondary text-primary border border-border rounded-bl-sm'}`}>
                                                    
                                                    {msg.type === 'shared_video' && (
                                                        <div className="cursor-pointer hover:opacity-90" onClick={() => window.location.href = msg.postUrl}>
                                                            <div className="flex items-center gap-2 mb-2 text-xs font-bold opacity-80">
                                                                <div className="icon-share-2"></div> Vídeo Compartilhado
                                                            </div>
                                                            {msg.mediaUrl && <img src={msg.mediaUrl} className="w-full rounded-lg mb-2 object-cover max-h-40 bg-black" />}
                                                            <p className="text-sm font-semibold">{msg.postTitle}</p>
                                                        </div>
                                                    )}

                                                    {msg.type === 'audio' && (
                                                        <div className="flex items-center gap-2 w-48">
                                                            <audio controls src={msg.audioUrl} className="w-full h-8 outline-none" />
                                                        </div>
                                                    )}

                                                    {msg.type === 'text' && (
                                                        <p className="text-[15px] whitespace-pre-wrap break-words leading-relaxed">{displayText}</p>
                                                    )}

                                                    <div className={`flex items-center justify-end gap-1 mt-1 ${isMe ? 'text-indigo-200' : 'text-text-muted'}`}>
                                                        <span className="text-[10px]">
                                                            {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                        </span>
                                                        {renderMessageStatus(msg)}
                                                    </div>
                                                </div>
                                            </div>
                                        </React.Fragment>
                                    );
                                })
                            )}
                            <div ref={messagesEndRef} />
                        </div>
                        
                        <div className="p-3 bg-secondary border-t border-border pb-safe">
                            {isRecording ? (
                                <div className="flex items-center justify-between bg-tertiary rounded-full px-4 py-2 border border-red-500/30">
                                    <div className="flex items-center gap-3 text-red-500">
                                        <div className="w-3 h-3 rounded-full bg-red-500 animate-pulse"></div>
                                        <span className="font-mono font-bold">{formatTime(recordingTime)}</span>
                                    </div>
                                    <div className="flex items-center gap-4">
                                        <button onClick={cancelRecording} className="text-text-muted hover:text-red-500 text-sm font-medium">Cancelar</button>
                                        <button onClick={stopRecording} className="w-8 h-8 rounded-full bg-accent text-white flex items-center justify-center shadow-lg hover:bg-accent-hover transition-transform active:scale-95">
                                            <div className="icon-send text-sm"></div>
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <div className="flex gap-2 items-end">
                                    <div className="flex-1 bg-tertiary rounded-2xl border border-border focus-within:border-accent flex items-center min-h-[44px]">
                                        <input 
                                            type="text"
                                            value={inputText}
                                            onChange={handleTyping}
                                            onKeyDown={(e) => e.key === 'Enter' && handleSendMessage(inputText, 'text')}
                                            placeholder="Mensagem..."
                                            className="w-full bg-transparent text-primary px-4 py-2 text-[15px] outline-none placeholder:text-text-muted"
                                        />
                                    </div>
                                    
                                    {inputText.trim() ? (
                                        <button 
                                            onClick={() => handleSendMessage(inputText, 'text')}
                                            className="w-11 h-11 rounded-full bg-accent text-white flex items-center justify-center shadow-sm hover:bg-accent-hover transition-transform active:scale-95 shrink-0"
                                        >
                                            <div className="icon-send text-[18px]"></div>
                                        </button>
                                    ) : (
                                        <button 
                                            onClick={startRecording}
                                            className="w-11 h-11 rounded-full bg-tertiary text-primary flex items-center justify-center border border-border hover:bg-border transition-colors shrink-0"
                                        >
                                            <div className="icon-mic text-[20px]"></div>
                                        </button>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                ) : (
                    <div className="h-full overflow-y-auto p-4">
                        {loading ? (
                            <div className="flex justify-center mt-10">
                                <div className="icon-loader text-2xl animate-spin text-accent"></div>
                            </div>
                        ) : mutualFriends.length === 0 ? (
                            <div className="text-center text-text-muted mt-10">
                                <div className="icon-users text-4xl mb-2 opacity-50 mx-auto"></div>
                                <p>Você ainda não tem amigos para conversar.</p>
                                <p className="text-sm mt-2">Para conversar, os dois precisam se seguir mutuamente.</p>
                            </div>
                        ) : (
                            <div className="space-y-2">
                                <p className="text-xs font-bold text-text-secondary uppercase mb-4 px-2">Seus Amigos ({mutualFriends.length})</p>
                                {mutualFriends.map(friend => (
                                    <div 
                                        key={friend.id} 
                                        onClick={() => setActiveChat(friend)}
                                        className="flex items-center gap-4 p-3 rounded-xl hover:bg-tertiary cursor-pointer transition-colors"
                                    >
                                        <img src={friend.avatar} className="w-14 h-14 rounded-full object-cover border border-border" />
                                        <div className="flex-1 border-b border-border/50 pb-3">
                                            <div className="flex justify-between items-baseline mb-1">
                                                <h3 className="font-bold text-primary text-[15px]">{friend.name}</h3>
                                            </div>
                                            <p className="text-[13px] text-text-muted line-clamp-1">Toque para conversar</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>
            
            {showSettings && window.SettingsMenu && (
                <window.SettingsMenu isOpen={true} onClose={() => setShowSettings(false)} />
            )}
        </div>
    );
}

window.ChatComponent = ChatComponent;