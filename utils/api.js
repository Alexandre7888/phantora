// Tratamento global para evitar que erros do OneSignal quebrem a aplicação
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
// HELPER: OBTER TOKEN FRESCO DO FIREBASE AUTH (NA HORA)
// ==========================================================
async function getFirebaseToken() {
  try {
    // Tentativa 1: window.firebaseAuth (compat)
    if (window.firebaseAuth) {
      const user = window.firebaseAuth.currentUser;
      if (user) {
        // ⬇️ getIdToken(true) FORÇA REFRESH DO TOKEN
        const token = await user.getIdToken(true);
        console.log("✅ [getFirebaseToken] Token gerado agora:", token.substring(0, 30) + "...");
        return token;
      } else {
        console.warn("⚠️ [getFirebaseToken] window.firebaseAuth existe mas currentUser é null");
      }
    } else {
      console.warn("⚠️ [getFirebaseToken] window.firebaseAuth não definido");
    }

    // Tentativa 2: firebase.auth() (compat global)
    if (typeof firebase !== 'undefined' && firebase.auth) {
      const user = firebase.auth().currentUser;
      if (user) {
        const token = await user.getIdToken(true);
        console.log("✅ [getFirebaseToken] Token gerado via firebase.auth():", token.substring(0, 30) + "...");
        return token;
      } else {
        console.warn("⚠️ [getFirebaseToken] firebase.auth() existe mas currentUser é null");
      }
    }

    // Tentativa 3: firebaseAuth modular (se existir)
    if (typeof window.auth !== 'undefined' && window.auth?.currentUser) {
      const token = await window.auth.currentUser.getIdToken(true);
      console.log("✅ [getFirebaseToken] Token gerado via window.auth");
      return token;
    }

    console.error("❌ [getFirebaseToken] Nenhum usuário autenticado encontrado!");
    return null;
  } catch (e) {
    console.error("❌ [getFirebaseToken] Erro ao gerar token:", e);
    return null;
  }
}

