export function redirectSystemPath({path}:{path:string;initial:boolean}){try{const url=new URL(path,"berylshelter://app");return `${url.pathname}${url.search}`||"/";}catch{return "/";}}
