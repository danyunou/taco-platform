import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext'; // <--- 1. IMPORTAR ESTO

export default function TableOrderPage() {
    const { id } = useParams();
    const navigate = useNavigate();
    const { user } = useAuth(); // <--- 2. OBTENER USUARIO (Regina)

    const [menu, setMenu] = useState([]);
    const [categories, setCategories] = useState([]);
    const [selectedCategory, setSelectedCategory] = useState(null);
    const [currentOrder, setCurrentOrder] = useState([]);
    const [isSending, setIsSending] = useState(false); // Para bloquear el botón mientras carga

    const API_URL = import.meta.env.VITE_API_URL;

    useEffect(() => {
        fetchMenuData();
    }, []);

    const fetchMenuData = async () => {
        try {
            const resCat = await fetch(`${API_URL}/api/menu/categories`);
            const dataCat = await resCat.json();
            setCategories(dataCat);
            if (dataCat.length > 0) setSelectedCategory(dataCat[0].id);

            const resItems = await fetch(`${API_URL}/api/menu/items`);
            const dataItems = await resItems.json();
            setMenu(dataItems);
        } catch (error) {
            console.error("Error cargando menú", error);
        }
    };

    const filteredItems = menu.filter(item => item.category_id === selectedCategory);

    const addToOrder = (item) => {
        const newItem = {
            ...item,
            tempId: Date.now(),
            price: Number(item.base_price)
        };
        setCurrentOrder([...currentOrder, newItem]);
    };

    // --- 3. FUNCIÓN PARA ENVIAR A LA BASE DE DATOS ---
    const handleSendOrder = async () => {
        if (currentOrder.length === 0) return;
        setIsSending(true);

        try {
            // Preparamos el paquete de datos como lo espera el Backend
            const orderPayload = {
                table_number: Number(id),
                user_id: user.id, // ID de Regina
                items: currentOrder.map(item => ({
                    menu_item_id: item.id,
                    quantity: 1, // Por ahora 1 por 1, luego podemos agrupar
                    notes: ''    // Aquí irían "Sin cebolla", etc.
                }))
            };

            const res = await fetch(`${API_URL}/api/orders`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(orderPayload)
            });

            if (!res.ok) {
                const errorData = await res.json();
                throw new Error(errorData.error || 'Error al guardar la orden');
            }

            // Si todo sale bien:
            alert('✅ ¡Orden enviada a cocina!');
            navigate('/mesas'); // Volvemos al mapa

        } catch (error) {
            console.error(error);
            alert('❌ Error: ' + error.message);
        } finally {
            setIsSending(false);
        }
    };

    const total = currentOrder.reduce((sum, item) => sum + item.price, 0);

    return (
        <div className="flex h-screen flex-col bg-gray-100 md:flex-row">

            {/* IZQUIERDA: MENÚ */}
            <div className="flex flex-1 flex-col overflow-hidden border-r bg-white">
                <div className="flex items-center justify-between p-4 shadow-sm bg-orange-600 text-white">
                    <button onClick={() => navigate('/mesas')} className="font-bold hover:text-gray-200">
                        ← Cancelar
                    </button>
                    <h2 className="text-xl font-bold">Mesa #{id}</h2>
                </div>

                <div className="flex overflow-x-auto border-b bg-gray-50 p-2 scrollbar-hide">
                    {categories.map(cat => (
                        <button
                            key={cat.id}
                            onClick={() => setSelectedCategory(cat.id)}
                            className={`mr-2 whitespace-nowrap rounded-full px-5 py-2 text-sm font-bold transition-all ${selectedCategory === cat.id
                                    ? 'bg-orange-600 text-white shadow-md'
                                    : 'bg-white text-gray-600 border'
                                }`}
                        >
                            {cat.name}
                        </button>
                    ))}
                </div>

                <div className="flex-1 overflow-y-auto p-4 bg-gray-100">
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                        {filteredItems.map(item => (
                            <button
                                key={item.id}
                                onClick={() => addToOrder(item)}
                                className="flex flex-col items-center justify-center rounded-xl bg-white p-4 shadow-sm hover:border-orange-500 border-2 border-transparent"
                            >
                                <div className="mb-2 text-2xl">🌮</div>
                                <h3 className="font-bold text-gray-800 text-center text-sm">{item.name}</h3>
                                <p className="text-orange-600 font-extrabold mt-1">${item.base_price}</p>
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* DERECHA: TICKET */}
            <div className="flex w-full flex-col bg-white shadow-2xl md:w-96 border-l">
                <div className="bg-gray-800 p-4 text-white shadow-md">
                    <h2 className="text-lg font-bold flex justify-between">
                        <span>📝 Comanda</span>
                        <span className="font-normal text-gray-400">{currentOrder.length} ítems</span>
                    </h2>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-2 bg-gray-50">
                    {currentOrder.length === 0 ? (
                        <p className="text-center text-gray-400 mt-10">Ticket vacío</p>
                    ) : (
                        currentOrder.map((item, index) => (
                            <div key={item.tempId} className="flex justify-between items-center bg-white p-3 rounded shadow-sm">
                                <div>
                                    <p className="font-bold text-gray-800">{item.name}</p>
                                    <p className="text-xs text-gray-500">${item.price}</p>
                                </div>
                                <button
                                    onClick={() => {
                                        const newOrder = [...currentOrder];
                                        newOrder.splice(index, 1);
                                        setCurrentOrder(newOrder);
                                    }}
                                    className="text-red-500 font-bold p-2"
                                >✕</button>
                            </div>
                        ))
                    )}
                </div>

                <div className="bg-white p-6 border-t">
                    <div className="flex justify-between mb-6 text-2xl font-black text-gray-800">
                        <span>Total:</span>
                        <span>${total.toFixed(2)}</span>
                    </div>
                    {/* BOTÓN REAL CONECTADO */}
                    <button
                        className={`w-full rounded-xl py-4 font-bold text-white shadow-lg transition-all text-lg ${isSending ? 'bg-gray-400 cursor-wait' : 'bg-green-600 hover:bg-green-700 active:scale-95'
                            }`}
                        disabled={currentOrder.length === 0 || isSending}
                        onClick={handleSendOrder}
                    >
                        {isSending ? 'ENVIANDO...' : 'ENVIAR A COCINA'}
                    </button>
                </div>
            </div>
        </div>
    );
}