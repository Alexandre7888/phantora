// Tratamento global para erros do OneSignal
window.addEventListener('error', function(event) {
  if (event.message && (event.message.includes('No subscription') || event.message.includes('Visibility change error') || event.message.includes('create-subscription'))) {
    event.preventDefault();
    console.warn('Ignorado erro inofensivo do OneSignal:', event.message);
  }
});

window.addEventListener('unhandledrejection', function(event) {
  if (event.reason && (
      (typeof event.reason === 'string' && (event.reason.includes('No subscription') || event.reason.includes('Visibility change error'))) ||
      (event.reason.message && (event.reason.message.includes('No subscription') || event.reason.message.includes('Visibility change error')))
  )) {
    event.preventDefault();
    console.warn('Ignorado aviso de promise do OneSignal:', event.reason);
  }
});

// ==========================================================
// HELPER: ESPERA O FIREBASE RESTAURAR A SESSÃO
// ==========================================================
function waitForAuthReady(timeout = 5000) {
    return new Promise((resolve, reject) => {
        if (window.firebaseAuth?.currentUser) {
            return resolve(window.firebaseAuth.currentUser);
        }

        const auth = window.firebaseAuth || (typeof firebase !== 'undefined' && firebase.auth ? firebase.auth() : null);
        
        if (!auth) {
            return reject(new Error("Firebase Auth não disponível"));
        }

        if (auth.currentUser) {
            return resolve(auth.currentUser);
        }

        const timeoutId = setTimeout(() => {
            unsubscribe();
            reject(new Error("Timeout aguardando autenticação"));
        }, timeout);

        const unsubscribe = auth.onAuthStateChanged((user) => {
            clearTimeout(timeoutId);
            unsubscribe();
            resolve(user);
        });
    });
}

// ==========================================================
// HELPER: OBTER TOKEN FRESCO DO FIREBASE
// ==========================================================
async function getFirebaseToken() {
    try {
        console.log("⏳ [getFirebaseToken] Aguardando sessão...");
        const user = await waitForAuthReady(5000);

        if (!user) {
            console.error("❌ [getFirebaseToken] Sem usuário logado");
            return null;
        }

        const token = await user.getIdToken(true);
        console.log("✅ [getFirebaseToken] Token gerado:", token.substring(0, 30) + "...");
        return token;

    } catch (e) {
        console.error("❌ [getFirebaseToken] Erro:", e.message);
        return null;
    }
}

