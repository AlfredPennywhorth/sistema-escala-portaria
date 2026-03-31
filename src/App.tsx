import { useState } from 'react';
import { Layout } from './components/Layout';
import { EscalaView } from './components/EscalaView';
import { ColaboradorasManager } from './components/ColaboradorasManager';
import { Configuracoes } from './components/Configuracoes';

export function App() {
  const [currentPage, setCurrentPage] = useState('escala');

  const renderPage = () => {
    switch (currentPage) {
      case 'escala':
        return <EscalaView />;
      case 'colaboradoras':
        return <ColaboradorasManager />;
      case 'configuracoes':
        return <Configuracoes />;
      default:
        return <EscalaView />;
    }
  };

  return (
    <Layout currentPage={currentPage} onNavigate={setCurrentPage}>
      {renderPage()}
    </Layout>
  );
}

export default App;