const api = {
  // CodeHUB API
  getCodeHubUser: async (userkey) => {
    try {
      let response;
      try {
        response = await fetch(`https://code-hub-eta.vercel.app/api/userkey.js?userkey=${encodeURIComponent(userkey)}`);
      } catch (e) {
        console.warn('Direct fetch failed, trying proxy...', e);
        response = await fetch(`https://proxy-api.trickle-app.host/?url=${encodeURIComponent(`https://code-hub-eta.vercel.app/api/userkey.js?userkey=${userkey}`)}`);
      }
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
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data)
      });
      return await response.json();
    } catch (error) {
      console.error('Firebase Save Error:', error);
      throw error;
    }
  },
  
  // Helper to convert file to base64
  fileToBase64: (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result);
      reader.onerror = error => reject(error);
    });
  },

  // Helper to compress image and convert to base64
  uploadImageToService: async (file, action = "upload", targetName = null) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = async function() {
        try {
          const URL = "https://script.google.com/macros/s/AKfycbzYlwb6VwgfW9R2ZKQ3QEIvPwakVAAdcfLxPN8gIFcMdpAzyTsZn1ZnglCuwKEpkOla/exec";
          
          const payload = {
            action: action,
            file: reader.result
          };

          if (action === "replace" && targetName) {
            payload.targetName = targetName;
          } else {
            payload.fileName = file.name;
          }

          const resposta = await fetch(URL, {
            method: "POST",
            headers: { "Content-Type": "text/plain" },
            body: JSON.stringify(payload)
          });
          const dados = await resposta.json();
          if (dados.url) {
            resolve(dados.url);
          } else {
            reject("Erro no upload");
          }
        } catch (e) {
          reject(e);
        }
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
          let width = img.width;
          let height = img.height;

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
            await fetch(`https://proxy-api.trickle-app.host/?url=${encodeURIComponent(scriptUrl)}`);
        } catch (e) {
            try {
                await fetch(scriptUrl, { mode: 'no-cors' });
            } catch (fallbackError) {
                console.warn('Fallback notification error:', fallbackError);
            }
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
            const response = await fetch(`https://proxy-api.trickle-app.host/?url=${encodeURIComponent(scriptUrl)}`);
            return response.ok;
        } catch (e) {
            try {
                await fetch(scriptUrl, { mode: 'no-cors' });
                return true;
            } catch (err) {
                return false;
            }
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
            console.log("Notificação enviada (no-cors)");
        } catch (e) {
            console.error("Erro ao enviar notificação:", e);
        }
      }
    } catch (error) {
      console.error('Notification Error:', error);
    }
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
  // UPLOAD PARA CDN — GERANDO TOKEN FRESCO NA HORA DO ENVIO
  // ==========================================================
  uploadToCDN: async (file, uid, folderType) => {
    console.log("🚀 [uploadToCDN] Iniciando upload...");
    console.log("   file:", file?.name, file?.size, "bytes");
    console.log("   uid:", uid, "| folder:", folderType);

    // ============ 1. GERA TOKEN FRESCO AGORA ============
    const token = await getFirebaseToken();

    if (!token) {
      console.error("❌ [uploadToCDN] Sem token, abortando upload");
      throw new Error("Usuário não autenticado. Faça login para enviar arquivos.");
    }

    console.log("   ✅ Token fresco gerado:", token.substring(0, 40) + "...");

    // ============ 2. MONTA FORMDATA ============
    const formData = new FormData();
    formData.append('file', file);
    formData.append('folder', `${uid}/${folderType}`);

    // ============ 3. MONTA URL COM TOKEN (igual g.html) ============
    const baseUrl = "https://cdn-phantora-api.puter.work/upload";
    const uploadUrl = `${baseUrl}?auth=${encodeURIComponent(token)}`;
    console.log("   📤 URL montada");

    try {
      let res;
      
      // ============ 4. TENTA DIRETO ============
      try {
        res = await fetch(uploadUrl, {
          method: "POST",
          body: formData
        });
        
        console.log("   📥 Status direto:", res.status);
        
        if (!res.ok) {
          const errText = await res.text();
          console.error("   ❌ Erro direto:", res.status, errText.substring(0, 200));
          throw new Error(`Status ${res.status}`);
        }
      } catch (directErr) {
        console.warn("   ⚠️ Upload direto falhou (CORS ou status):", directErr.message);
        
        // ============ 5. FALLBACK VIA PROXY ============
        console.log("   🔄 Tentando via proxy...");
        const proxiedUrl = "https://proxy-api.trickle-app.host/?url=" + encodeURIComponent(uploadUrl);
        
        res = await fetch(proxiedUrl, {
          method: "POST",
          body: formData
        });
        
        console.log("   📥 Status proxy:", res.status);
        
        if (!res.ok) {
          const errText = await res.text();
          console.error("   ❌ Erro proxy:", res.status, errText.substring(0, 200));
          throw new Error(`Proxy status ${res.status}`);
        }
      }

      // ============ 6. PARSEIA RESPOSTA ============
      const text = await res.text();
      console.log("   📄 Resposta:", text.substring(0, 200));

      let data;
      try {
        data = JSON.parse(text);
      } catch (parseError) {
        console.error("   ❌ Resposta não é JSON");
        throw new Error("Servidor da CDN retornou resposta inválida.");
      }

      if (data.success) {
        const fileUrl = data.file?.url || data.url || data.file_url || (typeof data.file === 'string' ? data.file : '');
        console.log("   ✅ Upload OK! URL:", fileUrl);
        return fileUrl;
      } else {
        console.error("   ❌ success: false", data);
        throw new Error(data.error || 'Erro no upload para CDN');
      }
    } catch (err) {
      console.error("   ❌❌❌ FALHA FINAL:", err);
      throw err;
    }
  },

  // ==========================================================
  // DELETE DO CDN — TAMBÉM GERA TOKEN FRESCO
  // ==========================================================
  deleteFromCDN: async (filename) => {
    const key = "phantora-secret-key-123";
    const token = await getFirebaseToken();
    
    try {
      const baseUrl = "https://cdn-phantora-api.puter.work/manage";
      const url = token 
        ? `${baseUrl}?auth=${encodeURIComponent(token)}` 
        : baseUrl;
      
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          key, 
          action: "delete", 
          filename,
          auth: token 
        })
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
