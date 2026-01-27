import { createContext, useState, useContext, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

const AuthContext = createContext();

// --- TUS USUARIOS REALES (Espejo de la BD) ---
const DB_USERS = [
  { id: 1, name: 'Omar Ibarra', username: 'admin', pin: '1234', role: 'admin' },
  { id: 2, name: 'Regina Ibarra', username: 'regi', pin: '0000', role: 'mesera' }, 
  { id: 3, name: 'Osman Rizo', username: 'osman', pin: '1111', role: 'taquero' },
];

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const navigate = useNavigate();

  const login = (pinInput) => {
    // Buscamos si el PIN ingresado coincide con alguien del equipo
    const foundUser = DB_USERS.find(u => u.pin === pinInput);
    
    if (foundUser) {
      setUser(foundUser);
      localStorage.setItem('taco_user', JSON.stringify(foundUser));
      
      // REDIRECCIÓN INTELIGENTE
      if (foundUser.role === 'admin') navigate('/admin');
      else if (foundUser.role === 'taquero') navigate('/cocina');
      else navigate('/mesas'); // Mesera va a mesas
      
      return { success: true };
    } else {
      return { success: false, error: 'PIN incorrecto' };
    }
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('taco_user');
    navigate('/');
  };

  // Mantener sesión al recargar página
  useEffect(() => {
    const stored = localStorage.getItem('taco_user');
    if (stored) setUser(JSON.parse(stored));
  }, []);

  return (
    <AuthContext.Provider value={{ user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);