import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Clock, MapPin, FileText, Lock } from 'lucide-react';
import { cn } from '../../utils/cn';
interface EscalaAuxiliarCardProps {
  item: {
    data: string;
    porta: string;
    periodo?: string | null;
    observacoes?: string | null;
    rodizio?: {
      titulo?: string;
      status?: string;
      travado?: boolean;
      [key: string]: unknown;
    };
  };
  onClick?: () => void;
}

export function EscalaAuxiliarCard({ item, onClick }: EscalaAuxiliarCardProps) {
  const dataObj = parseISO(item.data);
  const diaSemana = format(dataObj, 'EEEE', { locale: ptBR });
  const dataFormatada = format(dataObj, "dd 'de' MMMM", { locale: ptBR });
  const travado = item.rodizio?.travado ?? false;
  const statusTexto = item.rodizio?.status === 'travado' ? 'Travado' : item.rodizio?.status === 'publicado' ? 'Publicado' : item.rodizio?.status || '';
  const corStatus = item.rodizio?.travado ? 'green' : item.rodizio?.status === 'publicado' ? 'blue' : 'gray';
  const tituloRodizio = item.rodizio?.titulo || 'Escala';

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "w-full text-left bg-white rounded-2xl border p-4 transition-all active:scale-98",
        travado
          ? "border-green-200 shadow-sm"
          : "border-slate-200 hover:border-blue-300 hover:shadow-md"
      )}
    >
      <div className="flex items-start gap-4">
        <div className={cn(
          "w-14 h-14 rounded-xl flex flex-col items-center justify-center shrink-0",
          travado ? "bg-green-100" : "bg-blue-100"
        )}>
          <span className="text-xs font-medium text-blue-600 uppercase">
            {format(dataObj, 'MMM')}
          </span>
          <span className={cn(
            "text-xl font-black",
            travado ? "text-green-700" : "text-blue-700"
          )}>
            {format(dataObj, 'dd')}
          </span>
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-sm font-semibold text-slate-800 capitalize">
              {diaSemana}
            </span>
            {travado && (
              <span className="flex items-center gap-1 text-xs font-medium text-green-700 bg-green-50 px-2 py-0.5 rounded-full">
                <Lock className="w-3 h-3" />
                Travado
              </span>
            )}
          </div>

          <p className="text-lg font-bold text-slate-900">
            {dataFormatada}
          </p>

          <div className="mt-2 space-y-1">
            <div className="flex items-center gap-2 text-sm text-slate-600">
              <MapPin className="w-4 h-4 text-slate-400" />
              <span className="font-medium">{item.porta}</span>
            </div>

            {item.periodo && (
              <div className="flex items-center gap-2 text-sm text-slate-600">
                <Clock className="w-4 h-4 text-slate-400" />
                <span>{item.periodo}</span>
              </div>
            )}

            {item.observacoes && (
              <div className="flex items-start gap-2 text-sm text-slate-500">
                <FileText className="w-4 h-4 text-slate-400 mt-0.5" />
                <span className="line-clamp-2">{item.observacoes}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between">
        <span className="text-xs text-slate-500 truncate mr-2">{tituloRodizio}</span>
        <span className={cn(
          "text-xs font-medium px-2 py-1 rounded-full shrink-0",
          corStatus === 'green' && "bg-green-100 text-green-700",
          corStatus === 'blue' && "bg-blue-100 text-blue-700",
          corStatus === 'gray' && "bg-gray-100 text-gray-600"
        )}>
          {statusTexto}
        </span>
      </div>
    </button>
  );
}