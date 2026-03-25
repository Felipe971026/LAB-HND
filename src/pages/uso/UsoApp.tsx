import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Activity, History, LogIn, LogOut, ShieldCheck, Trash2 } from 'lucide-react';
import { UsoForm } from '../../components/UsoForm';
import { TransfusionUseRecord } from '../../types';
import { auth, db, loginWithGoogle, logout, handleFirestoreError, OperationType } from '../../firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import { collection, onSnapshot, query, orderBy, addDoc, deleteDoc, doc, where, getDocs } from 'firebase/firestore';

export const UsoApp: React.FC = () => {
  const navigate = useNavigate();
  const [records, setRecords] = useState<TransfusionUseRecord[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  
  const [isSystemUnlocked, setIsSystemUnlocked] = useState(false);
  const [isGoogleConnected, setIsGoogleConnected] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setIsAuthReady(true);
      if (!currentUser) setIsSystemUnlocked(false);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const checkGoogleStatus = async () => {
      try {
        const response = await fetch('/api/auth/google/status');
        const data = await response.json();
        setIsGoogleConnected(data.connected);
      } catch (error) {
        console.error('Error checking Google status:', error);
      }
    };
    if (user && isSystemUnlocked) checkGoogleStatus();
  }, [user, isSystemUnlocked]);

  useEffect(() => {
    if (!isAuthReady || !user || !isSystemUnlocked) return;

    const path = 'transfusionUse';

    // Auto-cleanup: Delete records older than 30 days
    const cleanupOldRecords = async () => {
      try {
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        const cutoffTimestamp = thirtyDaysAgo.toISOString();

        const cleanupQuery = query(
          collection(db, path),
          where('createdAt', '<', cutoffTimestamp)
        );
        
        const snapshot = await getDocs(cleanupQuery);
        
        if (!snapshot.empty) {
          console.log(`Auto-limpieza: Borrando ${snapshot.size} registros antiguos...`);
          const deletePromises = snapshot.docs.map(docSnapshot => 
            deleteDoc(doc(db, path, docSnapshot.id))
          );
          await Promise.all(deletePromises);
          console.log('Auto-limpieza completada.');
        }
      } catch (error) {
        console.error('Error en auto-limpieza de registros antiguos:', error);
      }
    };

    cleanupOldRecords();

    const q = query(collection(db, path), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const recordsData: TransfusionUseRecord[] = [];
      snapshot.forEach((doc) => {
        recordsData.push({ id: doc.id, ...doc.data() } as TransfusionUseRecord);
      });
      setRecords(recordsData);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, path);
    });

    return () => unsubscribe();
  }, [isAuthReady, user, isSystemUnlocked]);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    const normalizedUsername = username.trim().toLowerCase();
    if (
      (normalizedUsername === 'usohemo' && password === 'Usohemo2026*') ||
      (normalizedUsername === 'admin' && password === 'admin')
    ) {
      setIsSystemUnlocked(true);
    } else {
      setLoginError('Usuario o contraseña incorrectos.');
    }
  };

  const handleConnectGoogle = async () => {
    try {
      const response = await fetch('/api/auth/google/url');
      const { url } = await response.json();
      window.open(url, 'google_auth_popup', 'width=600,height=700');
    } catch (error) {
      console.error('Error getting Google auth URL:', error);
    }
  };

  const handleDisconnectGoogle = async () => {
    try {
      await fetch('/api/auth/google/logout', { method: 'POST' });
      setIsGoogleConnected(false);
    } catch (error) {
      console.error('Error logging out of Google:', error);
    }
  };

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'GOOGLE_AUTH_SUCCESS') {
        setIsGoogleConnected(true);
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  const handleSubmit = async (formData: Omit<TransfusionUseRecord, 'id' | 'createdAt' | 'uid' | 'userEmail'>) => {
    if (!user) return;
    setIsSyncing(true);
    try {
      const fullRecord = {
        ...formData,
        createdAt: new Date().toISOString(),
        uid: user.uid,
        userEmail: user.email || 'Desconocido'
      };

      await addDoc(collection(db, 'transfusionUse'), fullRecord);
      
      if (isGoogleConnected) {
        await fetch('/api/sync/sheets/uso', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(fullRecord),
        });
      }
      
      setShowForm(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'transfusionUse');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('¿Está seguro de eliminar este registro de uso?')) {
      try {
        await deleteDoc(doc(db, 'transfusionUse', id));
      } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, `transfusionUse/${id}`);
      }
    }
  };

  if (!isAuthReady) return <div className="min-h-screen bg-zinc-50 flex items-center justify-center"><div className="w-12 h-12 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div className="min-h-screen bg-zinc-50 font-sans text-zinc-900">
      <nav className="bg-white border-b border-zinc-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button onClick={() => navigate('/')} className="p-2 -ml-2 text-zinc-400 hover:text-zinc-900 transition-colors rounded-xl hover:bg-zinc-100"><ArrowLeft size={24} /></button>
            <div className="flex items-center gap-3">
              <div className="bg-emerald-600 p-2.5 rounded-xl shadow-sm"><Activity className="text-white" size={24} /></div>
              <div>
                <h1 className="text-xl font-bold text-zinc-900 leading-tight">HemoMatch</h1>
                <p className="text-xs font-medium text-zinc-500">Módulo de Uso</p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-4">
            {user && isSystemUnlocked && (
              <>
                <div className="hidden lg:flex items-center gap-2 px-3 py-1.5 bg-zinc-100 rounded-full text-sm text-zinc-600">
                  <div className={`w-2 h-2 rounded-full ${isGoogleConnected ? 'bg-green-500' : 'bg-red-500'}`} />
                  <span className="font-medium">{isGoogleConnected ? 'Conexión Institucional (Drive)' : 'Drive Desconectado'}</span>
                  <button 
                    onClick={isGoogleConnected ? handleDisconnectGoogle : handleConnectGoogle}
                    className="ml-2 text-xs text-blue-600 hover:underline"
                  >
                    {isGoogleConnected ? 'Conectar' : 'Desconectar'}
                  </button>
                </div>
                <button onClick={() => setShowForm(!showForm)} className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-xl font-medium hover:bg-emerald-700 transition-all shadow-md shadow-emerald-100">
                {showForm ? <History size={18} /> : <Activity size={18} />}
                {showForm ? 'Ver Historial' : 'Nuevo Registro'}
              </button>
              </>
            )}
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-6 py-8">
        {!user ? (
          <div className="max-w-md mx-auto mt-20 text-center space-y-6">
            <div className="bg-emerald-50 w-20 h-20 rounded-3xl flex items-center justify-center mx-auto"><ShieldCheck className="text-emerald-600" size={40} /></div>
            <h2 className="text-3xl font-bold text-zinc-900">Paso 1: Autenticación</h2>
            <button onClick={loginWithGoogle} className="w-full bg-emerald-600 text-white py-4 rounded-2xl font-bold text-lg shadow-xl shadow-emerald-100 hover:bg-emerald-700 transition-all flex items-center justify-center gap-3"><LogIn size={24} />Continuar con Google</button>
          </div>
        ) : !isSystemUnlocked ? (
          <div className="max-w-md mx-auto mt-20 text-center space-y-6">
            <div className="bg-emerald-50 w-20 h-20 rounded-3xl flex items-center justify-center mx-auto"><ShieldCheck className="text-emerald-600" size={40} /></div>
            <h2 className="text-3xl font-bold text-zinc-900">Paso 2: Acceso al Sistema</h2>
            <form onSubmit={handleLogin} className="bg-white p-8 rounded-3xl shadow-xl border border-zinc-100 space-y-6 text-left">
              {loginError && <div className="bg-red-50 text-red-600 p-4 rounded-xl text-sm font-medium border border-red-100">{loginError}</div>}
              <div>
                <label className="block text-sm font-bold text-zinc-700 mb-2">Usuario</label>
                <input type="text" value={username} onChange={(e) => setUsername(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-zinc-200 focus:ring-2 focus:ring-emerald-500 outline-none" placeholder="usohemo" required />
              </div>
              <div>
                <label className="block text-sm font-bold text-zinc-700 mb-2">Contraseña</label>
                <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-zinc-200 focus:ring-2 focus:ring-emerald-500 outline-none" placeholder="••••••••" required />
              </div>
              <button type="submit" className="w-full bg-zinc-900 text-white py-4 rounded-2xl font-bold text-lg shadow-xl hover:bg-zinc-800 transition-all">Desbloquear Sistema</button>
            </form>
          </div>
        ) : (
          <>
            {showForm ? (
              <div className="max-w-4xl mx-auto"><UsoForm onSubmit={handleSubmit} isSubmitting={isSyncing} /></div>
            ) : (
              <div className="space-y-6">
                <h2 className="text-2xl font-bold text-zinc-900">Historial de Uso</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {records.map((record) => (
                    <div key={record.id} className="bg-white p-6 rounded-3xl shadow-sm border border-zinc-100 space-y-4 relative group">
                      {user?.uid === record.uid && (
                        <button
                          onClick={() => record.id && handleDelete(record.id)}
                          className="absolute top-4 right-4 p-2 text-zinc-400 hover:text-red-600 hover:bg-red-50 rounded-xl opacity-0 group-hover:opacity-100 transition-all"
                          title="Eliminar registro"
                        >
                          <Trash2 size={18} />
                        </button>
                      )}
                      <div className="flex justify-between items-start pr-10">
                        <div className="bg-emerald-50 text-emerald-600 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider">Unidad: {record.unitId}</div>
                        <span className="text-xs text-zinc-400">{new Date(record.createdAt).toLocaleString()}</span>
                      </div>
                      <div className="bg-zinc-50 px-3 py-1 rounded-full text-xs font-medium text-zinc-600 inline-block">
                        Sello: {record.qualitySeal}
                      </div>
                      <div>
                        <h3 className="font-bold text-zinc-900">{record.patientName}</h3>
                        <p className="text-xs text-zinc-500">ID: {record.patientId}</p>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div className="bg-zinc-50 p-2 rounded-lg"><p className="text-zinc-400 font-medium">Fecha</p><p className="font-bold">{record.transfusionDate}</p></div>
                        <div className="bg-zinc-50 p-2 rounded-lg"><p className="text-zinc-400 font-medium">Hora</p><p className="font-bold">{record.transfusionTime || '--:--'}</p></div>
                      </div>
                      {record.adverseReaction === 'Sí' && (
                        <div className="bg-red-50 p-3 rounded-xl border border-red-100"><p className="text-xs font-bold text-red-600">REACCIÓN ADVERSA</p><p className="text-xs text-red-500 mt-1">{record.reactionDescription}</p></div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
};
