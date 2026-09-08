// 29CM 신청 전송. 검증 규칙은 이전 확장 프로그램에서 쓰던 것을 그대로 옮겼다.
type Option={id:number;name:string};
type Detail={itemId:number;itemOptionType?:string;itemOptionTreeNode?:unknown;preuserEventKey:string;itemName:string;
 frontBrandNameKor?:string;partnerName?:string;recruitStartAt:string;recruitEndAt:string;reviewWriteEndAt?:string;isUserApplied?:boolean};
export type Address={receiverName:string;receiverPhone:string;receiverZipcode:string;receiverAddress:string;receiverDetailAddress:string;etcMessage:string};

export function optionsOf(tree:unknown):Option[]{
 const result:Option[]=[];
 (function visit(node:any){
  if(node?.option&&Number.isInteger(node.option.optionId))result.push({id:node.option.optionId,name:String(node.option.optionName)});
  for(const child of node?.childList||[])visit(child);
 })(tree);
 return [...new Map(result.map(o=>[o.id,o])).values()];
}

export function body(payload:{optionId?:unknown;agreements?:unknown;confirmed?:unknown;address?:Partial<Address>},detail:Detail){
 const agreements=payload.agreements;
 if(!Array.isArray(agreements)||agreements.length!==4||agreements.some(v=>v!==true)||payload.confirmed!==true)
  throw new Error('필수 약관과 최종 신청 내용을 확인해 주세요.');
 const a=payload.address||{};
 const field=(name:keyof Address,max:number,required=true)=>{
  const value=typeof a[name]==='string'?String(a[name]).trim():'';
  if((required&&!value)||value.length>max)throw new Error('배송지 입력을 확인해 주세요.');
  return value;
 };
 const receiverName=field('receiverName',60),receiverZipcode=field('receiverZipcode',5),receiverPhone=field('receiverPhone',13);
 if(!/^\d{5}$/.test(receiverZipcode)||!/^01[016789]-\d{3,4}-\d{4}$/.test(receiverPhone))
  throw new Error('우편번호 5자리와 휴대폰 번호(010-0000-0000)를 확인해 주세요.');
 const options=optionsOf(detail.itemOptionTreeNode);
 const option=options.find(o=>o.id===Number(payload.optionId));
 if(detail.itemOptionType==='OPTION'&&(!options.length||!option))throw new Error('상품 옵션을 선택해 주세요.');
 return {itemId:detail.itemId,...(option?{optionId:option.id}:{}),receiverName,receiverZipcode,receiverPhone,
  receiverAddress:field('receiverAddress',200),receiverDetailAddress:field('receiverDetailAddress',150,false),
  receiverAdditionalPhone:'',addressName:'체험단 배송지',etcMessage:field('etcMessage',100,false),
  isNewDeliveryAddress:true,changeDefaultAddress:false};
}

export function summary(detail:Detail){
 return {eventKey:detail.preuserEventKey,name:detail.itemName,brand:detail.frontBrandNameKor||'',partner:detail.partnerName||'',
  endAt:detail.recruitEndAt,reviewEndAt:detail.reviewWriteEndAt||'',applied:!!detail.isUserApplied,
  optionRequired:detail.itemOptionType==='OPTION',options:optionsOf(detail.itemOptionTreeNode)};
}

export function open(detail:Detail){
 const now=Date.now();
 if(Date.parse(detail.recruitEndAt)<=now)throw new Error('모집이 끝난 공고예요.');
 if(detail.recruitStartAt&&Date.parse(detail.recruitStartAt)>now)throw new Error('아직 모집 시작 전이에요.');
}
