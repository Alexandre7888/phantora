function Login() {
  const [step, setStep] = React.useState(0);

  React.useEffect(() => {
    // Sequence of animations
    const timers = [
      setTimeout(() => setStep(1), 500),   // Show "Venha se juntar..."
      setTimeout(() => setStep(2), 3000),  // Show "...ao nosso lar."
      setTimeout(() => setStep(3), 5500),  // Show "Comece para fazer login"
      setTimeout(() => setStep(4), 6500)   // Show login card
    ];
    return () => timers.forEach(clearTimeout);
  }, []);

  const [showDeviceLogin, setShowDeviceLogin] = React.useState(false);
  const [deviceId, setDeviceId] = React.useState(null);

  React.useEffect(() => {
    if (showDeviceLogin && !deviceId) {
      const newId = 'dev_' + Math.random().toString(36).substring(2, 15);
      setDeviceId(newId);
    }
  }, [showDeviceLogin]);

  React.useEffect(() => {
    if (!deviceId || !window.firebaseDB) return;
    
    const authRef = window.firebaseDB.ref(`device_auth/${deviceId}`);
    
    const listener = authRef.on('value', (snap) => {
      const data = snap.val();
      if (data && data.status === 'approved' && data.userKey) {
        localStorage.setItem("userkey", data.userKey);
        authRef.remove().then(() => {
          window.location.reload();
        }).catch(() => {
          window.location.reload();
        });
      }
    });

    return () => authRef.off('value', listener);
  }, [deviceId]);

  const handleLogin = () => {
    window.location.href = "https://alexandre7888.github.io/sync-auth?redirect=https://phantora.codehub.site.je";
  };

  return (
    <div className="min-h-[100dvh] flex items-center justify-center bg-gradient-to-br from-gray-900 via-indigo-900 to-purple-900 p-4 relative overflow-hidden pt-4 sm:pt-8" data-name="login" data-file="components/Login.js">
      
      {/* Background Particles/Stars */}
      <div className="absolute inset-0 pointer-events-none opacity-50">
        {[...Array(20)].map((_, i) => (
          <div key={i} className="absolute bg-white rounded-full animate-pulse" style={{
            width: Math.random() * 4 + 1 + 'px',
            height: Math.random() * 4 + 1 + 'px',
            top: Math.random() * 100 + '%',
            left: Math.random() * 100 + '%',
            animationDuration: (Math.random() * 3 + 2) + 's'
          }}></div>
        ))}
      </div>

      <div className="relative z-10 w-full max-w-sm flex flex-col items-center justify-center h-full text-center">
        
        {/* Animated Welcome Texts */}
        <div className="flex flex-col items-center justify-center mb-6 mt-[-40px]">
          <h2 className={`text-2xl sm:text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-300 transition-all duration-1000 transform leading-tight ${step >= 1 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
            Venha se juntar à nossa comunidade
          </h2>
          <h2 className={`text-2xl sm:text-3xl font-extrabold text-white mt-1 transition-all duration-1000 transform leading-tight ${step >= 2 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
            ao nosso lar.
          </h2>
          <p className={`text-sm sm:text-base text-indigo-200 mt-3 font-medium transition-all duration-1000 transform ${step >= 3 ? 'opacity-100 scale-100' : 'opacity-0 scale-90'}`}>
            Comece para fazer login
          </p>
        </div>

        {/* Login Card */}
        <div className={`bg-white/10 backdrop-blur-xl p-5 sm:p-6 rounded-2xl shadow-2xl w-full border border-white/20 transition-all duration-1000 transform ${step >= 4 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-12 pointer-events-none'}`}>
          
          {!showDeviceLogin ? (
            <>
              <div className="w-16 h-16 bg-gradient-to-tr from-indigo-500 to-purple-500 rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg shadow-purple-500/30">
                <div className="icon-fingerprint text-3xl text-white"></div>
              </div>
              
              <button 
                onClick={handleLogin}
                className="w-full bg-white text-indigo-900 hover:bg-indigo-50 font-bold py-3 px-4 rounded-xl transition duration-300 flex items-center justify-center gap-2 mb-3 shadow-lg hover:shadow-xl hover:-translate-y-1 text-sm sm:text-base"
              >
                <div className="icon-log-in text-xl"></div>
                Entrar na Conta
              </button>

              <button 
                onClick={() => setShowDeviceLogin(true)}
                className="w-full bg-indigo-800/50 text-white hover:bg-indigo-700/60 font-bold py-3 px-4 rounded-xl transition duration-300 flex items-center justify-center gap-2 mb-4 border border-indigo-400/30 shadow-lg hover:shadow-xl hover:-translate-y-1 text-sm sm:text-base"
              >
                <div className="icon-smartphone text-xl"></div>
                Entrar com Dispositivo
              </button>

              <div className="text-[10px] sm:text-xs text-indigo-200/70 leading-tight">
                Ao entrar, você concorda com nossos <br/>
                <a href="termos.html" className="text-white hover:underline">Termos de Uso</a> e <a href="privacidade.html" className="text-white hover:underline">Política de Privacidade</a>.
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center">
              <button 
                onClick={() => setShowDeviceLogin(false)}
                className="absolute top-3 left-3 p-2 text-indigo-200 hover:text-white"
              >
                <div className="icon-arrow-left text-lg"></div>
              </button>
              
              <h3 className="text-base font-bold text-white mb-1 mt-1">Conectar Dispositivo</h3>
              <p className="text-[11px] text-indigo-200 mb-3 leading-tight px-4">Escaneie o QR Code no seu dispositivo principal ou digite o ID.</p>
              
              {deviceId && (
                <div className="bg-white p-2 rounded-xl shadow-inner mb-3 w-full flex justify-center py-3">
                  <img 
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent('https://app.mensagens.site.je/?deviceId=' + deviceId)}`} 
                    alt="QR Code" 
                    className="w-28 h-28 sm:w-32 sm:h-32"
                  />
                </div>
              )}
              
              <div className="bg-indigo-900/50 border border-indigo-500/30 rounded-xl p-3 w-full mb-2 flex flex-col items-center justify-center min-h-[60px]">
                <p className="text-[9px] text-indigo-300 mb-1 uppercase font-bold tracking-wider">ID do Dispositivo:</p>
                <p className="text-lg font-mono text-white tracking-widest break-all select-all text-center">{deviceId}</p>
              </div>

              <div className="flex items-center gap-2 text-indigo-200 text-[11px] mt-1 animate-pulse">
                <div className="icon-loader animate-spin text-sm"></div>
                Aguardando aprovação...
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
window.Login = Login;
