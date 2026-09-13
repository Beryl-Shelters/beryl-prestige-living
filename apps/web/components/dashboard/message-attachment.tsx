"use client";
import { useRef } from "react";

export function PaperclipIcon({size=20}:{size?:number}){return <svg width={size} height={size} style={{width:size,height:size,flexShrink:0}} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m21 11-8 8a6 6 0 0 1-8.5-8.5l9-9a4 4 0 0 1 5.7 5.7l-9 9a2 2 0 0 1-2.8-2.8l8-8"/></svg>;}
export function AttachmentPicker({disabled,onChange,onError}:{disabled:boolean;onChange:(file:File)=>void;onError:(message:string)=>void}){
  const input=useRef<HTMLInputElement>(null);
  return <div className="message-file-picker"><button type="button" className="attach-message-button" aria-label="Attach a file" title="Attach a PDF, JPG, PNG or WEBP (up to 10 MB)" disabled={disabled} onClick={()=>input.current?.click()}><PaperclipIcon/></button><input ref={input} type="file" aria-label="Message attachment" hidden accept=".pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/jpeg,image/png,image/webp" disabled={disabled} onChange={event=>{
    const file=event.target.files?.[0];event.target.value="";if(!file)return;
    if(!["application/pdf","image/jpeg","image/png","image/webp"].includes(file.type)||file.size===0||file.size>10*1024*1024){onError("Choose one PDF, JPG, PNG or WEBP attachment, up to 10 MB.");return;}
    onChange(file);
  }}/></div>;
}
export function SelectedAttachment({file,disabled,onRemove}:{file:File;disabled:boolean;onRemove:()=>void}){
  return <div className="selected-message-file"><PaperclipIcon size={17}/><span>{file.name}</span><small>{(file.size/1024).toFixed(1)} KB</small><button type="button" aria-label="Remove attachment" disabled={disabled} onClick={onRemove}>×</button></div>;
}
