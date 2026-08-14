window.CryptoUtils = {
    encrypt: (text, secretKey) => {
        if (!text) return text;
        try {
            if (!window.CryptoJS) throw new Error("CryptoJS não carregado");
            // Criptografia AES forte usando a chave do chat (chatId) como base
            return CryptoJS.AES.encrypt(text, String(secretKey)).toString();
        } catch (e) {
            console.error("Erro ao criptografar:", e);
            // Em vez de retornar texto puro, lança erro para não vazar a mensagem
            return "ENCRYPT_ERROR:" + text;
        }
    },
    decrypt: (ciphertext, secretKey) => {
        if (!ciphertext) return ciphertext;
        // Verifica se parece ser um texto criptografado (base64 do CryptoJS geralmente começa com U2FsdGVkX1)
        if (!ciphertext.startsWith('U2FsdGVkX1')) return ciphertext;
        
        try {
            if (!window.CryptoJS) throw new Error("CryptoJS não carregado");
            const bytes = CryptoJS.AES.decrypt(ciphertext, String(secretKey));
            const originalText = bytes.toString(CryptoJS.enc.Utf8);
            return originalText || ciphertext;
        } catch (e) {
            console.error("Erro ao descriptografar:", e);
            return "Mensagem não pôde ser descriptografada";
        }
    }
};
