import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  updateProfile,
  User as FirebaseUser
} from 'firebase/auth';
import { auth, googleProvider } from '@/lib/firebase';
import { firebaseAuthApi, setFirebaseToken, setAuthToken, getFirebaseToken, User as ApiUser } from '@/lib/api';
import { queryClient } from '@/lib/queryClient';
import { toast } from 'sonner';

/**
 * Remove every auth-related key from localStorage + sessionStorage and wipe
 * the React Query cache. Call this on sign-out AND before loading a new user
 * so that no previous user's data ever bleeds into the next session.
 */
function clearAllAuthData() {
  // All token / session keys used across the app
  const LS_KEYS = [
    'token', 'refreshToken', 'user',
    'auth_token', 'admin_token',
    'firebase_id_token',
  ];
  LS_KEYS.forEach(k => localStorage.removeItem(k));

  // Per-user UI state stored in sessionStorage
  sessionStorage.removeItem('dismissedRejectionAlerts');

  // Wipe in-memory token refs held by api.ts
  setFirebaseToken(null);
  setAuthToken(null);

  // Wipe every React Query cache entry so next user starts fresh
  queryClient.clear();
}

// Get API base URL — matches the same logic as api.ts
const getApiBaseUrl = () => {
  const apiUrl = import.meta.env?.VITE_API_URL;
  if (apiUrl && typeof apiUrl === 'string') {
    // Strip trailing /api if present so we can append /api/auth/... ourselves
    return apiUrl.replace(/\/api$/, '');
  }
  // In development, use localhost
  if (import.meta.env.DEV) {
    return 'http://localhost:4000';
  }
  return 'https://zaymazone-backend.onrender.com';
};

const API_BASE_URL = getApiBaseUrl();

interface User {
  id: string;
  email: string;
  name: string;
  avatar?: string;
  role: 'user' | 'artisan' | 'admin';
  phone?: string;
  address?: {
    street: string;
    city: string;
    state: string;
    zipCode: string;
    country: string;
  };
  preferences?: {
    newsletter: boolean;
    notifications: boolean;
    language: string;
  };
  isEmailVerified?: boolean;
  authProvider?: 'firebase' | 'local';
  firebaseUid?: string;
  lastLogin?: string;
  createdAt?: string;
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  signIn: (email: string, password: string, role?: 'user' | 'artisan' | 'admin') => Promise<void>;
  signOut: () => Promise<void>;
  signUp: (email: string, password: string, name: string, role?: 'user' | 'artisan' | 'admin') => Promise<void>;
  signInWithGoogle: (role?: 'user' | 'artisan' | 'admin') => Promise<void>;
  updateUser: (userData: Partial<User>) => Promise<void>;
  updateUserProfile: (profileData: {
    name?: string;
    phone?: string;
    address?: Partial<User['address']>;
    preferences?: Partial<User['preferences']>;
    avatar?: string;
  }) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider = ({ children }: AuthProviderProps) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Helper function to sync Firebase user with MongoDB
  const syncUserWithMongoDB = async (firebaseUser: FirebaseUser, role: 'user' | 'artisan' | 'admin' = 'user') => {
    try {
      const idToken = await firebaseUser.getIdToken();
      setFirebaseToken(idToken);

      const response = await firebaseAuthApi.syncUser({ idToken, role });
      const dbUser = response.user;

      // Store the backend JWT so authenticated API routes work
      if (response.accessToken) {
        setAuthToken(response.accessToken);
      }

      const userProfile: User = {
        id: dbUser.id,
        email: dbUser.email,
        name: dbUser.name,
        avatar: dbUser.avatar,
        role: dbUser.role as 'user' | 'artisan' | 'admin',
        phone: dbUser.phone,
        address: dbUser.address,
        preferences: dbUser.preferences,
        isEmailVerified: dbUser.isEmailVerified,
        authProvider: dbUser.authProvider,
        firebaseUid: dbUser.firebaseUid,
        lastLogin: dbUser.lastLogin,
        createdAt: dbUser.createdAt
      };

      setUser(userProfile);
      return userProfile;
    } catch (error) {
      console.error('Failed to sync user with MongoDB:', error);
      // Fallback to basic Firebase user data
      const basicUser: User = {
        id: firebaseUser.uid,
        email: firebaseUser.email!,
        name: firebaseUser.displayName || firebaseUser.email!.split('@')[0],
        avatar: firebaseUser.photoURL || undefined,
        role: role,
        isEmailVerified: firebaseUser.emailVerified,
        authProvider: 'firebase',
        firebaseUid: firebaseUser.uid
      };
      setUser(basicUser);
      return basicUser;
    }
  };

