import { useState } from 'react';
import { useAuth } from '../../context/AuthContext';

export default function LoginPage() {
    const { login } = useAuth();
    const [pin, setPin] = useState('');
    const [error, setError] = useState('');

    const handleLogin = (e) => {
        e.preventDefault();

        // Intentamos loguear con el PIN que escribiste
        const result = login(pin);

        if (!result.success) {
            setError(result.error);
            setPin(''); // Limpiar PIN si falla
        }
    };

    return (
        <div className="flex min-h-screen items-center justify-center bg-gray-900 px-4">
            <div className="w-full max-w-sm rounded-lg bg-white p-8 shadow-2xl">
                <div className="mb-6 text-center">
                    <h1 className="text-3xl font-bold text-orange-600">🌮 TacoApp</h1>
                    <p className="text-gray-500">Inicia turno para continuar</p>
                </div>

                <form onSubmit={handleLogin} className="space-y-6">
                    <div>
                        <label className="mb-1 block text-sm font-medium text-gray-700">
                            Ingresa tu PIN
                        </label>
                        <input
                            type="password"
                            placeholder="****"
                            maxLength="4"
                            className="w-full rounded-xl border-2 border-gray-200 p-4 text-center text-4xl font-bold tracking-[0.5em] text-gray-800 focus:border-orange-500 focus:outline-none"
                            value={pin}
                            onChange={(e) => {
                                // Solo dejar escribir números
                                if (/^\d*$/.test(e.target.value)) setPin(e.target.value);
                            }}
                            autoFocus
                        />
                    </div>

                    {error && (
                        <div className="rounded bg-red-100 p-2 text-center text-sm text-red-600 font-bold">
                            {error}
                        </div>
                    )}

                    <button
                        type="submit"
                        className="w-full rounded-xl bg-orange-600 py-3 font-bold text-white shadow-lg transition hover:bg-orange-700 active:scale-95"
                    >
                        ENTRAR AL TURNO
                    </button>
                </form>

                <div className="mt-8 text-center text-xs text-gray-400">
                    <p>Omar: 1234 | Regina: 0000 | Osman: 1111</p>
                </div>
            </div>
        </div>
    );
}