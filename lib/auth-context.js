// lib/auth-context.js
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

let externalSetTokens = async () => {};

export async function setTokensExternally(payload) {
  await externalSetTokens(payload);
}

const AuthContext = createContext({
  user: null,
  accessToken: null,
  loading: true,
  setTokens: async () => {},
  logout: async () => {},
});

// ✅ 함수 선언 형태로 수정
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [accessToken, setAccessToken] = useState(null);
  const [loading, setLoading] = useState(true);

  // 부팅 시 토큰/유저 복구
  useEffect(() => {
    (async () => {
      try {
        const at = await AsyncStorage.getItem('accessToken');
        const u = await AsyncStorage.getItem('user');
        if (at) setAccessToken(at);
        if (u) {
          try { setUser(JSON.parse(u)); } catch {}
        }
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // 토큰/유저 저장
  const setTokens = useCallback(async ({
                                         accessToken: at,
                                         refreshToken: rt,
                                         user: u,
                                         accessTokenExpiresAt,
                                         refreshTokenExpiresAt,
                                       } = {}) => {
    if (at !== undefined) {
      if (at) {
        setAccessToken(at);
        await AsyncStorage.setItem('accessToken', at);
      } else {
        setAccessToken(null);
        await AsyncStorage.removeItem('accessToken');
      }
    }
    if (rt !== undefined) {
      if (rt) {
        await AsyncStorage.setItem('refreshToken', rt);
      } else {
        await AsyncStorage.removeItem('refreshToken');
      }
    }
    if (accessTokenExpiresAt !== undefined) {
      if (typeof accessTokenExpiresAt === 'number') {
        await AsyncStorage.setItem('accessTokenExpiresAt', String(accessTokenExpiresAt));
      } else {
        await AsyncStorage.removeItem('accessTokenExpiresAt');
      }
    }
    if (refreshTokenExpiresAt !== undefined) {
      if (typeof refreshTokenExpiresAt === 'number') {
        await AsyncStorage.setItem('refreshTokenExpiresAt', String(refreshTokenExpiresAt));
      } else {
        await AsyncStorage.removeItem('refreshTokenExpiresAt');
      }
    }
    if (u !== undefined) {
      if (u) {
        setUser(u);
        await AsyncStorage.setItem('user', JSON.stringify(u));
      } else {
        setUser(null);
        await AsyncStorage.removeItem('user');
      }
    }
  }, []);

  useEffect(() => {
    externalSetTokens = setTokens;
    return () => {
      externalSetTokens = async () => {};
    };
  }, [setTokens]);

  // 로그아웃
  const logout = useCallback(async () => {
    setUser(null);
    setAccessToken(null);
    await AsyncStorage.multiRemove([
      'accessToken',
      'refreshToken',
      'accessTokenExpiresAt',
      'refreshTokenExpiresAt',
      'user',
    ]);
  }, []);

  const value = useMemo(() => ({
    user,
    accessToken,
    loading,
    setTokens,
    logout,
  }), [user, accessToken, loading, setTokens, logout]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// 훅
export function useAuth() {
  return useContext(AuthContext);
}