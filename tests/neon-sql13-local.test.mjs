import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../src/sql13-local.tsx',import.meta.url),'utf8');
const html=readFileSync(new URL('../sql13-local.html',import.meta.url),'utf8');
test('SQL13 client is local-only and targets disposable compute',()=>{
 assert.match(source,/location\.origin === 'http:\/\/localhost:5173' && import\.meta\.env\.DEV/);
 assert.match(source,/const client = local \? createClient/);
 assert.match(source,/ep-sparkling-frog-b6k2wvw7\.neonauth/);
 assert.match(source,/ep-sparkling-frog-b6k2wvw7\.apirest/);
 assert.doesNotMatch(source,/ep-purple-water|ep-nameless-dust|VITE_SUPABASE/);
 assert.match(html,/src="\/src\/sql13-local\.tsx"/);
});
test('SQL13 validates JWT, requires FK success and stops on divergent result',()=>{
 assert.match(source,/jwt\.data !== user\.id/);
 assert.match(source,/!passed\.current\.has\('invalid-fk'\)/);
 assert.match(source,/JSON\.stringify\(before\)===JSON\.stringify\(after\)/);
 assert.match(source,/P0001/);
 assert.match(source,/23503/);
 assert.match(source,/42501/);
 assert.match(source,/localStorage\.setItem\(key,'1'\)/);
 assert.match(source,/requiresIndependentReconciliation:true/);
});
