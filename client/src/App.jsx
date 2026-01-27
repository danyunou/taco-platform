import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import LoginPage from './modules/auth/LoginPage';
import AdminDashboard from './modules/admin/AdminDashboard';
import WaitressDashboard from './modules/waitress/WaitressDashboard';
import TableOrderPage from './modules/waitress/TableOrderPage';

// --- COMPONENTE GUARDIÁN (El Portero) ---
// Si no hay usuario, te patea al Login ("/")
// Si hay usuario, te deja pasar al componente hijo
function RequireAuth({ children }) {
  const { user } = useAuth();
  const location = useLocation();

  if (!user) {
    // Redirigir al login, pero guardando de dónde venían por si acaso
    return <Navigate to="/" state={{ from: location }} replace />;
  }

  return children;
}

// Mocks temporales
const MesasMock = () => <div className="p-10 text-2xl">📍 Mapa de Mesas</div>;
const CocinaMock = () => <div className="p-10 text-2xl">👨‍🍳 Pantalla Cocina</div>;

function App() {
  return (
    <AuthProvider>
      <Routes>
        {/* RUTA PÚBLICA: El Login es lo único que se ve sin permiso */}
        <Route path="/" element={<LoginPage />} />

        {/* RUTAS PROTEGIDAS: Solo accesibles si estás logueado */}
        <Route
          path="/admin"
          element={
            <RequireAuth>
              <AdminDashboard />
            </RequireAuth>
          }
        />

        <Route
          path="/mesas"
          element={
            <RequireAuth>
              <WaitressDashboard /> {/* <--- AQUÍ ESTÁ EL CAMBIO */}
            </RequireAuth>
          }
        />

        <Route
          path="/mesas/:id"
          element={
            <RequireAuth>
              <TableOrderPage />
            </RequireAuth>
          }
        />

        <Route
          path="/cocina"
          element={
            <RequireAuth>
              <CocinaMock />
            </RequireAuth>
          }
        />
      </Routes>
    </AuthProvider>
  );
}

export default App;