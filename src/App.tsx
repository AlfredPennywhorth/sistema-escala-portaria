import { useState } from 'react';
import { Layout } from './components/Layout';
import { EscalaView } from './components/EscalaView';
import { Configuracoes } from './components/Configuracoes';
import { RodizioAdmin } from './components/RodizioAdmin';
import { AreaAuxiliarMobile } from './components/mobile/AreaAuxiliarMobile';
import { AuxiliaresAdmin } from './components/AuxiliaresAdmin';
import { ConfigCheck } from './components/ConfigCheck';
import { LoginPage } from './components/LoginPage';
import { useAuth } from './hooks/useAuth';
import { NeonAuthHomologacao } from './components/NeonAuthHomologacao';
import { NeonRpcBranchHomologacao } from './components/NeonRpcBranchHomologacao';

function AppPrincipal() {
  const { loading } = useAuth();
  const [currentPage, setCurrentPage] = useState(() => window.location.hash.includes('type=recovery') ? 'login' : 'escala');

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

// Só habilita a tela isolada em build de homologação com configuração explícita.
// Sem esta variável, o runtime Supabase original continua em uso.
export function App() {
  if (import.meta.env.VITE_NEON_HOMOLOGACAO_ENABLED === 'true') {
    // A rota da RPC usa Auth/Data API da branch DESCARTAVEL, nunca a principal.
    // Evita expor o piloto no dominio de producao mesmo com flag acidental.
    // Cloudflare Pages gera hosts próprios para cada deployment preview,
    // ex.: aff92e86.rodizio-portaria-neon-hml.pages.dev.
    // Restringir ao projeto Neon HML e exigir opt-in explícito na URL.
    // Nunca habilitar em rodizio-portaria.pages.dev ou em domínio externo.
    const hostname = window.location.hostname.toLowerCase();
    const hostnameHml = hostname === 'rodizio-portaria-neon-hml.pages.dev' ||
      /^[a-z0-9-]+\\.rodizio-portaria-neon-hml\\.pages\\.dev$/.test(hostname);
    if (hostnameHml &&
        new URLSearchParams(window.location.search).get('rpc-branch-test') === '1') {
      return <NeonRpcBranchHomologacao />;
    }
    return <NeonAuthHomologacao />;
  }
  return <AppPrincipal />;
}

export default App;
