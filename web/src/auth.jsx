import { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { api, setToken, getToken } from './api.js';
import { connectSocket, disconnectSocket, getSocket } from './socket.js';

const AuthCtx = createContext(null);
export const useAuth = () => useContext(AuthCtx);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [groups, setGroups] = useState([]);
  const [activeGroupId, setActiveGroupId] = useState(localStorage.getItem('cm_group') || null);
  const [loading, setLoading] = useState(true);
  const bootstrapped = useRef(false);

  const applySession = useCallback((data) => {
    if (data.token) setToken(data.token);
    setUser(data.user);
    setGroups(data.groups || []);
    setActiveGroupId((cur) => {
      const ids = (data.groups || []).map((g) => g.id);
      if (cur && ids.includes(cur)) return cur;
      const next = ids[0] || null;
      if (next) localStorage.setItem('cm_group', next);
      return next;
    });
  }, []);

  const refresh = useCallback(async () => {
    if (!getToken()) {
      setUser(null);
      setGroups([]);
      setLoading(false);
      return;
    }
    try {
      const data = await api('/auth/me');
      applySession(data);
    } catch {
      setToken(null);
      setUser(null);
      setGroups([]);
    } finally {
      setLoading(false);
    }
  }, [applySession]);

  useEffect(() => {
    if (bootstrapped.current) return;
    bootstrapped.current = true;
    refresh();
  }, [refresh]);

  // socket + présence temps réel
  useEffect(() => {
    if (!user) {
      disconnectSocket();
      return;
    }
    const s = connectSocket();
    const onPresence = ({ userId, state, activity }) => {
      setGroups((gs) =>
        gs.map((g) => ({
          ...g,
          members: g.members?.map((m) =>
            m.id === userId ? { ...m, presence: state, activity: activity ?? m.activity } : m,
          ),
        })),
      );
    };
    const onGroupUpdated = () => refresh();
    s.on('presence', onPresence);
    s.on('group:updated', onGroupUpdated);
    return () => {
      s.off('presence', onPresence);
      s.off('group:updated', onGroupUpdated);
    };
  }, [user, refresh]);

  const login = useCallback(
    async (email, password) => {
      const data = await api('/auth/login', { method: 'POST', body: { email, password } });
      applySession(data);
      setLoading(false);
    },
    [applySession],
  );

  const register = useCallback(
    async (email, password, name) => {
      const data = await api('/auth/register', { method: 'POST', body: { email, password, name } });
      applySession(data);
      setLoading(false);
    },
    [applySession],
  );

  const logout = useCallback(() => {
    disconnectSocket();
    setToken(null);
    localStorage.removeItem('cm_group');
    setUser(null);
    setGroups([]);
    setActiveGroupId(null);
  }, []);

  const selectGroup = useCallback((id) => {
    localStorage.setItem('cm_group', id);
    setActiveGroupId(id);
  }, []);

  const updateUser = useCallback((patch) => setUser((u) => ({ ...u, ...patch })), []);

  const group = groups.find((g) => g.id === activeGroupId) || groups[0] || null;

  return (
    <AuthCtx.Provider
      value={{
        user,
        groups,
        group,
        members: group?.members || [],
        loading,
        login,
        register,
        logout,
        refresh,
        selectGroup,
        updateUser,
        socket: getSocket(),
      }}
    >
      {children}
    </AuthCtx.Provider>
  );
}
