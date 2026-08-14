function StudioConsole() {
    const [logs, setLogs] = React.useState([]);
    const [isOpen, setIsOpen] = React.useState(false);
    const consoleEndRef = React.useRef(null);

    React.useEffect(() => {
        const originalLog = console.log;
        const originalError = console.error;
        const originalWarn = console.warn;
        const originalInfo = console.info;

        const handleLog = (type, args) => {
            const message = Array.from(args).map(arg => {
                if (typeof arg === 'object') {
                    try {
                        return JSON.stringify(arg, null, 2);
                    } catch (e) {
                        return String(arg);
                    }
                }
                return String(arg);
            }).join(' ');

            setLogs(prev => [...prev, { type, message, time: new Date().toLocaleTimeString() }]);
        };

        console.log = function() {
            handleLog('log', arguments);
            originalLog.apply(console, arguments);
        };

        console.error = function() {
            handleLog('error', arguments);
            originalError.apply(console, arguments);
        };

        console.warn = function() {
            handleLog('warn', arguments);
            originalWarn.apply(console, arguments);
        };

        console.info = function() {
            handleLog('info', arguments);
            originalInfo.apply(console, arguments);
        };

        // Welcome message
        console.log("Console interativo iniciado.");

        return () => {
            console.log = originalLog;
            console.error = originalError;
            console.warn = originalWarn;
            console.info = originalInfo;
        };
    }, []);

    React.useEffect(() => {
        if (consoleEndRef.current) {
            consoleEndRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [logs, isOpen]);

    if (!isOpen) {
        return (
            <button 
                onClick={() => setIsOpen(true)}
                className="fixed bottom-4 right-4 bg-gray-800 border border-gray-700 text-white px-4 py-2 rounded-lg shadow-lg flex items-center gap-2 hover:bg-gray-700 z-[9999]"
            >
                <div className="icon-terminal"></div>
                Console
                {logs.length > 0 && (
                    <span className="bg-indigo-600 text-xs px-2 py-0.5 rounded-full">{logs.length}</span>
                )}
            </button>
        );
    }

    return (
        <div className="fixed bottom-0 right-0 lg:w-[500px] w-full h-[300px] bg-gray-900 border-t border-l border-gray-700 shadow-2xl flex flex-col z-[9999] rounded-tl-xl font-mono text-sm">
            <div className="flex items-center justify-between px-4 py-2 bg-gray-800 border-b border-gray-700 rounded-tl-xl">
                <div className="flex items-center gap-2 text-gray-300">
                    <div className="icon-terminal text-indigo-400"></div>
                    <span className="font-semibold">Console do Desenvolvedor</span>
                </div>
                <div className="flex items-center gap-2">
                    <button 
                        onClick={() => setLogs([])}
                        className="p-1 hover:bg-gray-700 rounded text-gray-400 hover:text-white"
                        title="Limpar Console"
                    >
                        <div className="icon-trash-2"></div>
                    </button>
                    <button 
                        onClick={() => setIsOpen(false)}
                        className="p-1 hover:bg-gray-700 rounded text-gray-400 hover:text-white"
                        title="Fechar Console"
                    >
                        <div className="icon-chevron-down"></div>
                    </button>
                </div>
            </div>
            
            <div className="flex-1 overflow-y-auto p-2 space-y-1">
                {logs.length === 0 ? (
                    <div className="text-gray-500 italic text-center mt-4">Nenhum log registrado.</div>
                ) : (
                    logs.map((log, index) => (
                        <div 
                            key={index} 
                            className={`px-2 py-1 rounded border-l-2 ${
                                log.type === 'error' ? 'bg-red-900/20 border-red-500 text-red-400' :
                                log.type === 'warn' ? 'bg-yellow-900/20 border-yellow-500 text-yellow-400' :
                                log.type === 'info' ? 'bg-blue-900/20 border-blue-500 text-blue-400' :
                                'border-gray-600 text-gray-300 hover:bg-gray-800'
                            }`}
                        >
                            <span className="text-gray-500 mr-2 text-xs">[{log.time}]</span>
                            <span className="whitespace-pre-wrap break-words">{log.message}</span>
                        </div>
                    ))
                )}
                <div ref={consoleEndRef} />
            </div>
        </div>
    );
}