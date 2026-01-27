import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useNavigate } from 'react-router-dom';

export default function AdminDashboard() {
    const { user, logout } = useAuth();
    const navigate = useNavigate();

    const [shift, setShift] = useState(null); // Guardará el turno actual si existe
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    const API_URL = import.meta.env.VITE_API_URL;

    // 1. Al cargar, preguntar al backend si hay turno abierto
    useEffect(() => {
        checkCurrentShift();
    }, []);

    const checkCurrentShift = async () => {
        try {
            const res = await fetch(`${API_URL}/api/shifts/current`);
            const data = await res.json();

            // El backend devuelve { shift: {...} } o { shift: null }
            setShift(data.shift);
        } catch (err) {
            console.error("Error cargando turno", err);
            setError('No se pudo conectar con el servidor.');
        } finally {
            setLoading(false);
        }
    };

    // 2. Función para ABRIR TURNO
    const handleOpenShift = async () => {
        try {
            const res = await fetch(`${API_URL}/api/shifts/open`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    opened_by: user.id // Enviamos el ID real de Omar (1)
                })
            });

            if (!res.ok) {
                const errData = await res.json();
                throw new Error(errData.error || 'Error al abrir turno');
            }

            alert('¡Turno Abierto! Ya pueden vender.');
            checkCurrentShift(); // Recargar estado
        } catch (err) {
            alert(err.message);
        }
    };

    // 3. Función para CERRAR TURNO (Corte de caja)
    const handleCloseShift = async () => {
        if (!confirm('¿Estás seguro de hacer el CORTE DE CAJA? Esto cerrará el turno.')) return;

        try {
            const res = await fetch(`${API_URL}/api/shifts/close`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    closed_by: user.id
                })
            });

            if (!res.ok) throw new Error('Error al cerrar turno');

            const data = await res.json();
            alert(`Turno cerrado. Total vendido: $${data.shift.total_sales}`);
            checkCurrentShift();
        } catch (err) {
            alert(err.message);
        }
    };

    if (loading) return <div className="p-10 text-center">Cargando sistema...</div>;

    return (
        <div className="min-h-screen bg-gray-100 p-6">
            {/* Header */}
            <header className="mb-8 flex items-center justify-between rounded-lg bg-white p-6 shadow-md">
                <div>
                    <h1 className="text-2xl font-bold text-gray-800">Panel de Administración</h1>
                    <p className="text-gray-500">Hola, {user?.name}</p>
                </div>
                <button
                    onClick={logout}
                    className="rounded-md bg-red-100 px-4 py-2 text-red-600 hover:bg-red-200"
                >
                    Cerrar Sesión
                </button>
            </header>

            {/* Estado del Turno */}
            <div className="grid gap-6 md:grid-cols-2">
                <div className="rounded-lg bg-white p-8 shadow-md text-center">
                    <h2 className="mb-4 text-xl font-semibold text-gray-700">Estado del Negocio</h2>

                    {shift ? (
                        // SI HAY TURNO ABIERTO
                        <div className="space-y-4">
                            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-green-100 text-3xl">
                                🟢
                            </div>
                            <p className="text-lg font-medium text-green-700">ABIERTO</p>
                            <p className="text-sm text-gray-500">Desde: {new Date(shift.opened_at).toLocaleTimeString()}</p>

                            <button
                                onClick={handleCloseShift}
                                className="mt-4 w-full rounded-lg bg-red-600 px-6 py-3 font-bold text-white shadow hover:bg-red-700"
                            >
                                HACER CORTE DE CAJA (CERRAR)
                            </button>
                        </div>
                    ) : (
                        // SI ESTÁ CERRADO
                        <div className="space-y-4">
                            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-gray-200 text-3xl">
                                🔴
                            </div>
                            <p className="text-lg font-medium text-gray-700">CERRADO</p>
                            <p className="text-sm text-gray-500">No hay ventas activas</p>

                            <button
                                onClick={handleOpenShift}
                                className="mt-4 w-full rounded-lg bg-green-600 px-6 py-3 font-bold text-white shadow hover:bg-green-700"
                            >
                                ABRIR TURNO
                            </button>
                        </div>
                    )}
                </div>

                {/* Botones rápidos de prueba */}
                <div className="rounded-lg bg-white p-8 shadow-md">
                    <h3 className="font-bold text-gray-700 mb-4">Accesos Rápidos</h3>
                    <div className="grid gap-4">
                        <button onClick={() => navigate('/mesas')} className="p-4 border rounded hover:bg-gray-50 text-left">
                            📍 Ir al Mapa de Mesas
                        </button>
                        <button onClick={() => navigate('/cocina')} className="p-4 border rounded hover:bg-gray-50 text-left">
                            👨‍🍳 Ir a Pantalla Cocina
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}