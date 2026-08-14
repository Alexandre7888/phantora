function ContactInfoModal({ isOpen, onClose, otherUser, contactPrivacy, togglePrivacy, isBlocked, hasBlockedMe, handleBlockUser }) {
    const [viewPhoto, setViewPhoto] = React.useState(false);

    if (!isOpen) return null;

    // Se fui bloqueado, não mostro a foto real
    const displayAvatar = hasBlockedMe ? 'https://via.placeholder.com/150' : otherUser.avatar;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            {viewPhoto && !hasBlockedMe && (
                <div className="absolute inset-0 z-[110] bg-black/95 flex items-center justify-center p-4 animate-fade-in" onClick={() => setViewPhoto(false)}>
                    <img src={displayAvatar} className="max-w-full max-h-full object-contain rounded-lg" />
                    <button className="absolute top-6 right-6 text-white bg-black/50 p-2 rounded-full hover:bg-black/70">
                        <div className="icon-x text-2xl"></div>
                    </button>
                </div>
            )}

            <div className="bg-[#13131a] border border-[#2a2a35] rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl animate-fade-in flex flex-col relative z-[105]">
                <div className="p-4 border-b border-[#2a2a35] flex items-center justify-between">
                    <h3 className="font-bold text-white text-lg">Informações do Contato</h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-white transition">
                        <div className="icon-x text-xl"></div>
                    </button>
                </div>
                
                <div className="p-6 flex flex-col items-center border-b border-[#2a2a35]">
                    <div 
                        className={`relative w-24 h-24 rounded-full mb-4 border-2 border-indigo-600/30 overflow-hidden ${!hasBlockedMe ? 'cursor-pointer hover:opacity-80 transition' : ''}`}
                        onClick={() => !hasBlockedMe && setViewPhoto(true)}
                    >
                        <img src={displayAvatar} className="w-full h-full object-cover" />
                        {!hasBlockedMe && (
                            <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                                <div className="icon-eye text-white text-xl"></div>
                            </div>
                        )}
                    </div>
                    <h2 className="text-xl font-bold text-white text-center break-words">{otherUser.name}</h2>
                    <p className="text-sm text-gray-500 mt-1">Defina como este usuário te vê.</p>
                </div>

                <div className="p-4 space-y-4">
                    <label className="flex items-center justify-between cursor-pointer group">
                        <div className="flex flex-col">
                            <span className="text-gray-200 font-medium group-hover:text-white transition">Ocultar meu Nome</span>
                            <span className="text-xs text-gray-500">Ele verá "Nome não cadastrado"</span>
                        </div>
                        <div className={`w-12 h-6 rounded-full transition-colors flex items-center px-1 ${contactPrivacy.hideName ? 'bg-indigo-600' : 'bg-gray-700'}`}>
                            <div className={`w-4 h-4 rounded-full bg-white transition-transform ${contactPrivacy.hideName ? 'translate-x-6' : 'translate-x-0'}`}></div>
                        </div>
                        <input type="checkbox" className="hidden" checked={contactPrivacy.hideName} onChange={() => togglePrivacy('hideName')} />
                    </label>

                    <label className="flex items-center justify-between cursor-pointer group">
                        <div className="flex flex-col">
                            <span className="text-gray-200 font-medium group-hover:text-white transition">Ocultar minha Foto</span>
                            <span className="text-xs text-gray-500">Ele verá uma foto em branco</span>
                        </div>
                        <div className={`w-12 h-6 rounded-full transition-colors flex items-center px-1 ${contactPrivacy.hideAvatar ? 'bg-indigo-600' : 'bg-gray-700'}`}>
                            <div className={`w-4 h-4 rounded-full bg-white transition-transform ${contactPrivacy.hideAvatar ? 'translate-x-6' : 'translate-x-0'}`}></div>
                        </div>
                        <input type="checkbox" className="hidden" checked={contactPrivacy.hideAvatar} onChange={() => togglePrivacy('hideAvatar')} />
                    </label>

                    <div className="pt-4 mt-2 border-t border-[#2a2a35]">
                        <button onClick={handleBlockUser} className={`w-full py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition ${isBlocked ? 'bg-gray-800 text-white hover:bg-gray-700' : 'bg-red-500/10 text-red-500 hover:bg-red-500/20'}`}>
                            <div className={isBlocked ? "icon-check" : "icon-ban"}></div>
                            {isBlocked ? 'Desbloquear Usuário' : 'Bloquear Usuário'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

window.ContactInfoModal = ContactInfoModal;