function StudioSubscriptions({ db, user }) {
    const [tiers, setTiers] = React.useState([]);
    const [isVerified, setIsVerified] = React.useState(false);
    const [newTier, setNewTier] = React.useState({ 
        name: '', 
        price: 5, 
        description: '',
        permissions: { exclusiveVideos: false, customIcon: false },
        iconBase64: ''
    });

    React.useEffect(() => {
        if (!user) return;
        
        const load = async () => {
            const uSnap = await db.ref(`users/${user.id}`).once('value');
            setIsVerified(uSnap.val()?.isVerified || false);

            const tSnap = await db.ref(`users/${user.id}/subscriptionTiers`).once('value');
            if (tSnap.exists()) {
                const data = tSnap.val();
                setTiers(Object.keys(data).map(k => ({ id: k, ...data[k] })));
            }
        };
        load();
    }, [user, db]);

    const handleIconUpload = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        if (file.size > 50 * 1024) return alert("O ícone deve ter no máximo 50KB.");
        
        const reader = new FileReader();
        reader.onloadend = () => {
            setNewTier({ ...newTier, iconBase64: reader.result });
        };
        reader.readAsDataURL(file);
    };

    const handleCreateTier = async () => {
        if (tiers.length >= 10) return alert("Máximo de 10 assinaturas atingido.");
        if (newTier.price < 5 || newTier.price > 50) return alert("O preço deve ser entre R$5 e R$50.");
        if (!newTier.name) return alert("Preencha o nome do plano.");

        const id = 'tier_' + Date.now();
        await db.ref(`users/${user.id}/subscriptionTiers/${id}`).set(newTier);
        setTiers([...tiers, { id, ...newTier }]);
        setNewTier({ 
            name: '', 
            price: 5, 
            description: '',
            permissions: { exclusiveVideos: false, customIcon: false },
            iconBase64: ''
        });
    };

    const handleDeleteTier = async (id) => {
        if(confirm("Tem certeza que deseja excluir este plano?")) {
            await db.ref(`users/${user.id}/subscriptionTiers/${id}`).remove();
            setTiers(tiers.filter(t => t.id !== id));
        }
    };

    return (
        <div className="p-6">
            <h2 className="text-2xl font-bold text-white mb-6">Assinaturas e Monetização</h2>

            <div className="bg-blue-500/10 border border-blue-500/20 text-blue-400 p-4 rounded-xl mb-6 flex items-start gap-3">
                <div className="icon-info text-xl"></div>
                <div>
                    <h4 className="font-bold">Canal Ativo para Assinaturas</h4>
                    <p className="text-sm opacity-80 mb-2">Configure os planos e permissões especiais para seus assinantes.</p>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-[#14141f] border border-[#2a2a40] p-6 rounded-xl">
                    <h3 className="text-lg font-bold text-white mb-4">Criar Novo Plano</h3>
                    <div className="space-y-4">
                        <div>
                            <label className="text-gray-400 text-sm block mb-1">Nome do Plano</label>
                            <input type="text" value={newTier.name} onChange={e => setNewTier({...newTier, name: e.target.value})} className="w-full bg-[#0c0c14] border border-[#2a2a40] text-white p-2 rounded focus:border-sky-500 outline-none" placeholder="Ex: Apoiador Vip" />
                        </div>
                        <div>
                            <label className="text-gray-400 text-sm block mb-1">Preço (R$ 5 a R$ 50)</label>
                            <input type="number" min="5" max="50" value={newTier.price} onChange={e => setNewTier({...newTier, price: Number(e.target.value)})} className="w-full bg-[#0c0c14] border border-[#2a2a40] text-white p-2 rounded focus:border-sky-500 outline-none" />
                        </div>
                        
                        <div className="bg-[#0c0c14] p-3 rounded border border-[#2a2a40]">
                            <label className="text-gray-400 text-sm font-bold block mb-2">Permissões Especiais</label>
                            <label className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer mb-2">
                                <input type="checkbox" checked={newTier.permissions.exclusiveVideos} onChange={e => setNewTier({...newTier, permissions: {...newTier.permissions, exclusiveVideos: e.target.checked}})} className="rounded bg-[#1a1a24] border-gray-600" />
                                Acesso a Vídeos Exclusivos
                            </label>
                            <label className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
                                <input type="checkbox" checked={newTier.permissions.customIcon} onChange={e => setNewTier({...newTier, permissions: {...newTier.permissions, customIcon: e.target.checked}})} className="rounded bg-[#1a1a24] border-gray-600" />
                                Ícone Especial nos Comentários
                            </label>
                            
                            {newTier.permissions.customIcon && (
                                <div className="mt-3 pl-6">
                                    <label className="text-xs text-gray-400 block mb-1">Upload do Ícone (Máx 50KB)</label>
                                    <input type="file" accept="image/*" onChange={handleIconUpload} className="text-xs text-gray-400 file:mr-2 file:py-1 file:px-2 file:rounded file:border-0 file:text-xs file:bg-sky-500/20 file:text-sky-400" />
                                    {newTier.iconBase64 && <img src={newTier.iconBase64} alt="Ícone" className="w-6 h-6 mt-2 rounded" />}
                                </div>
                            )}
                        </div>

                        <div>
                            <label className="text-gray-400 text-sm block mb-1">Descrição</label>
                            <textarea value={newTier.description} onChange={e => setNewTier({...newTier, description: e.target.value})} className="w-full bg-[#0c0c14] border border-[#2a2a40] text-white p-2 rounded focus:border-sky-500 outline-none h-20" placeholder="O que o assinante ganha?"></textarea>
                        </div>
                        <button onClick={handleCreateTier} className="w-full bg-sky-500 hover:bg-sky-600 text-white font-bold py-2 rounded">
                            Criar Plano
                        </button>
                    </div>
                </div>

                <div className="bg-[#14141f] border border-[#2a2a40] p-6 rounded-xl">
                    <h3 className="text-lg font-bold text-white mb-4">Meus Planos ({tiers.length}/10)</h3>
                    <div className="space-y-3">
                        {tiers.map(t => (
                            <div key={t.id} className="bg-[#0c0c14] border border-[#2a2a40] p-3 rounded-lg flex flex-col gap-2">
                                <div className="flex justify-between items-start">
                                    <div>
                                        <div className="text-white font-bold">{t.name}</div>
                                        <div className="text-sm text-sky-400">R$ {t.price.toFixed(2)}</div>
                                    </div>
                                    <button onClick={() => handleDeleteTier(t.id)} className="text-red-400 hover:text-red-300 p-2">
                                        <div className="icon-trash"></div>
                                    </button>
                                </div>
                                <div className="flex gap-2">
                                    {t.permissions?.exclusiveVideos && <span className="text-xs bg-indigo-500/20 text-indigo-300 px-2 py-1 rounded">Vídeos Exclusivos</span>}
                                    {t.permissions?.customIcon && <span className="text-xs bg-fuchsia-500/20 text-fuchsia-300 px-2 py-1 rounded flex items-center gap-1">
                                        Ícone
                                        {t.iconBase64 && <img src={t.iconBase64} className="w-3 h-3" />}
                                    </span>}
                                </div>
                            </div>
                        ))}
                        {tiers.length === 0 && <p className="text-gray-500 text-sm">Nenhum plano criado ainda.</p>}
                    </div>
                </div>
            </div>
        </div>
    );
}
window.StudioSubscriptions = StudioSubscriptions;