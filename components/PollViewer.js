function PollViewer({ post, user }) {
    const [pollData, setPollData] = React.useState(null);
    const [hasVoted, setHasVoted] = React.useState(false);
    const [selectedOption, setSelectedOption] = React.useState(null);
    const [loading, setLoading] = React.useState(true);
    const [error, setError] = React.useState(false);
    const [voting, setVoting] = React.useState(false);
    const [totalVotes, setTotalVotes] = React.useState(0);
    const [votesCount, setVotesCount] = React.useState({});

    // CARREGAR DADOS DA ENQUETE
    React.useEffect(() => {
        async function loadPoll() {
            console.log("🔍 Carregando enquete para post:", post);
            
            // VERIFICA SE É UMA ENQUETE
            if (post.type !== 'poll') {
                console.log("⏭️ Não é uma enquete, ignorando");
                setLoading(false);
                return;
            }

            // TENTA 1: Carregar da CDN (Prioridade se existir, pois pode ser mais atualizado)
            if (post.pollCdnUrl) {
                console.log("📡 Carregando da CDN:", post.pollCdnUrl);
                try {
                    const response = await fetch(post.pollCdnUrl);
                    if (response.ok) {
                        const data = await response.json();
                        console.log("✅ Dados da CDN:", data);
                        if (data.options && data.question) {
                            data.options = data.options.map(opt => ({
                                ...opt,
                                id: String(opt.id)
                            }));
                            setPollData(data);
                            setLoading(false);
                            return;
                        }
                    }
                } catch (err) {
                    console.warn("⚠️ Erro ao carregar CDN, caindo para fallback:", err);
                }
            }

            // TENTA 2: Usar pollData diretamente do post
            if (post.pollData && post.pollData.options) {
                console.log("✅ Usando pollData do post:", post.pollData);
                setPollData({
                    question: post.pollData.question || post.question,
                    options: post.pollData.options.map(opt => ({...opt, id: String(opt.id)}))
                });
                setLoading(false);
                return;
            }

            // TENTA 3: Usar question + options do post
            if (post.question && post.options) {
                console.log("✅ Usando question/options do post:", {
                    question: post.question,
                    options: post.options
                });
                setPollData({
                    question: post.question,
                    options: post.options.map(opt => ({...opt, id: String(opt.id)}))
                });
                setLoading(false);
                return;
            }

            // SEM DADOS
            console.warn("⚠️ Nenhum dado de enquete encontrado");
            setError(true);
            setLoading(false);
        }

        loadPoll();
    }, [post]);

    // CALCULAR VOTOS
    React.useEffect(() => {
        if (post.pollVotes) {
            console.log("🗳️ Votos encontrados:", post.pollVotes);
            
            // Contar votos por opção
            const count = {};
            Object.values(post.pollVotes).forEach(optId => {
                const strId = String(optId);
                count[strId] = (count[strId] || 0) + 1;
            });
            
            setVotesCount(count);
            setTotalVotes(Object.keys(post.pollVotes).length);
            
            // Verificar se o usuário atual votou
            if (user && user.id && post.pollVotes[user.id]) {
                const userVote = String(post.pollVotes[user.id]);
                console.log("✅ Usuário já votou:", userVote);
                setHasVoted(true);
                setSelectedOption(userVote);
            } else {
                setHasVoted(false);
                setSelectedOption(null);
            }
        } else {
            setVotesCount({});
            setTotalVotes(0);
            setHasVoted(false);
            setSelectedOption(null);
        }
    }, [post.pollVotes, user]);

    // FUNÇÃO PARA VOTAR
    const handleVote = async (optionId) => {
        if (hasVoted) {
            console.log("⛔ Usuário já votou");
            return;
        }
        
        if (!user || !user.id) {
            alert("Faça login para votar!");
            return;
        }

        if (voting) return;

        setVoting(true);
        const strOptionId = String(optionId);
        console.log("🗳️ Votando na opção:", strOptionId);

        try {
            const db = window.firebaseDB;
            if (!db) throw new Error("Firebase não disponível");

            // Salvar voto
            const voteRef = db.ref(`posts/${post.id}/pollVotes/${user.id}`);
            await voteRef.set(strOptionId);
            
            console.log("✅ Voto registrado!");
            
            // Atualizar estado local
            setHasVoted(true);
            setSelectedOption(strOptionId);
            
            // Atualizar contagem localmente
            setVotesCount(prev => ({
                ...prev,
                [strOptionId]: (prev[strOptionId] || 0) + 1
            }));
            setTotalVotes(prev => prev + 1);

            // Mostrar feedback
            alert("Voto registrado com sucesso! ✅");

        } catch (error) {
            console.error("❌ Erro ao votar:", error);
            alert("Erro ao registrar voto. Tente novamente.");
        } finally {
            setVoting(false);
        }
    };

    // ESTADOS DE CARREGAMENTO
    if (loading) {
        return (
            <div className="p-4 bg-tertiary/30 m-4 rounded-xl border border-border">
                <div className="flex items-center justify-center gap-3 text-text-muted">
                    <div className="animate-spin rounded-full h-5 w-5 border-2 border-purple-500 border-t-transparent"></div>
                    <span>Carregando enquete...</span>
                </div>
            </div>
        );
    }

    if (error || !pollData || !pollData.options || pollData.options.length === 0) {
        return (
            <div className="p-4 bg-tertiary/30 m-4 rounded-xl border border-border">
                <div className="text-center text-gray-400 text-sm">
                    <span className="text-2xl block mb-2">📊</span>
                    Não foi possível carregar esta enquete.
                </div>
            </div>
        );
    }

    return (
        <div className="p-4 bg-tertiary/30 m-4 rounded-xl border border-border">
            {/* CABEÇALHO */}
            <div className="flex items-start justify-between mb-4">
                <h4 className="font-bold text-lg text-white flex items-center gap-2">
                    <span>📊</span>
                    {pollData.question || "Enquete"}
                </h4>
                {hasVoted && (
                    <span className="text-xs bg-green-500/20 text-green-400 px-3 py-1 rounded-full font-medium">
                        ✓ Votou
                    </span>
                )}
            </div>

            {/* OPÇÕES */}
            <div className="space-y-2">
                {pollData.options.map((opt, index) => {
                    const optId = String(opt.id || index);
                    const optVotes = votesCount[optId] || 0;
                    const percentage = totalVotes > 0 ? Math.round((optVotes / totalVotes) * 100) : 0;
                    const isSelected = hasVoted && String(selectedOption) === optId;
                    const canVote = !hasVoted && !voting && user;

                    return (
                        <div 
                            key={optId}
                            onClick={() => canVote && handleVote(optId)}
                            className={`
                                relative border p-3 rounded-lg overflow-hidden transition-all duration-300
                                ${canVote ? 'cursor-pointer hover:bg-gray-700/50 hover:border-purple-500/50' : 'cursor-default'}
                                ${isSelected ? 'border-purple-500 bg-purple-500/20' : 'border-gray-700 bg-gray-800/50'}
                                ${hasVoted ? 'hover:bg-gray-800/50' : ''}
                            `}
                        >
                            {/* BARRA DE PROGRESSO */}
                            {hasVoted && (
                                <div 
                                    className="absolute top-0 left-0 h-full bg-purple-500/20 transition-all duration-700 ease-out"
                                    style={{ width: `${percentage}%` }}
                                ></div>
                            )}

                            {/* CONTEÚDO */}
                            <div className="relative z-10 flex justify-between items-center">
                                <div className="flex items-center gap-3">
                                    {/* Círculo de seleção */}
                                    {!hasVoted && canVote && (
                                        <div className={`
                                            w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0
                                            ${isSelected ? 'border-purple-500 bg-purple-500' : 'border-gray-500'}
                                        `}>
                                            {isSelected && (
                                                <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                                                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                                </svg>
                                            )}
                                        </div>
                                    )}
                                    
                                    {isSelected && hasVoted && (
                                        <div className="w-5 h-5 rounded-full border-2 border-purple-500 bg-purple-500 flex items-center justify-center flex-shrink-0">
                                            <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                            </svg>
                                        </div>
                                    )}

                                    <span className={`
                                        font-medium text-white
                                        ${isSelected ? 'text-purple-400 font-bold' : ''}
                                    `}>
                                        {opt.text || `Opção ${index + 1}`}
                                    </span>
                                </div>

                                {hasVoted && (
                                    <div className="flex items-center gap-2">
                                        <span className="text-sm font-bold text-white">
                                            {percentage}%
                                        </span>
                                        <span className="text-xs text-gray-400">
                                            ({optVotes})
                                        </span>
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* RODAPÉ */}
            <div className="mt-4 flex items-center justify-between text-sm border-t border-gray-700 pt-3">
                <span className="text-gray-400">
                    {totalVotes} {totalVotes === 1 ? 'voto' : 'votos'}
                </span>
                
                {!hasVoted && user && (
                    <span className="text-purple-400/70 text-xs">
                        Clique em uma opção para votar
                    </span>
                )}
                
                {!user && (
                    <span className="text-yellow-500/70 text-xs">
                        🔒 Faça login para votar
                    </span>
                )}
                
                {voting && (
                    <span className="text-purple-400 text-xs flex items-center gap-2">
                        <div className="animate-spin rounded-full h-3 w-3 border-2 border-purple-500 border-t-transparent"></div>
                        Registrando...
                    </span>
                )}
            </div>
        </div>
    );
}

window.PollViewer = PollViewer;
