if (window.firebase) {
    const firebaseConfig = {
        apiKey: "AIzaSyDon4WbCbe4kCkUq-OdLBRhzhMaUObbAfo",
        authDomain: "html-15e80.firebaseapp.com",
        databaseURL: "https://html-15e80-default-rtdb.firebaseio.com",
        projectId: "html-15e80",
        storageBucket: "html-15e80.firebasestorage.app",
        messagingSenderId: "1068148640439",
        appId: "1:1068148640439:web:1ac651348e624f6be41b32",
        measurementId: "G-7E1VWN07GM"
    };

    firebase.initializeApp(firebaseConfig);
    
    window.firebaseDB = firebase.database();
    
    if (firebase.auth) {
        window.firebaseAuth = firebase.auth();
    }
    
    if (firebase.firestore) {
        window.firebaseFirestore = firebase.firestore();
    }
    
    if (firebase.storage) {
        window.firebaseStorage = firebase.storage();
    }
} else {
    console.error("Firebase SDK not loaded");
}
