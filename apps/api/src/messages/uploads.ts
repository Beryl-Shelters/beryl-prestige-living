import Busboy from "busboy";
import type { Request } from "express";
import { AuthError } from "../auth/errors.js";
import { DOCUMENT_BYTES, validateFile, type UploadFile } from "../listings/uploads.js";

export type TicketUpload = UploadFile & { filename:string };
const invalid=()=>new AuthError(400,"INVALID_ATTACHMENT","Choose one PDF, JPG, PNG or WEBP attachment, up to 10 MB.");
export function readTicketUpload(request:Request):Promise<{data:unknown;file:TicketUpload}> {
  return new Promise((resolve,reject)=>{
    let parser:ReturnType<typeof Busboy>;
    try {parser=Busboy({headers:request.headers,limits:{files:1,fields:1,parts:3,fieldSize:32768,fileSize:DOCUMENT_BYTES}});}
    catch {reject(invalid());return;}
    let data:unknown,file:TicketUpload|undefined,seen=false,failed=false;
    const timer=setTimeout(()=>{request.unpipe(parser);parser.destroy(invalid());request.resume();},120000);
    const abort=()=>parser.destroy(invalid());request.once("aborted",abort);
    parser.on("field",(name,value,info)=>{if(name!=="data"||seen||info.valueTruncated){failed=true;return;}seen=true;try{data=JSON.parse(value);}catch{failed=true;}});
    parser.on("file",(field,stream,info)=>{
      if(field!=="attachment"||file)failed=true;
      const filename=(typeof info.filename==="string"?info.filename:"Attachment").split(/[\\/]/).at(-1)?.replace(/[\p{C}]/gu,"").trim().slice(0,160)||"Attachment";
      file={field,mime:info.mimeType,filename,bytes:Buffer.alloc(0)};const chunks:Buffer[]=[];
      stream.on("limit",()=>{failed=true;});stream.on("error",()=>{failed=true;});
      stream.on("data",(chunk:Buffer)=>{if(!failed)chunks.push(chunk);});
      stream.on("end",()=>{if(!failed)file!.bytes=Buffer.concat(chunks);});
    });
    for(const event of ["filesLimit","fieldsLimit","partsLimit"])parser.on(event,()=>{failed=true;});
    parser.once("error",()=>{clearTimeout(timer);request.removeListener("aborted",abort);reject(invalid());});
    parser.once("close",()=>{
      clearTimeout(timer);request.removeListener("aborted",abort);
      if(failed||!seen||!file){reject(invalid());return;}
      try{validateFile(file,true,true);resolve({data,file});}catch{reject(invalid());}
    });
    request.pipe(parser);
  });
}
