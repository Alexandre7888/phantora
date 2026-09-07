function App() {
    const [user, setUser] = React.useState(null);
    const [loading, setLoading] = React.useState(true);

    React.useEffect(() => {
        if (!window.firebaseAuth) {
            console.error('Não foi possível iniciar a autenticação do Firebase.');
            setLoading(false);
            return undefined;
        }

        const unsubscribe = window.firebaseAuth.onAuthStateChanged(async (authUser) => {
            if (!authUser) {
                setUser(null);
                setLoading(false);
                return;
            }

            try {
                const db = window.firebaseDB;
                const snap = db ? await db.ref(`users/${authUser.uid}`).once('value') : null;
                setUser({ id: authUser.uid, uid: authUser.uid, ...(snap && snap.exists() ? snap.val() : {}) });
            } catch (err) {
                console.error('Erro ao carregar o perfil:', err);
                setUser({ id: authUser.uid, uid: authUser.uid });
            } finally {
                setLoading(false);
            }
        });

        return unsubscribe;
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
