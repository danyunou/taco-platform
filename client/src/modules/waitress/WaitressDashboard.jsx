import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useNavigate } from 'react-router-dom';

export default function WaitressDashboard() {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const [tables, setTables] = useState([]);
    const [loading, setLoading] = useState(true);

    // Colores según el estado de la mesa (Tailwind)
    const getStatusColor = (status) => {
        switch (status) {
            case 'free': return 'bg-green-100 border-green-500 text-green-700';
            case 'occupied': return 'bg-red-100 border-red-500 text-red-700';
            case 'awaiting_payment': return 'bg-yellow-100 border-yellow-500 text-yellow-700';
            default: return 'bg-gray-100 border-gray-300 text-gray-500';
        }
    };

    const getStatusLabel = (status) => {
        switch (status) {
            case 'free': return 'Libre';
            case 'occupied': return 'Ocupada';
            case 'awaiting_payment': return 'Pagando';
            default: return 'Desc.';
        }
    };

    useEffect(() => {
        fetchTables();
        // Truco: Recargar las mesas cada 5 segundos para ver cambios en tiempo real
        const interval = setInterval(fetchTables, 5000);
        return () => clearInterval(interval);
    }, []);

    const fetchTables = async () => {
        try {
            const res = await fetch(`${import.meta.env.VITE_API_URL}/api/tables`);
            const data = await res.json();
            setTables(data);
            setLoading(false);
        } catch (error) {
            console.error("Error cargando mesas:", error);
        }
    };

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Header Simple */}
            <header className="flex items-center justify-between bg-white px-6 py-4 shadow-sm">
                <div>
                    <h1 className="text-xl font-bold text-gray-800">🌮 Zona de Mesas</h1>
                    <p className="text-sm text-gray-500">Atendiendo: {user?.name}</p>
                </div>
                <button onClick={logout} className="text-sm font-semibold text-red-500 hover:text-red-700">
                    Salir
                </button>
            </header>

            {/* Grid de Mesas */}
            <main className="p-6">
                {loading ? (
                    <p className="text-center text-gray-500">Cargando mapa del restaurante...</p>
                ) : (
                    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
                        {tables.map((table) => (
                            <button
                                key={table.id}
                                onClick={() => navigate(`/mesas/${table.table_number}`)}
                                className={`flex h-32 flex-col items-center justify-center rounded-xl border-2 shadow-sm transition-transform hover:scale-105 ${getStatusColor(table.status)}`}
                            >
                                <span className="text-3xl font-black">#{table.table_number}</span>
                                <span className="mt-2 text-xs font-bold uppercase tracking-wider">
                                    {getStatusLabel(table.status)}
                                </span>
                            </button>
                        ))}
                    </div>
                )}
            </main>
        </div>
    );
}