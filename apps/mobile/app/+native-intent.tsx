import { mobilePathFromIncoming } from "@/lib/property-links";
export function redirectSystemPath({path}:{path:string;initial:boolean}){return mobilePathFromIncoming(path);}
