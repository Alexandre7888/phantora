function AdminAuth({ onSuccess, onFail }) {
  const [deviceId, setDeviceId] = React.useState('');
  const [error, setError] = React.useState('');
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
      // Generate or retrieve device ID
      let id = localStorage.getItem('admin_device_id');
      if (!id) {
          id = 'dev_' + Math.random().toString(36).substr(2, 9) + Date.now().toString(36);
          localStorage.setItem('admin_device_id', id);
      }
      setDeviceId(id);
  }, []);

  const checkAuthorization = async () => {
    if (!deviceId) return;
    setLoading(true);
    setError('');
    
    try {
        const db = window.firebaseDB;
        if (!db) {
            setError('Banco de dados não conectado.');
            setLoading(false);
            return;
        }

        const snap = await db.ref(`admin_devices/${deviceId}`).once('value');
        if (snap.exists() && snap.val() === true) {
            onSuccess();
        } else {
            setError('Dispositivo não autorizado pelo Firebase.');
        }
    } catch (err) {
        console.error(err);
        setError('Erro ao verificar autorização.');
    }
    
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4">
      <div className="icon-shield text-6xl text-indigo-500 mb-6"></div>
      <h2 className="text-2xl font-bold mb-6 text-white">Trava de Dispositivo</h2>
      
      <div className="w-full max-w-md bg-gray-800 p-8 rounded-xl shadow-lg border border-gray-700 text-center">
        <p className="text-gray-300 text-sm mb-4">
            Para acessar o painel, este dispositivo precisa estar autorizado no banco de dados (Firebase).
        </p>
        
        <div className="bg-gray-900 p-4 rounded-lg border border-gray-700 mb-6 break-all">
            <span className="block text-xs text-gray-500 mb-1">Seu ID de Dispositivo:</span>
            <strong className="text-indigo-400 font-mono select-all">{deviceId || 'Gerando...'}</strong>
        </div>
        
        {error && <p className="text-red-400 text-sm mb-4">{error}</p>}
        
        <button 
            onClick={checkAuthorization}
            disabled={loading || !deviceId}
            className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold py-3 px-4 rounded transition-colors flex items-center justify-center gap-2"
        >
            {loading ? <div className="icon-loader animate-spin text-lg"></div> : <span className="icon-lock-open text-lg"></span>}
            Verificar Acesso
        </button>
      </div>
      
      <p className="mt-6 text-xs text-gray-500 max-w-sm text-center">
        Adicione seu ID de Dispositivo no nó <code className="bg-gray-800 px-1 rounded text-gray-300">admin_devices/{deviceId || 'ID'} : true</code> do Realtime Database para liberar o acesso.
      </p>
    </div>
  );
}
window.AdminAuth = AdminAuth;