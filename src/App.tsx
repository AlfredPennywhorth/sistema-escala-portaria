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
import { NeonOperacionalHml } from './components/NeonOperacionalHml';
import { NeonAreaAuxiliarHml } from './components/NeonAreaAuxiliarHml';
import { NeonRodiziosOperacional } from './components/NeonRodiziosOperacional';
import { NeonP2CadastrosReadOnly } from './components/NeonP2CadastrosReadOnly';
import { NeonOperacaoIntegrada } from './components/NeonOperacaoIntegrada';
import { NeonAdminSessionGate } from './components/NeonAdminSessionGate';

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
      /^[a-z0-9-]+\.rodizio-portaria-neon-hml\.pages\.dev$/.test(hostname);
    if (hostnameHml &&
        new URLSearchParams(window.location.search).get('minhas-datas-neon') === '1') {
      return <NeonAreaAuxiliarHml />;
    }
    if (hostnameHml &&
        new URLSearchParams(window.location.search).get('editor-rodizios-neon') === '1') {
      // Tela operacional com as 7 operações de editor de rodízios (P0)
      return <NeonAdminSessionGate><NeonRodiziosOperacional /></NeonAdminSessionGate>;
    }
    if (hostnameHml &&
        new URLSearchParams(window.location.search).get('p2-cadastros-neon') === '1') {
      // P2: Consulta de auxiliares e restrições (somente leitura, mutações bloqueadas)
      return <NeonAdminSessionGate><NeonP2CadastrosReadOnly /></NeonAdminSessionGate>;
    }
    if (hostnameHml &&
        new URLSearchParams(window.location.search).get('p4-operacao-neon') === '1') {
      // P4: Navegação e experiência operacional integrada (P0+P1+P3)
      return <NeonAdminSessionGate><NeonOperacaoIntegrada /></NeonAdminSessionGate>;
    }
    if (hostnameHml &&
        new URLSearchParams(window.location.search).get('operacional-neon') === '1') {
      // Prévia administrativa exclusivamente de leitura; a UI de produção
      // permanece inalterada e todas as mutações seguem bloqueadas.
      return <NeonOperacionalHml />;
    }
    if (hostnameHml &&
        new URLSearchParams(window.location.search).get('rpc-branch-test') === '1') {
      return <NeonRpcBranchHomologacao />;
    }
    return <NeonAuthHomologacao />;
  }
  return <AppPrincipal />;
}

export default App;
