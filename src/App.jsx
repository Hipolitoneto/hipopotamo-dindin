import { useCallback, useEffect, useState } from 'react';
import { api } from './api';
import { AuthScreen } from './AuthScreen';
import { UserApp } from './UserApp';
import { AdminApp } from './AdminApp';
import { Hippo } from './ui';

export default function App() {
  const [user, setUser] = useState(undefined);
  const handleLoggedOut = useCallback(() => setUser(null), []);

  useEffect(() => {
    let live = true;
    api.me()
      .then((next) => { if (live) setUser(next); })
      .catch(() => { if (live) setUser(null); });
    return () => { live = false; };
  }, []);

  if (user === undefined) {
    return (
      <div className="splash">
        <Hippo size={120} variant="mark" />
        <p>Abrindo o caderno...</p>
      </div>
    );
  }

  if (!user) return <AuthScreen onAuth={setUser} />;
  if (user.role === 'admin') return <AdminApp user={user} onLogout={handleLoggedOut} />;
  return <UserApp user={user} onLogout={handleLoggedOut} />;
}
