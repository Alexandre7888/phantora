function App() {
    const [user, setUser] = React.useState(null);
    const [loading, setLoading] = React.useState(true);

    React.useEffect(() => {
        const checkAuth = () => {
            if (!window.firebaseAuth) {
                console.warn('[DEBUG] Firebase Auth não encontrado no escopo global.');
                setLoading(false);
                return;
            }
            
            window.firebaseAuth.onAuthStateChanged(async (authUser) => {
                if (authUser) {
                    const uid = authUser.uid;
                    console.log(`[DEBUG] Usuário autenticado encontrado: ${uid}`);
                    try {
                        const db = window.firebaseDB;
                        const snap = await db.ref(`users/${uid}`).once('value');
                        if (snap.exists()) {
                            console.log('[DEBUG] Dados do usuário carregados com sucesso.');
                            setUser({ id: uid, uid: uid, ...snap.val() });
                        } else {
                            console.warn(`[DEBUG] Nó do usuário não encontrado no banco de dados para UID: ${uid}`);
                        }
                    } catch (err) {
                        console.error('[DEBUG] Erro ao buscar dados do usuário:', err);
                    }
                    setLoading(false);
                } else {
                    console.warn('[DEBUG] Nenhum usuário autenticado encontrado (sessão vazia).');
                    setLoading(false);
                }
            });
        };
        
        checkAuth();
    }, []);

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-primary">
                <div className="icon-loader animate-spin text-4xl text-accent"></div>
            </div>
        );
    }

    return <window.DiscoverPage user={user} />;
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);