export type Task={id:string; title:string;done:boolean};
export type Campaign={id:string;title:string;platform:string;url:string;kind:string;status:string;due:string;notes:string;tasks:Task[];created:string};
export const statuses=['관심','신청 완료','당첨','완료','미선정'];
export const platforms=['레뷰','리뷰노트','미블','리뷰플레이스','디너의여왕','택배의여왕','서울오빠','놀러와체험단','강남맛집','링블','포블로그','클라우드리뷰','아싸뷰','오마이블로그','스토리앤미디어','체험뷰','리얼리뷰','리뷰통','리뷰어스','블로그랩','헬로우리뷰','메타체험단','모두의체험단','모두모여체험단','디노단','가보자체험단','더먹자','파블로','포포몬','29CM','기타'];
export function dueLabel(date:string){if(!date)return '마감일 미정';const now=new Date();const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).format(now);const n=Math.round((Date.parse(date+'T00:00:00+09:00')-Date.parse(today+'T00:00:00+09:00'))/86400000);return n<0?`${-n}일 지남`:n===0?'오늘 마감':`D-${n}`;}
