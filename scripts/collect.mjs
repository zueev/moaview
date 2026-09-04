import fs from 'node:fs/promises';
import ts from 'typescript';
await fs.mkdir('.collector',{recursive:true});
for(const name of ['direct-feed','twentynine','categories']){
 const source=await fs.readFile('lib/'+name+'.ts','utf8');
 const code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText.replace(/from '(\.\/[^']+)'/g,"from '$1.mjs'");
 await fs.writeFile('.collector/'+name+'.mjs',code);
}
const {directFeed}=await import('../.collector/direct-feed.mjs');
const data=await directFeed();
if(!data.items.length)throw new Error('모든 수집 결과가 비어 있어 배포를 중단합니다.');
await fs.mkdir('public/data',{recursive:true});
await fs.writeFile('public/data/feed.json',JSON.stringify(data));
console.log(JSON.stringify({items:data.items.length,sources:data.sources.filter(s=>s.status!=='pending')}));
