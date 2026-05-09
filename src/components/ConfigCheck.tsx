import { AlertTriangle, Settings, CheckCircle } from 'lucide-react';

function checkConfig() {
  const vars = ['VITE_SUPABASE_URL', 'VITE_SUPABASE_PUBLISHABLE_KEY'];
  const missing: string[] = [];

  for (const v of vars) {
    if (!import.meta.env[v]) {
      missing.push(v);
    }
  }

  return missing.length > 0 ? missing : null;
}

export function ConfigCheck() {
  const missingVars = checkConfig();

  if (missingVars) {
    return (
      <div className="fixed bottom-4 right-4 max-w-sm bg-amber-50 border border-amber-200 rounded-xl p-4 shadow-lg z-50">
        <div className="flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5 shrink-0" />
          <div>
            <p className="font-semibold text-amber-800">Configuração Incompleta</p>
            <p className="text-sm text-amber-700 mt-1">
              Variáveis de ambiente não configuradas:
            </p>
            <ul className="text-xs text-amber-600 mt-1 space-y-0.5">
              {missingVars.map(v => (
                <li key={v}>• {v}</li>
              ))}
            </ul>
            <p className="text-xs text-amber-600 mt-2">
              Verifique o arquivo <code className="bg-amber-100 px-1 rounded">.env.local</code> na raiz do projeto.
            </p>
            <a 
              href="docs/INSTRUCOES_TESTE_SUPABASE.md"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-amber-800 font-medium mt-2 hover:underline"
            >
              <Settings className="w-3 h-3" />
              Ver instruções de configuração
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed bottom-4 right-4 max-w-xs bg-green-50 border border-green-200 rounded-xl p-3 shadow-lg z-50">
      <div className="flex items-center gap-2 text-green-700">
        <CheckCircle className="w-4 h-4" />
        <span className="text-sm font-medium">Supabase configurado</span>
      </div>
    </div>
  );
}