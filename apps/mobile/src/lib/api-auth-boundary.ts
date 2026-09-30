export function shouldClearAccountForResponse(status:number,authenticated:boolean|undefined):boolean{
  return status===401&&authenticated!==false;
}
