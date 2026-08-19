function SettingsMenu({ isOpen, onClose, initialTab = 'geral' }) {
    const [activeTab, setActiveTab] = React.useState(initialTab);
    const [deferredPrompt, setDeferredPrompt] = React.useState(null);
    const [isInstalled, setIsInstalled] = React.useState(false);

    // Load real settings state
    const [settings, setSettings] = React.useState(window.SettingsManager.getSettings());
    const [chatNickname, setChatNickname] = React.useState(window.currentUserData?.chatNickname || '');
    const [showCustomListModal, setShowCustomListModal] = React.useState(null); 
    const [contacts, setContacts] = React.useState([]);
    const [permissions, setPermissions] = React.useState({});

    React.useEffect(() => {
        const fetchData = async () => {
            if (!window.firebaseDB || !window.currentUserData) return;
            try {
                const uid = window.currentUserData.uid || window.currentUserData.userKey;
                
                // Busca apenas os contatos com quem o usuário tem vínculo
                const contactsSnap = await window.firebaseDB.ref(`user_contacts/${uid}`).once('value');
                const userContacts = contactsSnap.val() || {};
                
                const permsSnap = await window.firebaseDB.ref(`permissions/${uid}`).once('value');
                const perms = permsSnap.val() || {};

                const contactsList = [];
                for (const fid of Object.keys(userContacts)) {
                    contactsList.push({
                        id: fid,
                        name: userContacts[fid].name || 'Usuário',
                        avatar: userContacts[fid].avatar || 'https://via.placeholder.com/150'
                    });
                }
                
                // Ordenar alfabeticamente
                contactsList.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
                
                setContacts(contactsList);
                setPermissions(perms);
            } catch (e) {
                console.error("Erro ao buscar dados:", e);
            }
        };
        fetchData();
    }, []);

    const togglePermission = async (friendId, type, value) => {
        if (!window.firebaseDB || !window.currentUserData) return;
        const uid = window.currentUserData.uid || window.currentUserData.userKey;
        await window.firebaseDB.ref(`permissions/${uid}/${friendId}`).update({
            [type]: value
        });
        setPermissions(prev => ({
            ...prev,
            [friendId]: {
                ...(prev[friendId] || {}),
                [type]: value
            }
        }));
    };

    React.useEffect(() => {
        // PWA Install Event
        const handleBeforeInstallPrompt = (e) => {
            e.preventDefault();
            setDeferredPrompt(e);
            setIsInstalled(false);
        };

        window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

        // Check if already installed
        if (window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true) {
            setIsInstalled(true);
        }

        return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    }, []);

    const handleInstallClick = async () => {
        if (deferredPrompt) {
            deferredPrompt.prompt();
            const { outcome } = await deferredPrompt.userChoice;
            if (outcome === 'accepted') {
                setIsInstalled(true);
            }
            setDeferredPrompt(null);
        }
    };

    const updateSetting = (key, value) => {
        const newSettings = { ...settings, [key]: value };
        setSettings(newSettings);
        window.SettingsManager.saveSettings(newSettings);
    };

    const [showDeviceManager, setShowDeviceManager] = React.useState(false);

    const tabs = [
        { id: 'geral', label: 'Geral', icon: 'smartphone' },
        { id: 'experiencia', label: 'Experiência', icon: 'flask-conical' }
    ];

    if (!isOpen) return null;

    if (showDeviceManager) {
        return <window.DeviceManager onClose={() => setShowDeviceManager(false)} />;
    }

    const renderTabContent = () => {
        switch (activeTab) {
            case 'geral':
                return (
                    <div className="space-y-6 animate-fade-in">
                        <div className="bg-indigo-50 p-4 rounded-xl flex items-center justify-between border border-indigo-100">
                            <div>
                                <h4 className="font-bold text-indigo-900">Aplicativo PWA</h4>
                                <p className="text-sm text-indigo-700">Instale para acesso rápido e offline</p>
                            </div>
                            {isInstalled ? (
                                <span className="px-3 py-1 bg-green-100 text-green-700 text-sm font-bold rounded-full flex items-center gap-1"><div className="icon-check"></div> Instalado</span>
                            ) : (
                                <button onClick={handleInstallClick} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold shadow transition-colors">
                                    Instalar App
                                </button>
                            )}
                        </div>

                        <div>
                            <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-3">Perfil de Chat</h3>
                            <div className="bg-gray-50 p-4 rounded-xl mb-6 space-y-4">
                                <div>
                                    <span className="font-medium text-gray-700 text-sm block mb-2">Foto de Perfil</span>
                                    <div className="flex items-center gap-4">
                                        <img src={window.currentUserData?.profilePicture || window.currentUserData?.avatar || 'https://via.placeholder.com/150'} className="w-16 h-16 rounded-full object-cover border border-gray-200" />
                                        <div className="flex-1">
                                            <input 
                                                type="file" 
                                                id="profilePicInput" 
                                                accept="image/*" 
                                                className="hidden" 
                                                onChange={async (e) => {
                                                    const file = e.target.files[0];
                                                    if (!file) return;
                                                    
                                                    const btn = document.getElementById('uploadPicBtn');
                                                    const oldText = btn.innerText;
                                                    btn.innerText = 'Enviando...';
                                                    btn.disabled = true;

                                                    try {
                                                        const reader = new FileReader();
                                                        const base64 = await new Promise((resolve, reject) => {
                                                            reader.onload = () => resolve(reader.result);
                                                            reader.onerror = () => reject(new Error("Erro ao ler imagem"));
                                                            reader.readAsDataURL(file);
                                                        });

                                                        const API = "https://script.google.com/macros/s/AKfycbxJj1Q68v6io5oyF-GDvuJldJ_JunJo-YeU-gGfgOYmdeeUTXjnBovcWRBU7Kbt22-v/exec";
                                                        const response = await fetch(API, {
                                                            method: "POST",
                                                            headers: { "Content-Type": "text/plain" },
                                                            body: JSON.stringify({
                                                                action: "upload",
                                                                file: base64,
                                                                fileName: `avatar_${window.currentUserData.uid || window.currentUserData.userKey}_${Date.now()}.jpg`
                                                            })
                                                        });
                                                        
                                                        const result = JSON.parse(await response.text());
                                                        if (result.success && result.url) {
                                                            let newUrl = result.url;
                                                            // Versionamento para quebrar cache
                                                            const currentUrl = window.currentUserData.profilePicture || window.currentUserData.avatar || '';
                                                            let version = 1;
                                                            if (currentUrl.includes('?v=')) {
                                                                const match = currentUrl.match(/\?v=(\d+)/);
                                                                if (match) version = parseInt(match[1]) + 1;
                                                            }
                                                            newUrl = `${newUrl}?v=${version}`;

                                                            const uid = window.currentUserData.uid || window.currentUserData.userKey;
                                                            await window.firebaseDB.ref(`users/${uid}`).update({
                                                                profilePicture: newUrl,
                                                                avatar: newUrl
                                                            });
                                                            
                                                            window.currentUserData.profilePicture = newUrl;
                                                            window.currentUserData.avatar = newUrl;
                                                            
                                                            alert("Foto de perfil atualizada com sucesso!");
                                                            // Force re-render of this component to show new image
                                                            setSettings({...settings}); 
                                                        } else {
                                                            alert("Erro ao enviar: " + (result.error || "Desconhecido"));
                                                        }
                                                    } catch (err) {
                                                        alert("Erro: " + err.message);
                                                    } finally {
                                                        btn.innerText = oldText;
                                                        btn.disabled = false;
                                                    }
                                                }}
                                            />
                                            <button 
                                                id="uploadPicBtn"
                                                onClick={() => document.getElementById('profilePicInput').click()}
                                                className="px-4 py-2 bg-indigo-100 text-indigo-700 rounded-lg font-bold text-sm hover:bg-indigo-200 transition"
                                            >
                                                Alterar Foto
                                            </button>
                                        </div>
                                    </div>
                                </div>
                                <label className="block mb-2 border-t pt-4">
                                    <span className="font-medium text-gray-700 text-sm">Apelido no Chat</span>
                                    <p className="text-xs text-gray-500 mb-2">Esse nome aparecerá apenas nas mensagens, escondendo seu nome real.</p>
                                    <div className="flex gap-2">
                                        <input 
                                            type="text" 
                                            value={chatNickname}
                                            onChange={e => setChatNickname(e.target.value)}
                                            placeholder="Seu apelido..."
                                            className="flex-1 bg-white border border-gray-200 rounded-lg px-3 py-2 outline-none focus:border-indigo-500"
                                        />
                                        <button 
                                            onClick={async () => {
                                                if (window.firebaseDB && window.currentUserData) {
                                                    const uid = window.currentUserData.uid || window.currentUserData.userKey;
                                                    await window.firebaseDB.ref(`users/${uid}`).update({ chatNickname: chatNickname });
                                                    window.currentUserData.chatNickname = chatNickname;
                                                    alert("Apelido salvo!");
                                                }
                                            }}
                                            className="px-4 py-2 bg-indigo-600 text-white rounded-lg font-bold text-sm hover:bg-indigo-700"
                                        >
                                            Salvar
                                        </button>
                                    </div>
                                </label>
                            </div>

                            <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-3">Dispositivos</h3>
                            <div className="bg-gray-50 p-4 rounded-xl">
                                <button 
                                    onClick={() => setShowDeviceManager(true)}
                                    className="w-full flex items-center justify-between p-3 bg-white border border-gray-200 rounded-lg hover:bg-indigo-50 hover:border-indigo-200 transition-colors group"
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-600">
                                            <div className="icon-monitor-smartphone text-xl"></div>
                                        </div>
                                        <div className="text-left">
                                            <h4 className="font-bold text-gray-800 group-hover:text-indigo-700">Dispositivos Conectados</h4>
                                            <p className="text-xs text-gray-500">Conectar Computador, Celular ou TV</p>
                                        </div>
                                    </div>
                                    <div className="icon-chevron-right text-gray-400"></div>
                                </button>
                            </div>
                        </div>

                        <div>
                            <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-3">Aparência</h3>
                            <div className="space-y-4 bg-gray-50 p-4 rounded-xl">
                                <div className="flex justify-between items-center">
                                    <span className="font-medium text-gray-700">Tema</span>
                                    <select value={settings.theme} onChange={e => updateSetting('theme', e.target.value)} className="bg-white border border-gray-200 rounded-lg px-3 py-1.5 outline-none">
                                        <option value="claro">Claro</option>
                                        <option value="escuro">Escuro</option>
                                    </select>
                                </div>
                            </div>
                        </div>
                    </div>
                );
            case 'chat':
                return (
                    <div className="space-y-6 animate-fade-in">
                        <div>
                            <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-3">Privacidade nas Mensagens</h3>
                            <div className="space-y-4 bg-gray-50 p-4 rounded-xl">
                                
                                <div className="space-y-1">
                                    <label className="font-medium text-gray-700 text-sm">Quem pode ver meu Nome</label>
                                    <select 
                                        value={settings.chatNameVisibility || 'all'} 
                                        onChange={e => updateSetting('chatNameVisibility', e.target.value)} 
                                        className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 outline-none mb-2"
                                    >
                                        <option value="all">Todos</option>
                                        <option value="contacts">Apenas Contatos</option>
                                        <option value="none">Ninguém (Anônimo)</option>
                                        <option value="custom_allow">Personalizado (Mostrar apenas para...)</option>
                                        <option value="custom_deny">Personalizado (Ocultar para...)</option>
                                    </select>
                                    {(settings.chatNameVisibility === 'custom_allow' || settings.chatNameVisibility === 'custom_deny') && (
                                        <button onClick={() => setShowCustomListModal('chatNameVisibility')} className="text-xs text-indigo-600 font-bold hover:underline">Configurar Lista de Contatos</button>
                                    )}
                                </div>

                                <div className="space-y-1">
                                    <label className="font-medium text-gray-700 text-sm">Quem pode ver minha Foto de Perfil</label>
                                    <select 
                                        value={settings.chatPhotoVisibility || 'all'} 
                                        onChange={e => updateSetting('chatPhotoVisibility', e.target.value)} 
                                        className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 outline-none mb-2"
                                    >
                                        <option value="all">Todos</option>
                                        <option value="contacts">Apenas Contatos</option>
                                        <option value="none">Ninguém</option>
                                        <option value="custom_allow">Personalizado (Mostrar apenas para...)</option>
                                        <option value="custom_deny">Personalizado (Ocultar para...)</option>
                                    </select>
                                    {(settings.chatPhotoVisibility === 'custom_allow' || settings.chatPhotoVisibility === 'custom_deny') && (
                                        <button onClick={() => setShowCustomListModal('chatPhotoVisibility')} className="text-xs text-indigo-600 font-bold hover:underline">Configurar Lista de Contatos</button>
                                    )}
                                </div>

                                <div className="space-y-1">
                                    <label className="font-medium text-gray-700 text-sm">Quem pode ver meu Status Online / Visto por Último</label>
                                    <select 
                                        value={settings.chatOnlineVisibility || 'all'} 
                                        onChange={e => updateSetting('chatOnlineVisibility', e.target.value)} 
                                        className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 outline-none mb-2"
                                    >
                                        <option value="all">Todos</option>
                                        <option value="contacts">Apenas Contatos</option>
                                        <option value="none">Ninguém</option>
                                        <option value="custom_allow">Personalizado (Mostrar apenas para...)</option>
                                        <option value="custom_deny">Personalizado (Ocultar para...)</option>
                                    </select>
                                    {(settings.chatOnlineVisibility === 'custom_allow' || settings.chatOnlineVisibility === 'custom_deny') && (
                                        <button onClick={() => setShowCustomListModal('chatOnlineVisibility')} className="text-xs text-indigo-600 font-bold hover:underline mb-1">Configurar Lista de Contatos</button>
                                    )}
                                    <p className="text-xs text-gray-500 mt-1">Se você ocultar o seu, também não poderá ver o das outras pessoas.</p>
                                </div>

                            </div>
                        </div>
                    </div>
                );
            case 'privacidade':
                return (
                    <div className="space-y-6 animate-fade-in">
                        <div>
                            <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-3">Sugestões de Amigos</h3>
                            <div className="space-y-4 bg-gray-50 p-4 rounded-xl">
                                <div className="flex justify-between items-center">
                                    <span className="font-medium text-gray-700">Aparecer em sugestões</span>
                                    <select value={settings.suggestionVisibility || 'global'} onChange={async e => {
                                        const newValue = e.target.value;
                                        updateSetting('suggestionVisibility', newValue);
                                        // Atualiza no Firebase
                                        if (window.firebaseDB && window.currentUserData) {
                                            const uid = window.currentUserData.uid || window.currentUserData.userKey;
                                            try {
                                                await window.firebaseDB.ref(`users/${uid}`).update({
                                                    suggestionVisibility: newValue
                                                });
                                            } catch (err) {
                                                console.error("Erro ao salvar visibilidade no servidor", err);
                                            }
                                        }
                                    }} className="bg-white border border-gray-200 rounded-lg px-3 py-1.5 outline-none">
                                        <option value="global">Publicamente (Global)</option>
                                        <option value="nearby">Apenas Próximos (Bairro)</option>
                                        <option value="hidden">Oculto</option>
                                    </select>
                                </div>
                                <p className="text-xs text-gray-500 mb-4">Selecione "Apenas Próximos" para usar o algoritmo de localização e descobrir pessoas da sua região.</p>

                                <div className="border-t border-gray-200 pt-4 space-y-4">
                                    <label className="flex items-center justify-between cursor-pointer">
                                        <div className="flex flex-col">
                                            <span className="font-medium text-gray-700 text-sm">Ocultar meu perfil para seguidores</span>
                                            <span className="text-xs text-gray-500">Esconde nome e foto</span>
                                        </div>
                                        <input type="checkbox" checked={settings.hideProfileFromFollowers === true} onChange={async e => {
                                            const val = e.target.checked;
                                            updateSetting('hideProfileFromFollowers', val);
                                            if (window.firebaseDB && window.currentUserData) {
                                                const uid = window.currentUserData.uid || window.currentUserData.userKey;
                                                await window.firebaseDB.ref(`users/${uid}`).update({ hideProfileFromFollowers: val });
                                            }
                                        }} className="w-5 h-5 accent-indigo-600" />
                                    </label>

                                    <label className="flex items-center justify-between cursor-pointer">
                                        <div className="flex flex-col">
                                            <span className="font-medium text-gray-700 text-sm">Mostrar status online</span>
                                            <span className="text-xs text-gray-500">Exibir "Online" e visto por último</span>
                                        </div>
                                        <input type="checkbox" checked={settings.showOnlineStatus !== false} onChange={async e => {
                                            const val = e.target.checked;
                                            updateSetting('showOnlineStatus', val);
                                            if (window.firebaseDB && window.currentUserData) {
                                                const uid = window.currentUserData.uid || window.currentUserData.userKey;
                                                await window.firebaseDB.ref(`users/${uid}`).update({ showOnlineStatus: val });
                                            }
                                        }} className="w-5 h-5 accent-indigo-600" />
                                    </label>
                                </div>
                            </div>
                        </div>
                    </div>
                );
            case 'experiencia':
                return (
                    <div className="space-y-6 animate-fade-in">
                        <div>
                            <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-3">Acessibilidade e Desempenho</h3>
                            <div className="space-y-4 bg-gray-50 p-4 rounded-xl">
                                <label className="flex items-center justify-between cursor-pointer">
                                    <div className="flex flex-col">
                                        <span className="font-medium text-gray-700">Permitir experiências Beta</span>
                                        <span className="text-xs text-gray-500">Recursos novos em teste (sujeito a bugs)</span>
                                    </div>
                                    <input type="checkbox" checked={settings.betaExperiences} onChange={e => updateSetting('betaExperiences', e.target.checked)} className="w-5 h-5 accent-indigo-600" />
                                </label>
                            </div>
                        </div>
                    </div>
                );
            default:
                return null;
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-gray-900 bg-opacity-40 backdrop-blur-sm transition-opacity" data-name="settings-menu" data-file="components/SettingsMenu.js">
            <div className="bg-white w-full h-[90vh] sm:h-auto sm:max-h-[85vh] sm:max-w-3xl sm:rounded-2xl shadow-2xl flex flex-col sm:flex-row overflow-hidden transform transition-transform animate-fade-in-up relative">
                
                {showCustomListModal && (
                    <div className="absolute inset-0 bg-white z-50 flex flex-col animate-fade-in">
                        <div className="p-4 border-b flex items-center justify-between">
                            <h3 className="font-bold">Selecionar Contatos</h3>
                            <button onClick={() => setShowCustomListModal(null)} className="p-2 bg-gray-100 rounded-full"><div className="icon-x"></div></button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-4 space-y-2">
                            {contacts.length === 0 ? (
                                <p className="text-sm text-gray-500 text-center mt-4">Nenhum contato encontrado.</p>
                            ) : (
                                contacts.map(friend => {
                                    const visibilitySetting = settings[showCustomListModal]; 
                                    const isDenyMode = visibilitySetting === 'custom_deny';
                                    
                                    let permKey = 'profile';
                                    if (showCustomListModal === 'chatNameVisibility') permKey = 'name';
                                    if (showCustomListModal === 'chatOnlineVisibility') permKey = 'online';

                                    const friendPerms = permissions[friend.id] || {};
                                    
                                    let isSelected = false;
                                    if (isDenyMode) {
                                        isSelected = friendPerms[permKey] === false;
                                    } else {
                                        isSelected = friendPerms[permKey] === true;
                                    }
                                    
                                    return (
                                        <div key={friend.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                                            <div className="flex items-center gap-3">
                                                <img src={friend.avatar} className="w-8 h-8 rounded-full object-cover" />
                                                <span className="font-medium text-sm">{friend.name}</span>
                                            </div>
                                            <input 
                                                type="checkbox" 
                                                checked={isSelected}
                                                onChange={(e) => {
                                                    const checked = e.target.checked;
                                                    const newValue = isDenyMode ? !checked : checked;
                                                    togglePermission(friend.id, permKey, newValue);
                                                }}
                                                className="w-5 h-5 accent-indigo-600"
                                            />
                                        </div>
                                    );
                                })
                            )}
                        </div>
                        <div className="p-4 border-t">
                            <button onClick={() => setShowCustomListModal(null)} className="w-full py-3 bg-indigo-600 text-white rounded-xl font-bold">Concluído</button>
                        </div>
                    </div>
                )}
                
                {/* Sidebar / Tabs */}
                <div className="sm:w-64 bg-gray-50 border-b sm:border-b-0 sm:border-r border-gray-200 flex-shrink-0 flex flex-col">
                    <div className="p-4 border-b border-gray-200 flex items-center justify-between bg-white sm:bg-transparent">
                        <h2 className="text-xl font-bold text-gray-800">Configurações</h2>
                        <button onClick={onClose} className="p-1 hover:bg-gray-200 rounded-full sm:hidden">
                            <div className="icon-x text-xl"></div>
                        </button>
                    </div>
                    <div className="overflow-x-auto sm:overflow-y-auto flex sm:flex-col p-2 gap-1 no-scrollbar">
                        {tabs.map(tab => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`flex items-center gap-3 px-4 py-3 rounded-xl whitespace-nowrap transition-colors font-medium text-sm ${activeTab === tab.id ? 'bg-indigo-100 text-indigo-700' : 'text-gray-600 hover:bg-gray-100'}`}
                            >
                                <div className={`icon-${tab.icon} text-lg`}></div>
                                <span className="hidden sm:inline">{tab.label}</span>
                                <span className="sm:hidden">{tab.label.split(' ')[0]}</span>
                            </button>
                        ))}
                    </div>
                </div>

                {/* Content Area */}
                <div className="flex-1 flex flex-col bg-white overflow-hidden">
                    <div className="hidden sm:flex items-center justify-between p-4 border-b border-gray-100">
                        <h2 className="text-lg font-bold text-gray-800">{tabs.find(t => t.id === activeTab)?.label}</h2>
                        <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full text-gray-500">
                            <div className="icon-x text-xl"></div>
                        </button>
                    </div>
                    <div className="flex-1 overflow-y-auto p-4 sm:p-6 no-scrollbar">
                        {renderTabContent()}
                    </div>
                </div>

            </div>
        </div>
    );
}

window.SettingsMenu = SettingsMenu;