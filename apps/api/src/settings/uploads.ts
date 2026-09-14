import Busboy from "busboy";
import type { Request } from "express";
import { AuthError } from "../auth/errors.js";
import type { UploadFile } from "../listings/uploads.js";

const maximum=2*1024*1024;
const invalid=()=>new AuthError(400,"INVALID_PROFILE_IMAGE","Choose a PNG, JPG or WebP image no larger than 2 MiB.");
export function validateProfileImage(file:UploadFile){
  const b=file.bytes;
  const png=b.length>8&&b.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]));
  const jpeg=b.length>3&&b[0]===255&&b[1]===216&&b[2]===255;
  const webp=b.length>12&&b.toString("ascii",0,4)==="RIFF"&&b.toString("ascii",8,12)==="WEBP";
  if(!b.length||b.length>maximum||!(file.mime==="image/png"&&png||file.mime==="image/jpeg"&&jpeg||file.mime==="image/webp"&&webp))throw invalid();
}
export function readProfileUpload(request:Request):Promise<{data:unknown;file:UploadFile}>{
  return new Promise((resolve,reject)=>{
    let parser:ReturnType<typeof Busboy>;
    try{parser=Busboy({headers:request.headers,limits:{files:1,fields:1,fieldSize:16384,fileSize:maximum,parts:3}});}catch{reject(invalid());return;}
    let data:unknown,file:UploadFile|undefined,failed=false;
    parser.on("field",(name,value,info)=>{if(name!=="data"||info.valueTruncated||data!==undefined){failed=true;return;}try{data=JSON.parse(value);}catch{failed=true;}});
    parser.on("file",(field,stream,info)=>{const chunks:Buffer[]=[];file={field,mime:info.mimeType,bytes:Buffer.alloc(0)};if(field!=="profileImage")failed=true;stream.on("limit",()=>{failed=true;});stream.on("data",(chunk:Buffer)=>{if(!failed)chunks.push(chunk);});stream.on("end",()=>{if(file&&!failed)file.bytes=Buffer.concat(chunks);});});
    for(const event of ["filesLimit","fieldsLimit","partsLimit"])parser.on(event,()=>{failed=true;});
    parser.once("error",()=>reject(invalid()));
    parser.once("close",()=>{try{if(failed||data===undefined||!file)throw invalid();validateProfileImage(file);resolve({data,file});}catch(error){reject(error);}});
    request.pipe(parser);
  });
}
