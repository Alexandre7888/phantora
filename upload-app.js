function UploadPage() {
    const [user, setUser] = React.useState(null);
    const [loading, setLoading] = React.useState(true);

    React.useEffect(() => {
        if (!window.firebaseAuth) {
            console.error("Firebase não inicializado corretamente");
            setLoading(false);
            return;
        }

        const unsubscribe = window.firebaseAuth.onAuthStateChanged(async (firebaseUser) => {
            if (firebaseUser) {
                try {
                    const uid = firebaseUser.uid;
                    const firebaseData = await window.api.getFirebaseUser(uid);

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
                    setLoading(false);
                } catch (error) {
                    console.error("Erro ao buscar dados do usuário:", error);
                    setLoading(false);
                }
            } else {
                setLoading(false);
            }
        });

        return () => unsubscribe();
    }, []);

    // Se ainda não tem user, mostra um esqueleto imediato (não bloqueia a página)
    if (!user) {
        return (
            <div className="h-screen w-screen flex flex-col items-center justify-center bg-black text-white p-6">
                {loading ? (
                    <div className="flex flex-col items-center gap-4">
                        <div className="icon-loader animate-spin text-4xl text-white"></div>
                        <p className="text-gray-400 text-sm">Carregando...</p>
                    </div>
                ) : (
                    <>
                        <div className="text-red-500 mb-4 font-bold text-xl">Falha na Autenticação</div>
                        <button 
                            onClick={() => window.location.href = 'index.html'}
                            className="mt-4 px-6 py-2 bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors"
                        >
                            Voltar para Início
                        </button>
                    </>
                )}
            </div>
        );
    }

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