  // Listen to authentication state changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setIsLoading(true);

      // Helper: decode a JWT payload safely (handles URL-safe base64 + missing padding)
      const decodeJwtPayload = (token: string) => {
        const base64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
        const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
        return JSON.parse(atob(padded));
      };

      // Check if there's a valid artisan JWT session in localStorage
      const storedToken = localStorage.getItem('token');
      const storedUserRaw = localStorage.getItem('user');
      const hasValidArtisanSession = (() => {
        if (!storedToken || !storedUserRaw) return false;
        try {
          const payload = decodeJwtPayload(storedToken);
          const storedUser = JSON.parse(storedUserRaw);
          return (
            payload.exp &&
            payload.exp * 1000 > Date.now() &&
            storedUser?.role === 'artisan'
          );
        } catch {
          return false;
        }
      })();

      // If a valid artisan session exists, always prefer it — don't let Firebase override it
      if (hasValidArtisanSession) {
        setUser(JSON.parse(storedUserRaw!));
        setIsLoading(false);
        return;
      }

      if (firebaseUser) {
        // Always flush stale cache before loading a new user's data so
        // a previous account's orders / wishlist can never bleed through.
        queryClient.clear();
        await syncUserWithMongoDB(firebaseUser);
      } else {
        // No Firebase session and no artisan session — clear everything
        setUser(null);
        clearAllAuthData();
      }

