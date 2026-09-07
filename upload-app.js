function UploadPage() {
    const [user, setUser] = React.useState(null);
    const [loading, setLoading] = React.useState(true);
    const [debugInfo, setDebugInfo] = React.useState([]);

    const addDebug = (msg) => {
        console.log("[DEBUG]", msg);
        setDebugInfo(prev => [...prev, `${new Date().toLocaleTimeString()} - ${msg}`]);
    };

    React.useEffect(() => {
        addDebug("Iniciando UploadPage...");
        if (!window.firebaseAuth) {
            addDebug("ERRO: window.firebaseAuth não está definido. Firebase não foi inicializado corretamente.");
            setLoading(false);
            return;
        }

        addDebug("Aguardando estado de autenticação do Firebase...");
        const unsubscribe = window.firebaseAuth.onAuthStateChanged(async (firebaseUser) => {
            if (firebaseUser) {
                addDebug(`Usuário logado detectado: UID=${firebaseUser.uid}, Email=${firebaseUser.email}`);
                try {
                    const uid = firebaseUser.uid;
                    addDebug("Buscando dados complementares na API/Firebase...");
                    const firebaseData = await window.api.getFirebaseUser(uid);
                    
                    if (!firebaseData) {
                        addDebug("AVISO: getFirebaseUser retornou null ou undefined para este UID.");
                    } else {
                        addDebug("Dados recebidos do banco de dados com sucesso.");
                    }
                    
                    const combinedData = {
                        uid: uid,
                        privateId: uid,
                        publicId: uid,
                        email: firebaseUser.email,
                        nome: firebaseData?.name || firebaseData?.username || firebaseUser.displayName || 'Usuário',
                        avatar: firebaseData?.avatar || firebaseData?.profilePicture || null,
                        ...firebaseData
                    };
                    
                    setUser(combinedData);
                    addDebug("Usuário configurado no estado. Removendo tela de carregamento.");
                    setLoading(false);
                } catch (error) {
                    console.error("Error fetching user data:", error);
                    addDebug(`ERRO ao buscar dados do usuário: ${error.message || error}`);
                    setLoading(false);
                }
            } else {
                addDebug("Nenhum usuário logado detectado (firebaseUser é null). O redirecionamento foi desativado para depuração.");
                setLoading(false);
            }
        });

        return () => unsubscribe();
    }, []);

    if (loading || !user) {
        return (
            <div className="h-screen w-screen flex flex-col items-center justify-center bg-black text-white p-6">
                {loading && <div className="icon-loader animate-spin text-4xl text-white mb-6"></div>}
                {!loading && !user && <div className="text-red-500 mb-6 font-bold text-xl">Falha na Autenticação (Modo Debug)</div>}
                
                <div className="bg-gray-900 border border-gray-700 rounded-lg w-full max-w-2xl p-4 font-mono text-sm overflow-y-auto max-h-96 text-left">
                    <h3 className="text-gray-400 mb-2 border-b border-gray-800 pb-2">Logs de Depuração:</h3>
                    {debugInfo.map((log, i) => (
                        <div key={i} className="mb-1 text-green-400 break-all">{log}</div>
                    ))}
                    {debugInfo.length === 0 && <div className="text-gray-500">Aguardando logs...</div>}
                </div>
                
                {!loading && (
                    <button 
                        onClick={() => window.location.href = 'index.html'}
                        className="mt-6 px-6 py-2 bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors"
                    >
                        Voltar para Início
                    </button>
                )}
            </div>
        );
    }

    // Extract audioId from URL if any
    const urlParams = new URLSearchParams(window.location.search);
    const audioId = urlParams.get('audioId');

    return (
        <div className="h-screen w-screen relative">
            {window.PostCreator && (
                <window.PostCreator 
                    user={user} 
                    initialAudioId={audioId}
                    onClose={() => window.location.href = 'index.html'} 
                    onUploadComplete={() => window.location.href = 'index.html'} 
                />
            )}
        </div>
    );
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<UploadPage />);