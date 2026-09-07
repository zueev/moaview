// 같은 주소에서 반복해서 틀리면 잠시 막는다. store 테이블을 그대로 쓴다.
const WINDOW=600000;

type Note={count:number;at:number};

export async function attempts(db:D1Database,key:string){
 const raw=(await db.prepare('SELECT value FROM store WHERE key=?').bind(key).first<{value:string}>())?.value;
 if(!raw)return 0;
 const note=JSON.parse(raw) as Note;
 return Date.now()-note.at>WINDOW?0:note.count;
}
export async function record(db:D1Database,key:string,count:number){
 const value=JSON.stringify({count,at:Date.now()} satisfies Note);
 await db.prepare('INSERT INTO store (key,value,updated) VALUES (?,?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated=excluded.updated')
  .bind(key,value,new Date().toISOString()).run();
}
export async function clear(db:D1Database,key:string){await db.prepare('DELETE FROM store WHERE key=?').bind(key).run()}