const api = {
  // CodeHUB API
  getCodeHubUser: async (userkey) => {
    try {
      const response = await fetch(`https://code-hub-eta.vercel.app/api/userkey.js?userkey=${encodeURIComponent(userkey)}`);
      return await response.json();
    } catch (error) {
      console.error('CodeHUB API Error:', error);
      throw error;
    }
  },

  // Firebase Realtime Database REST API
  getAuthMap: async (privateId) => {
    try {
      const response = await fetch(`https://html-785e3-default-rtdb.firebaseio.com/auth_map/${privateId}.json`);
      return await response.json();
    } catch (error) {
      console.error('Firebase Get Auth Map Error:', error);
      throw error;
    }
  },

  saveAuthMap: async (privateId, publicId) => {
    try {
      const response = await fetch(`https://html-785e3-default-rtdb.firebaseio.com/auth_map/${privateId}.json`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ publicId })
      });
      return await response.json();
    } catch (error) {
      console.error('Firebase Save Auth Map Error:', error);
      throw error;
    }
  },

  getFirebaseUser: async (publicId) => {
    try {
      const response = await fetch(`https://html-785e3-default-rtdb.firebaseio.com/users/${publicId}.json`);
      return await response.json();
    } catch (error) {
      console.error('Firebase Get Error:', error);
      throw error;
    }
  },

  saveFirebaseUser: async (publicId, data) => {
    try {
      const response = await fetch(`https://html-785e3-default-rtdb.firebaseio.com/users/${publicId}.json`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      return await response.json();
    } catch (error) {
      console.error('Firebase Save Error:', error);
      throw error;
    }
  },
  
  fileToBase64: (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result);
      reader.onerror = error => reject(error);
    });
  },

  uploadImageToService: async (file, action = "upload", targetName = null) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = async function() {
        try {
          const URL = "https://script.google.com/macros/s/AKfycbzYlwb6VwgfW9R2ZKQ3QEIvPwakVAAdcfLxPN8gIFcMdpAzyTsZn1ZnglCuwKEpkOla/exec";
          
          const payload = { action: action, file: reader.result };
          if (action === "replace" && targetName) payload.targetName = targetName;
          else payload.fileName = file.name;

          const resposta = await fetch(URL, {
            method: "POST",
            headers: { "Content-Type": "text/plain" },
            body: JSON.stringify(payload)
          });
          const dados = await resposta.json();
          if (dados.url) resolve(dados.url);
          else reject("Erro no upload");
        } catch (e) { reject(e); }
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  },
  
  deleteMediaFromService: async (fileName) => {
    try {
      const URL = "https://script.google.com/macros/s/AKfycbzYlwb6VwgfW9R2ZKQ3QEIvPwakVAAdcfLxPN8gIFcMdpAzyTsZn1ZnglCuwKEpkOla/exec";
      const resposta = await fetch(URL, {
        method: "POST",
        headers: { "Content-Type": "text/plain" },
        body: JSON.stringify({ action: "delete", fileName })
      });
      const dados = await resposta.json();
      return dados.success || true;
    } catch (e) {
      console.error(e);
      return false;
    }
  },

  compressImage: (file, maxWidth = 800, quality = 0.6) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target.result;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width, height = img.height;
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL('image/jpeg', quality));
        };
        img.onerror = reject;
      };
      reader.onerror = reject;
    });
  },

  sendCallNotificationDirect: async (pushIds, callUrl) => {
    if (pushIds && pushIds.length > 0) {
        const idsStr = pushIds.join(',');
        const titulo = encodeURIComponent("Chamada recebida");
        const mensagem = encodeURIComponent("Toque para atender");
        const urlEnc = encodeURIComponent(callUrl);
        const buttons = encodeURIComponent(`Atender;${callUrl}`);
        const scriptUrl = `https://script.google.com/macros/s/AKfycbyAJYuSOdIa2ijOToQy0X_ZgM7N7e3lH5fPYORipXumqFw9OaNQ7CbYlz8oefsaL7qu/exec?ids=${idsStr}&titulo=${titulo}&mensagem=${mensagem}&url=${urlEnc}&buttons=${buttons}`;
        try {
            await fetch(scriptUrl, { mode: 'no-cors' });
        } catch (e) {
            console.warn('Notification error:', e);
        }
    }
  },

  sendCallNotification: async (targetIds, callUrl) => {
    if (!window.firebaseDB) return;
    try {
      let pushIds = [];
      for (const uid of targetIds) {
        const snap = await window.firebaseDB.ref(`users/${uid}/oneSignalId`).once('value');
        const pushId = snap.val();
        if (pushId) pushIds.push(pushId);
      }
      if (pushIds.length > 0) {
        const idsStr = pushIds.join(',');
        const titulo = encodeURIComponent("Chamada recebida");
        const mensagem = encodeURIComponent("Toque para atender");
        const urlEnc = encodeURIComponent(callUrl);
        const buttons = encodeURIComponent(`Atender;${callUrl}`);
        const scriptUrl = `https://script.google.com/macros/s/AKfycbyAJYuSOdIa2ijOToQy0X_ZgM7N7e3lH5fPYORipXumqFw9OaNQ7CbYlz8oefsaL7qu/exec?ids=${idsStr}&titulo=${titulo}&mensagem=${mensagem}&url=${urlEnc}&buttons=${buttons}`;
        try {
            await fetch(scriptUrl, { mode: 'no-cors' });
            return true;
        } catch (err) {
            return false;
        }
      }
      return false;
    } catch (error) {
      console.error('Call Notification Error:', error);
      return false;
    }
  },

  sendNotification: async (targetUserId, title, message) => {
    if (!window.firebaseDB) return;
    try {
      const snap = await window.firebaseDB.ref(`users/${targetUserId}/oneSignalId`).once('value');
      const pushId = snap.val();
      if (pushId) {
        const titulo = encodeURIComponent(title);
        const mensagem = encodeURIComponent(message);
        const scriptUrl = `https://script.google.com/macros/s/AKfycbyAJYuSOdIa2ijOToQy0X_ZgM7N7e3lH5fPYORipXumqFw9OaNQ7CbYlz8oefsaL7qu/exec?ids=${pushId}&titulo=${titulo}&mensagem=${mensagem}`;
        try {
            await fetch(scriptUrl, { mode: 'no-cors' });
        } catch (e) { console.error(e); }
      }
    } catch (error) { console.error(error); }
  },

  setUserOnlineStatus: async (userId, isOnline) => {
    if (!window.firebaseDB) return;
    try {
        const statusRef = window.firebaseDB.ref(`users/${userId}/status`);
        await statusRef.update({
            online: isOnline,
            lastSeen: window.firebase.database.ServerValue.TIMESTAMP
        });
        if (isOnline) {
            statusRef.onDisconnect().update({
                online: false,
                lastSeen: window.firebase.database.ServerValue.TIMESTAMP
            });
        }
    } catch (e) {
        console.error("Erro ao definir status online:", e);
    }
  },

  // ==========================================================
  // UPLOAD PARA CDN — ENVIA TÍTULO + METADADOS (OBRIGATÓRIOS)
  // ==========================================================
  uploadToCDN: async (file, uid, folderType, metadata = {}) => {
    console.log("🚀 [uploadToCDN] Iniciando...");
    console.log("   file:", file?.name, file?.size, "bytes");
    console.log("   uid:", uid);
    console.log("   folderType:", folderType);
    console.log("   metadata:", metadata);

    // 1. Gera token fresco agora
    const token = await getFirebaseToken();

    if (!token) {
        throw new Error("Usuário não autenticado. Faça login para enviar arquivos.");
    }

    console.log("   ✅ Token gerado");

    // 2. Detecta o tipo automaticamente
    let detectedType = metadata.type;
    if (!detectedType) {
        if (file.type.startsWith('video/')) detectedType = 'video';
        else if (file.type.startsWith('image/')) detectedType = 'image';
        else detectedType = 'text';
    }

    // 3. Monta FormData COM todos os campos obrigatórios
    const formData = new FormData();
    formData.append('file', file);
    formData.append('folder', `${uid}/${folderType}`);
    formData.append('title', metadata.title || 'Sem título');     // ⬅️ OBRIGATÓRIO
    formData.append('description', metadata.description || '');
    formData.append('type', detectedType);
    formData.append('textContent', metadata.textContent || '');

    console.log("   📦 FormData montado:");
    console.log("      - title:", metadata.title || 'Sem título');
    console.log("      - type:", detectedType);
    console.log("      - folder:", `${uid}/${folderType}`);

    // 4. Monta URL com token
    const uploadUrl = `https://cdn-phantora-api.puter.work/upload?auth=${encodeURIComponent(token)}`;
    console.log("   📤 Enviando para CDN...");

    // 5. Faz o upload DIRETO
    const res = await fetch(uploadUrl, {
        method: "POST",
        body: formData
    });

    console.log("   📥 Status:", res.status);

    if (!res.ok) {
        const errText = await res.text();
        console.error("   ❌ Erro HTTP:", res.status, errText.substring(0, 300));
        throw new Error(`Servidor retornou status ${res.status}: ${errText.substring(0, 100)}`);
    }

    // 6. Processa resposta
    const text = await res.text();
    let data;
    try {
        data = JSON.parse(text);
    } catch (e) {
        console.error("   ❌ Resposta não é JSON:", text.substring(0, 200));
        throw new Error("Servidor da CDN retornou resposta inválida.");
    }

    if (data.success) {
        console.log("   ✅ Upload OK! Resposta completa:", data);
        return data;  // ⬅️ Retorna TUDO (success, url, postId, etc.)
    } else {
        console.error("   ❌ success: false", data);
        throw new Error(data.error || 'Erro no upload para CDN');
    }
  },

  // ==========================================================
  // DELETE DO CDN — SEM PROXY
  // ==========================================================
  deleteFromCDN: async (filename) => {
    const key = "phantora-secret-key-123";
    const token = await getFirebaseToken();
    try {
        const url = token 
            ? `https://cdn-phantora-api.puter.work/manage?auth=${encodeURIComponent(token)}`
            : `https://cdn-phantora-api.puter.work/manage`;
        const res = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ key, action: "delete", filename, auth: token })
        });
        const data = await res.json();
        return data.success;
    } catch (err) {
        console.error("Delete CDN Error:", err);
        return false;
    }
  }
};

window.api = api;
