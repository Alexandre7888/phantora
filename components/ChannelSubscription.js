function ChannelSubscription({ creatorId, creatorName, creatorAvatar, onClose, db }) {
    const [tiers, setTiers] = React.useState([]);
    const [loading, setLoading] = React.useState(true);
    const [status, setStatus] = React.useState('');
    const [isVerified, setIsVerified] = React.useState(false);

    React.useEffect(() => {
        const loadTiers = async () => {
            try {
                // Checa se o criador é verificado
                const userSnap = await db.ref(`users/${creatorId}`).once('value');
                const userData = userSnap.val();
                setIsVerified(userData?.isVerified || false);

                // Carrega tiers de assinatura
                const snap = await db.ref(`users/${creatorId}/subscriptionTiers`).once('value');
                if (snap.exists()) {
                    const data = snap.val();
                    setTiers(Object.keys(data).map(k => ({ id: k, ...data[k] })));
                }
            } catch (err) {
                console.error(err);
            } finally {
                setLoading(false);
            }
        };
        loadTiers();
    }, [creatorId, db]);

    const handleSubscribe = async (tier) => {
        try {
            setStatus('Gerando pagamento...');
            const order_nsu = `sub_${Date.now()}_${window.currentUserData.uid}_${creatorId}`;
            
            // Simulação de chamada para InfinitePay baseado no seu script
            const response = await fetch("https://code-hub-eta.vercel.app/api/payment.js", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    order_nsu,
                    items: [{ quantity: 1, price: Math.round(tier.price * 100), description: `Assinatura: ${creatorName} - ${tier.name}` }],
                    redirect_success: window.location.href,
                    redirect_fail: window.location.href
                })
            });

            if (!response.ok) throw new Error("Erro ao gerar pagamento");
            const data = await response.json();
            
            if (data.url) {
                localStorage.setItem("sub_pendente", JSON.stringify({
                    order_nsu, tier, creatorId, price: tier.price
                }));
                window.location.href = data.url;
            } else {
                throw new Error("URL de pagamento não retornada");
            }
        } catch (err) {
            setStatus('Erro ao processar: ' + err.message);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/80 z-[100] flex items-center justify-center p-4 backdrop-blur-sm">
            <div className="bg-[#13131a] rounded-2xl w-full max-w-md border border-[#252530] overflow-hidden flex flex-col max-h-[90vh]">
                <div className="p-4 border-b border-[#252530] flex items-center justify-between sticky top-0 bg-[#13131a]/90 backdrop-blur">
                    <h3 className="text-white font-bold text-lg flex items-center gap-2">
                        <div className="icon-star text-sky-400"></div> Assinar Canal
                    </h3>
                    <button onClick={onClose} className="w-8 h-8 rounded-full bg-[#252530] flex items-center justify-center text-white hover:bg-[#3d3d50]">
                        <div className="icon-x"></div>
                    </button>
                </div>
                
                <div className="p-6 overflow-y-auto">
                    <div className="flex flex-col items-center mb-6 text-center">
                        <img src={creatorAvatar || 'https://via.placeholder.com/150'} className="w-24 h-24 rounded-full mb-3 object-cover border-4 border-[#252530]" />
                        <h4 className="text-white text-xl font-bold">{creatorName}</h4>
                    </div>

                    {status && (
                        <div className="mb-4 p-3 bg-indigo-500/20 text-indigo-300 rounded-lg text-sm text-center">
                            {status}
                        </div>
                    )}

                    {loading ? (
                        <div className="text-center text-gray-400 py-8">Carregando planos...</div>
                    ) : tiers.length === 0 ? (
                        <div className="text-center text-gray-400 py-8">
                            Este criador ainda não configurou planos de assinatura.
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {tiers.map(tier => (
                                <div key={tier.id} className="bg-[#1a1a24] p-4 rounded-xl border border-[#2a2a40] hover:border-sky-500/50 transition-colors">
                                    <div className="flex justify-between items-center mb-2">
                                        <h5 className="text-white font-bold text-lg">{tier.name}</h5>
                                        <span className="text-sky-400 font-bold">R$ {parseFloat(tier.price).toFixed(2)}</span>
                                    </div>
                                    <p className="text-gray-400 text-sm mb-4">{tier.description}</p>
                                    <button 
                                        onClick={() => handleSubscribe(tier)}
                                        className="w-full py-2 bg-sky-500 hover:bg-sky-600 text-white rounded-lg font-bold transition-colors"
                                    >
                                        Assinar Agora
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
window.ChannelSubscription = ChannelSubscription;