      setIsLoading(false);
    });

    return () => unsubscribe();
  }, []);

  /**
   * Convert a raw Firebase auth error into a short, user-friendly message.
   * Falls back to the original message for non-Firebase / unknown errors.
   */
  function resolveFirebaseAuthError(error: unknown): string {
    const CODE_MESSAGES: Record<string, string> = {
      'auth/email-already-in-use':   'An account with this email already exists. Please sign in instead.',
      'auth/user-not-found':          'No account found with that email address.',
      'auth/wrong-password':          'Incorrect password. Please try again.',
      'auth/invalid-credential':      'Invalid email or password.',
      'auth/invalid-email':           'Please enter a valid email address.',
      'auth/weak-password':           'Password must be at least 6 characters.',
      'auth/too-many-requests':       'Too many attempts. Please wait a moment and try again.',
      'auth/network-request-failed':  'Network error. Please check your connection.',
      'auth/popup-closed-by-user':    'Sign-in popup was closed. Please try again.',
      'auth/unauthorized-domain':     'Sign-in is not available in this environment.',
      'auth/user-disabled':           'This account has been disabled. Please contact support.',
      'auth/operation-not-allowed':   'This sign-in method is not enabled.',
      'auth/account-exists-with-different-credential': 'An account already exists with the same email but a different sign-in method.',
    };
    if (error && typeof error === 'object' && 'code' in error) {
      const code = (error as { code: string }).code;
      if (CODE_MESSAGES[code]) return CODE_MESSAGES[code];
    }
    if (error instanceof Error) return error.message || 'Something went wrong.';
    return 'Something went wrong.';
  }

  const signIn = async (email: string, password: string, role: 'user' | 'artisan' | 'admin' = 'user'): Promise<void> => {
    try {
      setIsLoading(true);

      if (role === 'artisan') {
        // Use custom artisan signin endpoint that checks approval status
        const response = await fetch(`${API_BASE_URL}/api/auth/artisan/signin`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ email, password }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Sign in failed');
        }

        const data = await response.json();

        // Sign out from Firebase silently so onAuthStateChanged fires null
        // and won't override the artisan session with a stale Firebase user
        try { await firebaseSignOut(auth); } catch { /* ignore */ }

        // Flush any previous session before loading the new artisan's data
        clearAllAuthData();

        // Store artisan tokens
        localStorage.setItem('token', data.accessToken);
        localStorage.setItem('refreshToken', data.refreshToken);
        localStorage.setItem('user', JSON.stringify(data.user));

        setUser(data.user);

        toast.success('Successfully signed in as artisan!');
      } else {
        // Flush stale cache before loading the new user (handles account switch
        // without an explicit sign-out in between).
        queryClient.clear();

        // Use Firebase for regular users
        const credential = await signInWithEmailAndPassword(auth, email, password);

        // Sync with MongoDB and check role
        const dbUser = await syncUserWithMongoDB(credential.user, role);

        if (dbUser.role !== role) {
          await firebaseSignOut(auth);
          throw new Error(`This account is registered as ${dbUser.role}, not ${role}`);
        }

        toast.success('Successfully signed in!');
      }
    } catch (error: unknown) {
      const msg = resolveFirebaseAuthError(error);
      toast.error(msg);
      throw new Error(msg);
    } finally {
      setIsLoading(false);
    }
  };

  const signUp = async (email: string, password: string, name: string, role: 'user' | 'artisan' | 'admin' = 'user'): Promise<void> => {
    try {
      setIsLoading(true);

      // Ensure no previous user's cached data is visible to the new account.
      clearAllAuthData();

      const credential = await createUserWithEmailAndPassword(auth, email, password);

      // Update Firebase user profile
      await updateProfile(credential.user, {
        displayName: name
      });

      // Sync with MongoDB
      await syncUserWithMongoDB(credential.user, role);

      toast.success('Account created successfully!');
    } catch (error: unknown) {
      const msg = resolveFirebaseAuthError(error);
      toast.error(msg);
      throw new Error(msg);
    } finally {
      setIsLoading(false);
    }
  };

  const signInWithGoogle = async (role: 'user' | 'artisan' | 'admin' = 'user'): Promise<void> => {
    try {
      setIsLoading(true);
      const credential = await signInWithPopup(auth, googleProvider);

      // Sync with MongoDB and check role
      const dbUser = await syncUserWithMongoDB(credential.user, role);

      // For existing users, check if role matches
      if (dbUser.role !== role) {
        await firebaseSignOut(auth);
        throw new Error(`This account is registered as ${dbUser.role}, not ${role}`);
      }

      toast.success('Successfully signed in with Google!');
    } catch (error: unknown) {
      const msg = resolveFirebaseAuthError(error);
      toast.error(msg);
      throw new Error(msg);
    } finally {
      setIsLoading(false);
    }
  };

  const signOut = async (): Promise<void> => {
    try {
      await firebaseSignOut(auth);
      setUser(null);
      // Wipe every auth key, sessionStorage and the RQ cache in one shot
      clearAllAuthData();
      toast.success('Signed out successfully');
    } catch (error: unknown) {
      const err = error as Error;
      toast.error(err.message || 'Sign out failed');
    }
  };

  const updateUser = async (userData: Partial<User>): Promise<void> => {
    if (user) {
      setUser({ ...user, ...userData });
    }
  };

  const updateUserProfile = async (profileData: {
    name?: string;
    phone?: string;
    address?: Partial<User['address']>;
    preferences?: Partial<User['preferences']>;
    avatar?: string;
  }): Promise<void> => {
    try {
      if (!user) {
        throw new Error('No user logged in');
      }

      const firebaseToken = getFirebaseToken();
      if (!firebaseToken) {
        throw new Error('No authentication token found');
      }

      const response = await firebaseAuthApi.updateProfile(profileData, firebaseToken);
      const updatedUser = response.user;

      const userProfile: User = {
        ...user,
        name: updatedUser.name,
        phone: updatedUser.phone,
        address: updatedUser.address,
        avatar: updatedUser.avatar,
        preferences: updatedUser.preferences
      };

      setUser(userProfile);
      toast.success('Profile updated successfully');
    } catch (error: unknown) {
      const err = error as Error;
      toast.error(err.message || 'Failed to update profile');
      throw err;
    }
  };

  const value: AuthContextType = {
    user,
    isAuthenticated: !!user,
    isLoading,
    signIn,
    signOut,
    signUp,
    signInWithGoogle,
    updateUser,
    updateUserProfile,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};