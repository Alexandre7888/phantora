const { useState, useEffect } = React;

function App() {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const checkAuth = async () => {
            try {
                const userKey = localStorage.getItem("userkey");
                if (!userKey) {
                    window.location.href = 'index.html';
                    return;
                }

                // Fetch user data from CodeHUB
                const codeHubData = await window.api.getCodeHubUser(userKey);
                if (!codeHubData || codeHubData.erro) {
                    window.location.href = 'index.html';
                    return;
                }

                const privateId = codeHubData.uid || userKey;
                const authMap = await window.api.getAuthMap(privateId);
                
                if (authMap && authMap.publicId) {
                    const publicId = authMap.publicId;
                    const firebaseData = await window.api.getFirebaseUser(publicId);
                    
                    if (firebaseData) {
                        const userDataObj = {
                            id: publicId,
                            uid: publicId,
                            name: firebaseData.name || firebaseData.username || codeHubData.nome || 'Usuário',
                            avatar: firebaseData.profilePicture,
                            ...firebaseData
                        };
                        window.currentUserData = userDataObj;
                        setUser(userDataObj);
                        setLoading(false);
                        return;
                    }
                }
                
                window.location.href = 'index.html';
            } catch (e) {
                console.error("Auth error:", e);
                window.location.href = 'index.html';
            }
        };
        checkAuth();
    }, []);

    if (loading) {
        return (
            <div className="h-screen w-screen flex flex-col items-center justify-center bg-[#0a0a0f]">
                <div className="icon-loader animate-spin text-4xl text-[#667eea] mb-4"></div>
                <p className="text-gray-400 font-medium">Carregando mensagens...</p>
            </div>
        );
    }

    if (!user) return null;

    return <ChatPage user={user} />;
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);