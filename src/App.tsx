import { useState } from 'react';
import { Layout } from './components/Layout';
import { EscalaView } from './components/EscalaView';
import { ColaboradorasManager } from './components/ColaboradorasManager';
import { Configuracoes } from './components/Configuracoes';
import { RodizioAdmin } from './components/RodizioAdmin';
import { AreaAuxiliarMobile } from './components/mobile/AreaAuxiliarMobile';
import { AuxiliaresAdmin } from './components/AuxiliaresAdmin';
import { ConfigCheck } from './components/ConfigCheck';
import { LoginPage } from './components/LoginPage';
import { useAuth } from './hooks/useAuth';

export function App() {
  const { loading } = useAuth();
  const [currentPage, setCurrentPage] = useState('escala');

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-slate-600">Carregando...</p>
        </div>
      </div>
    );
  }

  const renderPage = () => {
    switch (currentPage) {
      case 'login':
        return <LoginPage />;
      case 'escala':
        return <EscalaView />;
      case 'colaboradoras':
        return <ColaboradorasManager />;
      case 'rodizios':
        return <RodizioAdmin />;
      case 'auxiliares':
        return <AuxiliaresAdmin />;
      case 'area-auxiliar':
        return <AreaAuxiliarMobile />;
      case 'configuracoes':
        return <Configuracoes />;
      default:
        return <EscalaView />;
    }
  };

  return (
    <>
      <Layout currentPage={currentPage} onNavigate={setCurrentPage}>
        {renderPage()}
      </Layout>
      <ConfigCheck />
    </>
  );
}

export default App;
