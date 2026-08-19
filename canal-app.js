const root = ReactDOM.createRoot(document.getElementById('root'));

function App() {
    const [user, setUser] = React.useState(null);
    const [loading, setLoading] = React.useState(true);
    const [channelUserId, setChannelUserId] = React.useState(null);
    const [errorLog, setErrorLog] = React.useState('');

    React.useEffect(() => {
        // Auto-refresh the SW cache periodically (simplificado)
        const cacheInterval = setInterval(() => {
            if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
                navigator.serviceWorker.controller.postMessage({ type: 'UPDATE_CACHE' });
            }
        }, 60000);

        if (!window.firebaseAuth) {
            setErrorLog("Firebase não inicializado.");
            setLoading(false);
            return;
        }

        const unsubscribe = window.firebaseAuth.onAuthStateChanged(async (firebaseUser) => {
            try {
                if (firebaseUser) {
                    const uid = firebaseUser.uid;
                    let userObj = null;
                    
                    if (window.currentUserData) {
                        userObj = {
                            id: window.currentUserData.uid,
                            name: window.currentUserData.nome || window.currentUserData.username || 'Usuário',
                            avatar: window.currentUserData.profilePicture
                        };
                    } else if (window.firebaseDB) {
                        const snap = await window.firebaseDB.ref(`users/${uid}`).once('value');
                        if (snap.exists()) {
                            const dbData = snap.val();
                            window.currentUserData = dbData;
                            userObj = {
                                id: uid,
                                name: dbData.nome || dbData.username || 'Usuário',
                                avatar: dbData.profilePicture
                            };
                        }
                    }

                    if (!userObj) {
                        userObj = {
                            id: uid,
                            name: firebaseUser.displayName || 'Usuário',
                            avatar: firebaseUser.photoURL || null
                        };
                    }

                    setUser(userObj);
                    
                    const params = new URLSearchParams(window.location.search);
                    let channelUid = params.get('uid');
                    
                    // Fallback para caso venha diferente
                    if (!channelUid && window.location.search.includes('?uid=')) {
                        channelUid = window.location.search.split('?uid=')[1].split('&')[0];
                    }

                    if (channelUid) {
                        setChannelUserId(channelUid);
                    } else {
                        // Se não tem UID na URL, mostra o próprio canal
                        setChannelUserId(userObj.id);
                    }
                } else {
                    setErrorLog("Você precisa estar logado para acessar o canal.");
                }
            } catch (e) {
                console.error("Erro ao carregar dados do usuário:", e);
                setErrorLog("Erro ao carregar dados do usuário: " + (e.message || JSON.stringify(e)));
            } finally {
                setLoading(false);
            }
        });

        return () => unsubscribe();
    }, []);

    if (loading) {
        return <div className="flex h-screen items-center justify-center bg-primary"><div className="icon-loader animate-spin text-4xl text-accent"></div></div>;
    }

    if (!user || !channelUserId) {
        return (
            <div className="flex h-screen flex-col items-center justify-center bg-primary p-4 text-center">
                <p className="mb-2 text-danger font-bold text-lg">Erro ao carregar o seu perfil ou o ID do canal é inválido.</p>
                <p className="mb-2 text-text-secondary text-sm">Log: ID do Canal: {channelUserId || 'Nulo'}, Seu Perfil: {user ? 'Carregado' : 'Falhou'}</p>
                {errorLog && (
                    <div className="mb-6 p-3 bg-red-900/20 text-red-400 border border-red-900/50 rounded-md text-xs max-w-md w-full text-left overflow-auto">
                        <strong>Detalhes do erro:</strong><br />
                        {errorLog}
                    </div>
                )}
                <a href="index.html" className="px-4 py-2 bg-accent text-white rounded-lg font-bold hover:bg-accent-hover transition-colors">Voltar para a Rede Social</a>
            </div>
        );
    }

    return <UserChannel currentUser={user} channelUserId={channelUserId} />;
}

root.render(<App />);