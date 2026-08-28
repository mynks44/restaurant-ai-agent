import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState
} from "react";
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile
} from "firebase/auth";
import {
  auth,
  googleProvider
} from "../firebase";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] =
    useState(true);

  useEffect(() => {
    return onAuthStateChanged(auth, currentUser => {
      setUser(currentUser);
      setAuthLoading(false);
    });
  }, []);

  async function register(
    email,
    password,
    fullName
  ) {
    const credential =
      await createUserWithEmailAndPassword(
        auth,
        email,
        password
      );

    if (fullName) {
      await updateProfile(credential.user, {
        displayName: fullName
      });
    }

    return credential.user;
  }

  async function login(email, password) {
    const credential =
      await signInWithEmailAndPassword(
        auth,
        email,
        password
      );

    return credential.user;
  }

  async function loginWithGoogle() {
    const credential = await signInWithPopup(
      auth,
      googleProvider
    );

    return credential.user;
  }

  async function logout() {
    await signOut(auth);
  }

  async function getToken() {
    if (!auth.currentUser) {
      return null;
    }

    return auth.currentUser.getIdToken();
  }

  const value = useMemo(
    () => ({
      user,
      authLoading,
      register,
      login,
      loginWithGoogle,
      logout,
      getToken
    }),
    [user, authLoading]
  );

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}