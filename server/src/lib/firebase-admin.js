import admin from 'firebase-admin';

// Initialize Firebase Admin SDK
// In production, you would use a service account key file
// For development, we'll use the Firebase project ID and rely on default credentials
const initializeFirebaseAdmin = () => {
  try {
    if (!admin.apps.length) {
      // For development, you can use the Firebase project ID from environment
      // In production, use a service account key file
      const projectId = process.env.FIREBASE_PROJECT_ID || 'tic-tac-toe-ff1c7';
      
      if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
        // Production: Use service account key
        const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
        admin.initializeApp({
          credential: admin.credential.cert(serviceAccount),
          projectId: projectId
        });
      } else {
        // Development: Use project ID only (requires Firebase CLI auth)
        admin.initializeApp({
          projectId: projectId
        });
      }
      console.log('Firebase Admin initialized successfully');
    }
    return admin;
  } catch (error) {
    console.warn('Firebase Admin initialization failed:', error.message);
    return null;
  }
};

/**
 * Development fallback: decode a Firebase ID token (JWT) without full signature
 * verification. Used only when FIREBASE_SERVICE_ACCOUNT_KEY is absent so that
 * local development still works. DO NOT use in production.
 */
function decodeFirebaseTokenDev(idToken) {
  try {
    const parts = idToken.split('.');
    if (parts.length !== 3) throw new Error('Not a valid JWT');
    // Base64url-decode the payload section
    const payload = JSON.parse(
      Buffer.from(parts[1].replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8')
    );
    const projectId = process.env.FIREBASE_PROJECT_ID || 'tic-tac-toe-ff1c7';

    // Detect if this is actually a Firebase token by checking the issuer
    const expectedIss = `https://securetoken.google.com/${projectId}`;
    if (!payload.iss || !payload.iss.startsWith('https://securetoken.google.com/')) {
      throw new Error('Not a Firebase token (issuer mismatch)');
    }

    // Basic sanity checks
    if (payload.aud && payload.aud !== projectId) throw new Error(`Token audience mismatch: ${payload.aud}`);
    if (payload.exp < Math.floor(Date.now() / 1000)) throw new Error('Token expired');
    return {
      uid: payload.user_id || payload.sub,
      email: payload.email || '',
      emailVerified: payload.email_verified || false,
      name: payload.name || null,
      picture: payload.picture || null,
      provider: (payload.firebase && payload.firebase.sign_in_provider) || 'password'
    };
  } catch (err) {
    throw new Error(`Dev token decode failed: ${err.message}`);
  }
}

// Verify Firebase ID token
export const verifyFirebaseToken = async (idToken) => {
  // Try full admin verification first
  if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
    try {
      const firebaseAdmin = initializeFirebaseAdmin();
      if (!firebaseAdmin) throw new Error('Firebase Admin not initialized');
      const decodedToken = await firebaseAdmin.auth().verifyIdToken(idToken);
      return {
        uid: decodedToken.uid,
        email: decodedToken.email,
        emailVerified: decodedToken.email_verified,
        name: decodedToken.name,
        picture: decodedToken.picture,
        provider: decodedToken.firebase.sign_in_provider
      };
    } catch (error) {
      throw new Error(`Firebase token verification failed: ${error.message}`);
    }
  }

  // Development fallback: decode without signature verification
  console.warn('[firebase-admin] No FIREBASE_SERVICE_ACCOUNT_KEY — using dev token decode (no sig check)');
  return decodeFirebaseTokenDev(idToken);
};

export const firebaseAdmin = initializeFirebaseAdmin();
export { initializeFirebaseAdmin };