window.PrivacyManager = {
    checkVisibility: async function(targetUserId, viewerId, type) {
        if (!window.firebaseDB || !targetUserId || !viewerId) return true;
        const db = window.firebaseDB;

        try {
            // First check if there is a specific user rule
            const specificPrivacySnap = await db.ref(`user_specific_privacy/${targetUserId}/${viewerId}`).once('value');
            const specificPrivacy = specificPrivacySnap.val();
            
            if (specificPrivacy) {
                if (type === 'name' && specificPrivacy.hideName) return false;
                if (type === 'profile' && specificPrivacy.hideAvatar) return false;
            }

            // Fallback to general settings
            const settingsSnap = await db.ref(`user_settings/${targetUserId}`).once('value');
            const settings = settingsSnap.val();
            if (!settings) return true;

            if (type === 'profile') {
                return settings.profileVisibility !== 'none';
            }
            if (type === 'name') {
                return settings.nameVisibility !== 'none';
            }
            
            return true;
        } catch (e) {
            console.error("Erro ao checar visibilidade:", e);
            return true;
        }
    }
};