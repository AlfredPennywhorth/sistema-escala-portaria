import { useState, useEffect } from 'react';
import { 
  User, 
  LogOut, 
  Calendar, 
  AlertCircle, 
  Loader2,
  ChevronRight,
  Lock,
  Clock,
  MapPin,
  FileText,
  LogIn
} from 'lucide-react';
import { format, parseISO, isFuture, isPast } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useAuth } from '../../hooks/useAuth';
import { EscalaAuxiliarCard } from './EscalaAuxiliarCard';
import * as areaService from '../../services/areaAuxiliarService';
import type { Auxiliar } from '../../types/supabase';
import { LoginSupabase } from '../LoginSupabase';

interface ItemEscala {
  id: string;
  data: string;
  porta: string;
  periodo: string | null;
  observacoes: string | null;
  rodizio_id: string;
  rodizio?: {
    titulo?: string;
    status?: string;
    travado?: boolean;
    [key: string]: unknown;
  };
}

export function AreaAuxiliarMobile() {
  const { usuario, loading: loadingAuth, logout } = useAuth();
  const [mostrarLogin, setMostrarLogin] = useState(false);
  const [minhaAuxiliar, setMinhaAuxiliar] = useState<Auxiliar | null>(null);
  const [proximasEscalas, setProximasEscalas] = useState<ItemEscala[]>([]);
  const [todasMinhasEscalas, setTodasMinhasEscalas] = useState<ItemEscala[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [paginaAtual, setPaginaAtual] = useState<'home' | 'escala-completa' | 'minhas-datas'>('home');
  const [escalaSelecionada, setEscalaSelecionada] = useState<ItemEscala[]>([]);
  const [tituloEscalaSelecionada, setTituloEscalaSelecionada] = useState('');

  useEffect(() => {
    async function carregarDados() {
      if (!usuario) {
        setCarregando(false);
        return;
      }

      setCarregando(true);
      setErro(null);

      try {
        const auxiliarResult = await areaService.obterMinhaAuxiliar();

        if (auxiliarResult.error) {
          setErro(auxiliarResult.error);
          setCarregando(false);
          return;
        }

        setMinhaAuxiliar(auxiliarResult.data);

        if (auxiliarResult.data) {
          const [escalasResult, datasResult] = await Promise.all([
            areaService.listarMinhasEscalas(auxiliarResult.data.id),
            areaService.listarMinhasDatas(auxiliarResult.data.id),
          ]);

          if (!escalasResult.error && escalasResult.data) {
            const futuras = escalasResult.data.filter(item => isFuture(parseISO(item.data)));
            setProximasEscalas(futuras as typeof proximasEscalas);
          }

          if (!datasResult.error && datasResult.data) {
            setTodasMinhasEscalas(datasResult.data);
          }
        }
      } catch {
        setErro('Erro ao carregar dados');
      } finally {
        setCarregando(false);
      }
    }

    carregarDados();
  }, [usuario]);

  const handleLogout = async () => {
    await logout();
  };

  const handleVerEscalaCompleta = async (rodizioId: string, titulo: string) => {
    const result = await areaService.listarEscalaCompletaPublicada(rodizioId);
    if (!result.error && result.data) {
      setEscalaSelecionada(result.data);
      setTituloEscalaSelecionada(titulo);
      setPaginaAtual('escala-completa');
    }
  };

  const handleVoltar = () => {
    setPaginaAtual('home');
    setEscalaSelecionada([]);
    setTituloEscalaSelecionada('');
  };

  if (loadingAuth || carregando) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-slate-600">Carregando...</p>
        </div>
      </div>
    );
  }

  if (!usuario) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="text-center max-w-sm mx-auto">
          <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <User className="w-8 h-8 text-blue-600" />
          </div>
          <h1 className="text-xl font-bold text-slate-800 mb-2">Área da Auxiliar</h1>
          <p className="text-slate-600 mb-6">Faça login para acessar sua área de escalas.</p>
          <button
            onClick={() => setMostrarLogin(true)}
            className="px-6 py-3 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition-all flex items-center gap-2 mx-auto"
          >
            <LogIn className="w-5 h-5" />
            Entrar
          </button>
          
          {mostrarLogin && (
            <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
              <div className="w-full max-w-md relative">
                <button
                  onClick={() => setMostrarLogin(false)}
                  className="absolute -top-8 right-0 p-2 text-white hover:text-gray-200"
                >
                  ✕ Fechar
                </button>
                <LoginSupabase onClose={() => setMostrarLogin(false)} />
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (!minhaAuxiliar) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="text-center max-w-sm mx-auto">
          <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-8 h-8 text-amber-600" />
          </div>
          <h1 className="text-xl font-bold text-slate-800 mb-2">Conta sem vínculo</h1>
          <p className="text-slate-600 mb-6">
            Sua conta não está vinculada a uma auxiliar. 
            Entre em contato com o administrador.
          </p>
          <button
            onClick={handleLogout}
            className="px-6 py-3 bg-slate-200 text-slate-700 font-medium rounded-xl"
          >
            Sair
          </button>
        </div>
      </div>
    );
  }

  if (paginaAtual === 'escala-completa') {
    return (
      <div className="min-h-screen bg-slate-50">
        <header className="bg-white border-b border-slate-200 px-4 py-4 sticky top-0 z-10">
          <div className="flex items-center gap-3">
            <button
              onClick={handleVoltar}
              className="p-2 -ml-2 rounded-lg hover:bg-slate-100"
            >
              <ChevronRight className="w-5 h-5 text-slate-600 rotate-180" />
            </button>
            <div>
              <h1 className="font-bold text-slate-800">{tituloEscalaSelecionada}</h1>
              <p className="text-xs text-slate-500">Escala completa</p>
            </div>
          </div>
        </header>

        <div className="p-4 space-y-3">
          {escalaSelecionada.map((item) => (
            <div key={item.id} className="bg-white rounded-2xl border border-slate-200 p-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-blue-100 rounded-xl flex flex-col items-center justify-center">
                  <span className="text-xs font-medium text-blue-600">
                    {format(parseISO(item.data), 'MMM')}
                  </span>
                  <span className="text-lg font-black text-blue-700">
                    {format(parseISO(item.data), 'dd')}
                  </span>
                </div>
                <div className="flex-1">
                  <p className="font-bold text-slate-800">
                    {format(parseISO(item.data), "EEEE, dd 'de' MMMM", { locale: ptBR })}
                  </p>
                  <div className="flex items-center gap-2 text-sm text-slate-600 mt-1">
                    <MapPin className="w-4 h-4" />
                    <span>{item.porta}</span>
                    {item.periodo && (
                      <>
                        <Clock className="w-4 h-4 ml-2" />
                        <span>{item.periodo}</span>
                      </>
                    )}
                  </div>
                </div>
              </div>
              {item.observacoes && (
                <div className="mt-3 pt-3 border-t border-slate-100 flex items-start gap-2 text-sm text-slate-500">
                  <FileText className="w-4 h-4 mt-0.5" />
                  <span>{item.observacoes}</span>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (paginaAtual === 'minhas-datas') {
    const datasFuturas = todasMinhasEscalas.filter(item => isFuture(parseISO(item.data)));
    const datasPassadas = todasMinhasEscalas.filter(item => isPast(parseISO(item.data)));

    return (
      <div className="min-h-screen bg-slate-50">
        <header className="bg-white border-b border-slate-200 px-4 py-4 sticky top-0 z-10">
          <div className="flex items-center gap-3">
            <button
              onClick={handleVoltar}
              className="p-2 -ml-2 rounded-lg hover:bg-slate-100"
            >
              <ChevronRight className="w-5 h-5 text-slate-600 rotate-180" />
            </button>
            <div>
              <h1 className="font-bold text-slate-800">Minhas Datas</h1>
              <p className="text-xs text-slate-500">Todas as suas escalas</p>
            </div>
          </div>
        </header>

        <div className="p-4 space-y-6">
          {datasFuturas.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">
                Próximas ({datasFuturas.length})
              </h2>
              <div className="space-y-2">
                {datasFuturas.map((item) => (
                  <EscalaAuxiliarCard
                    key={item.id}
                    item={item}
                  />
                ))}
              </div>
            </div>
          )}

          {datasPassadas.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">
                Anteriores ({datasPassadas.length})
              </h2>
              <div className="space-y-2 opacity-60">
                {datasPassadas.slice(0, 5).map((item) => (
                  <EscalaAuxiliarCard
                    key={item.id}
                    item={item}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-gradient-to-br from-blue-600 to-blue-700 text-white px-4 pt-8 pb-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center">
              <User className="w-6 h-6" />
            </div>
            <div>
              <h1 className="font-bold text-lg">{minhaAuxiliar.nome}</h1>
              <p className="text-blue-100 text-sm">Auxiliar</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="p-2 bg-white/20 rounded-lg hover:bg-white/30 transition-colors"
            title="Sair"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>

        <div className="text-blue-100 text-sm">
          {minhaAuxiliar.email && <p>{minhaAuxiliar.email}</p>}
          {minhaAuxiliar.telefone && <p>{minhaAuxiliar.telefone}</p>}
        </div>
      </header>

      <div className="p-4 space-y-4">
        {erro && (
          <div className="bg-red-50 border border-red-200 rounded-2xl p-4 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-500 mt-0.5 shrink-0" />
            <div>
              <p className="font-medium text-red-800">Erro ao carregar dados</p>
              <p className="text-sm text-red-600">{erro}</p>
            </div>
          </div>
        )}

        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <button
            onClick={() => setPaginaAtual('minhas-datas')}
            className="w-full flex items-center gap-4 p-4 hover:bg-slate-50 transition-colors active:bg-slate-100"
          >
            <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center shrink-0">
              <Calendar className="w-6 h-6 text-green-600" />
            </div>
            <div className="flex-1 text-left">
              <p className="font-semibold text-slate-800">Minhas Datas</p>
              <p className="text-sm text-slate-500">
                {proximasEscalas.length} escalas futuras
              </p>
            </div>
            <ChevronRight className="w-5 h-5 text-slate-400" />
          </button>
        </div>

        {proximasEscalas.length > 0 && (
          <div>
            <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3 flex items-center gap-2">
              <Clock className="w-4 h-4" />
              Próximas Escalas
            </h2>
            <div className="space-y-2">
              {proximasEscalas.slice(0, 3).map((item) => (
                <EscalaAuxiliarCard
                  key={item.id}
                  item={item}
                  onClick={() => item.rodizio?.titulo && handleVerEscalaCompleta(item.rodizio_id, item.rodizio.titulo)}
                />
              ))}
            </div>
          </div>
        )}

        {proximasEscalas.length === 0 && !erro && (
          <div className="bg-slate-100 rounded-2xl p-6 text-center">
            <Calendar className="w-12 h-12 text-slate-400 mx-auto mb-3" />
            <p className="text-slate-600 font-medium">Nenhuma escala futura</p>
            <p className="text-sm text-slate-500 mt-1">
              Suas próximas escalas aparecerão aqui
            </p>
          </div>
        )}

        <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4">
          <div className="flex items-start gap-3">
            <Lock className="w-5 h-5 text-blue-600 mt-0.5" />
            <div>
              <p className="font-medium text-blue-800">EscalasTravadas</p>
              <p className="text-sm text-blue-700 mt-1">
                As escalas travadas ficam disponíveis como histórico para equilíbrio das próximas escalas.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}