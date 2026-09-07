function ProfileEditor({ user, onClose, onSave }) {
    const [name, setName] = React.useState(user.name || '');
    const [username, setUsername] = React.useState(user.username || '');
    const [bio, setBio] = React.useState(user.bio || '');
    const [avatar, setAvatar] = React.useState(user.avatar || '');
    const [isSaving, setIsSaving] = React.useState(false);
    const [showCropper, setShowCropper] = React.useState(false);
    const [tempImage, setTempImage] = React.useState(null);
    const [errorMsg, setErrorMsg] = React.useState('');
    const cropperRef = React.useRef(null);
    const imageElementRef = React.useRef(null);

    React.useEffect(() => {
        if (!window.firebaseDB || !user?.id) return undefined;

        const avatarRef = window.firebaseDB.ref(`users/${user.id}/avatar`);
        const listener = avatarRef.on('value', (snap) => {
            if (snap.exists()) {
                setAvatar(snap.val());
            }
        });

        return () => avatarRef.off('value', listener);
    }, [user?.id]);

    const handleFileChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = () => {
                setTempImage(reader.result);
                setShowCropper(true);
            };
            reader.readAsDataURL(file);
        }
    };

    React.useEffect(() => {
        if (showCropper && tempImage && imageElementRef.current) {
            try {
                if (cropperRef.current) {
                    cropperRef.current.destroy();
                }
                if (window.Cropper) {
                    cropperRef.current = new window.Cropper(imageElementRef.current, {
                        aspectRatio: 1,
                        viewMode: 1,
                        background: false,
                        autoCropArea: 1,
                    });
                } else {
                    console.error("CropperJS não encontrado!");
                    setErrorMsg("Erro ao carregar editor de imagem.");
                    setShowCropper(false);
                }
            } catch (err) {
                console.error("Erro ao inicializar Cropper:", err);
                setErrorMsg("Erro ao iniciar recorte de imagem.");
                setShowCropper(false);
            }
        }
        return () => {
            try {
                if (cropperRef.current) {
                    cropperRef.current.destroy();
                }
            } catch (e) {}
        };
    }, [showCropper, tempImage]);

    const handleCrop = async () => {
        if (!cropperRef.current) return;
        const canvas = cropperRef.current.getCroppedCanvas({ width: 400, height: 400 });
        if (!canvas) return;

        const base64 = canvas.toDataURL('image/jpeg', 0.8);
        
        setIsSaving(true);
        setShowCropper(false);
        try {
            const res = await fetch(base64);
            const blob = await res.blob();
            const fileName = user?.id ? `avatar_${user.id}.jpg` : "profile.jpg";
            const file = new File([blob], fileName, { type: "image/jpeg" });
            
            const action = avatar && avatar.includes(fileName) ? 'replace' : 'upload';
            const targetName = action === 'replace' ? fileName : null;

            const url = await window.api.uploadImageToService(file, action, targetName);
            
            const baseUrl = url.split('?')[0];
            const versionedUrl = `${baseUrl}?v=${Date.now()}`;
            
            setAvatar(versionedUrl);
            
            // Mantém os dois campos sincronizados durante a migração dos
            // componentes antigos que ainda leem profilePicture.
            if (window.firebaseDB && user?.id) {
                await window.firebaseDB.ref(`users/${user.id}`).update({
                    avatar: versionedUrl,
                    profilePicture: versionedUrl
                });
            }
        } catch (err) {
            setErrorMsg("Erro ao enviar imagem: " + err.message);
        } finally {
            setIsSaving(false);
        }
    };

    const handleSave = async () => {
        if (!window.firebaseDB) return;
        
        const cleanUsername = username.trim().toLowerCase().replace(/[^a-z0-9_.]/g, '');
        if (cleanUsername.length < 3) {
            setErrorMsg("O nome de usuário (@) deve ter pelo menos 3 caracteres válidos.");
            return;
        }

        setIsSaving(true);
        setErrorMsg('');

        try {
            // Verificar se username já existe em outro uid
            const usersSnap = await window.firebaseDB.ref('users').orderByChild('username').equalTo(cleanUsername).once('value');
            if (usersSnap.exists()) {
                const data = usersSnap.val();
                const existingUid = Object.keys(data)[0];
                if (existingUid !== user.id) {
                    setErrorMsg("Este @nome_de_usuario já está em uso.");
                    setIsSaving(false);
                    return;
                }
            }

            const updates = {
                nome: name,
                name: name,
                username: cleanUsername,
                bio: bio,
                avatar: avatar,
                profilePicture: avatar
            };

            await window.firebaseDB.ref(`users/${user.id}`).update(updates);
            
            if (window.currentUserData) {
                Object.assign(window.currentUserData, updates);
            }
            
            if (onSave) onSave({ ...user, ...updates });
            onClose();
        } catch (err) {
            setErrorMsg("Erro ao salvar: " + err.message);
        } finally {
            setIsSaving(false);
        }
    };

    if (showCropper) {
        return (
            <div className="fixed inset-0 z-[110] bg-primary flex flex-col p-4 animate-fade-in">
                <h3 className="text-white text-center mb-4 font-bold text-lg">Recortar Foto de Perfil</h3>
                <div className="flex-1 bg-black rounded-lg overflow-hidden relative">
                    <img ref={imageElementRef} src={tempImage} className="max-w-full block" />
                </div>
                <div className="flex gap-4 mt-6 mb-4">
                    <button onClick={() => setShowCropper(false)} className="flex-1 bg-secondary text-white py-3 rounded-xl font-bold">Cancelar</button>
                    <button onClick={handleCrop} disabled={isSaving} className="flex-1 bg-accent text-white py-3 rounded-xl font-bold">{isSaving ? 'Enviando...' : 'Aplicar'}</button>
                </div>
            </div>
        );
    }

    return (
        <div className="fixed inset-0 z-[100] bg-primary flex flex-col animate-fade-in text-text-primary font-sans" data-name="profile-editor">
            <header className="bg-secondary border-b border-border px-4 py-3 flex items-center justify-between sticky top-0 z-10">
                <div className="flex items-center gap-3">
                    <button onClick={onClose} className="text-text-secondary hover:text-white transition-colors">
                        <div className="icon-arrow-left text-2xl"></div>
                    </button>
                    <h2 className="text-lg font-bold">Editar Perfil</h2>
                </div>
                <button 
                    onClick={handleSave} 
                    disabled={isSaving}
                    className="bg-accent text-white px-5 py-1.5 rounded-lg font-bold text-sm hover:bg-accent-hover transition-colors disabled:opacity-50"
                >
                    {isSaving ? 'Salvando...' : 'Salvar'}
                </button>
            </header>

            <div className="flex-1 overflow-y-auto p-4 md:p-8 max-w-2xl mx-auto w-full">
                {errorMsg && (
                    <div className="mb-6 p-3 bg-red-900/20 border border-red-900/50 text-red-400 rounded-lg text-sm text-center">
                        {errorMsg}
                    </div>
                )}

                <div className="flex flex-col items-center mb-8">
                    <div className="relative group cursor-pointer" onClick={() => document.getElementById('avatar-upload-editor').click()}>
                        <img 
                            src={avatar || 'https://ui-avatars.com/api/?name=U&background=random'} 
                            className="w-24 h-24 md:w-32 md:h-32 rounded-full object-cover border-4 border-secondary shadow-lg"
                        />
                        <div className="absolute inset-0 bg-black/50 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                            <div className="icon-camera text-white text-3xl"></div>
                        </div>
                        <input 
                            type="file" 
                            id="avatar-upload-editor" 
                            accept="image/*" 
                            className="hidden" 
                            onChange={handleFileChange}
                        />
                    </div>
                    <button 
                        onClick={() => document.getElementById('avatar-upload-editor').click()}
                        className="mt-4 text-accent font-semibold text-sm hover:text-accent-hover transition-colors"
                    >
                        Alterar foto de perfil
                    </button>
                </div>

                <div className="space-y-6">
                    <div>
                        <label className="block text-sm font-semibold text-text-secondary mb-2">Nome</label>
                        <input 
                            type="text" 
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className="w-full bg-secondary border border-border rounded-xl px-4 py-3 text-white focus:outline-none focus:border-accent transition-all"
                            placeholder="Seu nome"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-semibold text-text-secondary mb-2">Nome de Usuário (@)</label>
                        <div className="relative">
                            <span className="absolute left-4 top-3 text-gray-500 font-bold">@</span>
                            <input 
                                type="text" 
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                className="w-full bg-secondary border border-border rounded-xl pl-9 pr-4 py-3 text-white focus:outline-none focus:border-accent transition-all"
                                placeholder="nome_de_usuario"
                            />
                        </div>
                        <p className="text-xs text-text-muted mt-1">Apenas letras minúsculas, números, pontos e underlines.</p>
                    </div>
                    
                    <div>
                        <label className="block text-sm font-semibold text-text-secondary mb-2">Biografia</label>
                        <textarea 
                            value={bio}
                            onChange={(e) => setBio(e.target.value)}
                            rows="4"
                            className="w-full bg-secondary border border-border rounded-xl px-4 py-3 text-white focus:outline-none focus:border-accent transition-all resize-none"
                            placeholder="Conte um pouco sobre você..."
                        ></textarea>
                    </div>
                </div>
            </div>
        </div>
    );
}

window.ProfileEditor = ProfileEditor;
