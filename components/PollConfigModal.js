function PollConfigModal({ user, onClose, onPost }) {
    const [question, setQuestion] = React.useState('');
    const [options, setOptions] = React.useState(['', '']);
    const [duration, setDuration] = React.useState('24h');
    const [isSubmitting, setIsSubmitting] = React.useState(false);

    const addOption = () => {
        if (options.length < 5) setOptions([...options, '']);
    };

    const removeOption = (index) => {
        if (options.length > 2) {
            const newOptions = options.filter((_, i) => i !== index);
            setOptions(newOptions);
        }
    };

    const handlePublish = async () => {
        const validOptions = options.filter(o => o.trim());
        
        if (!question.trim()) {
            alert("Por favor, escreva uma pergunta para a enquete.");
            return;
        }
        
        if (validOptions.length < 2) {
            alert("Adicione pelo menos 2 opções para a enquete.");
            return;
        }

        setIsSubmitting(true);
        try {
            const pollData = {
                authorId: user?.uid || user?.id || 'anonymous',
                authorName: user?.displayName || user?.name || 'Usuário',
                authorPhoto: user?.photoURL || 'https://app.trickle.so/storage/public/images/usr_1b4249e300000001/69bb1bd2-fc92-4f38-85f2-a598ae69ef5e.1000336397',
                question: question.trim(),
                options: validOptions.map((opt, idx) => ({ 
                    id: idx.toString(), 
                    text: opt, 
                    votes: 0 
                })),
                duration,
                createdAt: firebase.database.ServerValue.TIMESTAMP,
                type: 'poll',
                status: 'active'
            };
            
            const newPollRef = firebase.database().ref('social_posts').push();
            
            // Salva com os dados completos
            await newPollRef.set({
                ...pollData,
                pollData: pollData, // Dados duplicados para facilitar leitura
                pollCdnUrl: null // Será preenchido depois se necessário
            });
            
            // Notifica criação
            if (onPost) {
                onPost({
                    ...pollData,
                    id: newPollRef.key,
                    pollData: pollData
                });
            }
            
            // Mostra sucesso
            alert("Enquete publicada com sucesso!");
            onClose();
            
        } catch (error) {
            console.error("Erro ao salvar enquete:", error);
            alert("Erro ao publicar enquete. Tente novamente.");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/80 z-[100] flex items-center justify-center p-4">
            <div className="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-md p-6">
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-xl font-bold flex items-center gap-2">
                        <div className="icon-chart-bar text-indigo-400"></div> 
                        Criar Enquete
                    </h2>
                    <button 
                        onClick={onClose} 
                        disabled={isSubmitting}
                        className="text-gray-400 hover:text-white transition"
                    >
                        <div className="icon-x"></div>
                    </button>
                </div>
                
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm text-gray-400 mb-1">Pergunta</label>
                        <input 
                            type="text" 
                            value={question} 
                            onChange={e => setQuestion(e.target.value)} 
                            className="w-full bg-gray-800 p-3 rounded-xl outline-none text-white focus:ring-2 focus:ring-indigo-500" 
                            placeholder="O que você quer saber?" 
                            disabled={isSubmitting}
                            maxLength={200}
                        />
                    </div>
                    
                    <div>
                        <label className="block text-sm text-gray-400 mb-1">Opções (mínimo 2)</label>
                        {options.map((opt, idx) => (
                            <div key={idx} className="flex gap-2 mb-2">
                                <input 
                                    type="text" 
                                    value={opt} 
                                    onChange={e => {
                                        const newOpts = [...options];
                                        newOpts[idx] = e.target.value;
                                        setOptions(newOpts);
                                    }} 
                                    className="flex-1 bg-gray-800 p-3 rounded-xl outline-none text-white focus:ring-2 focus:ring-indigo-500" 
                                    placeholder={`Opção ${idx + 1}`} 
                                    disabled={isSubmitting}
                                    maxLength={100}
                                />
                                {options.length > 2 && (
                                    <button 
                                        onClick={() => removeOption(idx)}
                                        disabled={isSubmitting}
                                        className="text-red-400 hover:text-red-300 px-3"
                                    >
                                        <div className="icon-x"></div>
                                    </button>
                                )}
                            </div>
                        ))}
                        {options.length < 5 && (
                            <button 
                                onClick={addOption} 
                                disabled={isSubmitting} 
                                className="text-sm text-indigo-400 hover:text-indigo-300 font-medium transition"
                            >
                                + Adicionar opção
                            </button>
                        )}
                    </div>

                    <div>
                        <label className="block text-sm text-gray-400 mb-1">Duração</label>
                        <select 
                            value={duration} 
                            onChange={e => setDuration(e.target.value)} 
                            className="w-full bg-gray-800 p-3 rounded-xl outline-none text-white focus:ring-2 focus:ring-indigo-500" 
                            disabled={isSubmitting}
                        >
                            <option value="1h">1 Hora</option>
                            <option value="24h">24 Horas</option>
                            <option value="7d">7 Dias</option>
                        </select>
                    </div>

                    <button 
                        onClick={handlePublish}
                        disabled={isSubmitting || !question.trim() || options.filter(o => o.trim()).length < 2}
                        className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed py-3 rounded-xl font-bold mt-4 transition-colors flex items-center justify-center gap-2"
                    >
                        {isSubmitting ? (
                            <>
                                <div className="icon-loader animate-spin"></div>
                                Publicando...
                            </>
                        ) : (
                            'Publicar Enquete'
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}

window.PollConfigModal = PollConfigModal;